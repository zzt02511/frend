"""批量生成 API - CSV/JSON 参数导入 + 批量渲染 + ZIP 下载"""

import asyncio
import csv
import io
import json
import os
import time
import uuid
import zipfile
from io import StringIO
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app import db as database
from app.api.projects import _run_render_job
from app.config import settings
from app.sandbox.job_queue import job_queue

router = APIRouter()

# 内存中的批次状态
_batches: dict[str, dict] = {}


class BatchRequest(BaseModel):
    template_id: str
    params_list: list[dict]  # JSON 数组: [{"topic": "A", "tone": "轻松"}, {"topic": "B", "tone": "专业"}]


class BatchCSVRequest(BaseModel):
    template_id: str
    csv_content: str  # 原始 CSV 字符串


class BatchResponse(BaseModel):
    batch_id: str
    total: int
    jobs: list[dict]


@router.post("/batch/json", response_model=BatchResponse)
async def create_batch_json(req: BatchRequest):
    """从 JSON 参数数组创建批量渲染"""
    if not req.params_list:
        raise HTTPException(400, "params_list 不能为空")

    batch_id = f"batch_{uuid.uuid4().hex[:8]}"
    jobs = []

    for i, params in enumerate(req.params_list):
        # 为每组参数创建独立项目
        project = await database.create_project(req.template_id, params)

        # 创建渲染作业
        job = await job_queue.enqueue(
            project_id=project["project_id"],
            template_id=req.template_id,
            user_params=params,
            config={"batch_id": batch_id, "batch_index": i},
        )
        jobs.append({
            "index": i,
            "job_id": job["job_id"],
            "project_id": project["project_id"],
            "params": params,
            "status": "queued",
        })

        # 异步启动渲染
        asyncio.create_task(_run_render_job(job["job_id"]))

    _batches[batch_id] = {
        "batch_id": batch_id,
        "template_id": req.template_id,
        "total": len(jobs),
        "jobs": jobs,
        "created_at": time.time(),
    }

    return BatchResponse(batch_id=batch_id, total=len(jobs), jobs=jobs)


@router.post("/batch/csv", response_model=BatchResponse)
async def create_batch_csv(req: BatchCSVRequest):
    """从 CSV 字符串创建批量渲染"""
    reader = csv.DictReader(StringIO(req.csv_content))
    params_list = []
    for row in reader:
        params_list.append({k: v for k, v in row.items() if v})

    if not params_list:
        raise HTTPException(400, "CSV 内容为空或无效")

    return await create_batch_json(BatchRequest(
        template_id=req.template_id,
        params_list=params_list,
    ))


@router.get("/batch/{batch_id}")
async def get_batch_status(batch_id: str):
    """获取批量渲染状态"""
    batch = _batches.get(batch_id)
    if not batch:
        raise HTTPException(404, "批次不存在")

    # 获取所有作业的最新状态
    updated_jobs = []
    completed = 0
    failed = 0
    for j in batch["jobs"]:
        job = await database.get_job(j["job_id"])
        if job:
            j["status"] = job["status"]
            j["progress"] = job["progress"]
            j["output_path"] = job["output_path"]
            j["error"] = job.get("error", "")
            if job["status"] == "completed":
                completed += 1
            elif job["status"] in ("failed", "cancelled"):
                failed += 1
        updated_jobs.append(j)

    return {
        "batch_id": batch_id,
        "template_id": batch["template_id"],
        "total": batch["total"],
        "completed": completed,
        "failed": failed,
        "running": batch["total"] - completed - failed,
        "jobs": updated_jobs,
        "created_at": batch["created_at"],
    }


@router.get("/batch/{batch_id}/download")
async def download_batch(batch_id: str):
    """下载批次中所有已完成视频的 ZIP 归档"""
    batch = _batches.get(batch_id)
    if not batch:
        raise HTTPException(404, "批次不存在")

    # 收集所有已完成的文件
    files_to_zip = []
    for j in batch["jobs"]:
        job = await database.get_job(j["job_id"])
        if job and job["status"] == "completed" and job["output_path"]:
            if os.path.exists(job["output_path"]):
                files_to_zip.append({
                    "path": job["output_path"],
                    "name": f"video_{j['index']+1:03d}_{j['params'].get('topic', 'output')[:20]}.mp4",
                })

    if not files_to_zip:
        raise HTTPException(400, "没有可下载的已完成视频")

    # 在内存中创建 ZIP
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in files_to_zip:
            safe_name = "".join(c if c.isalnum() or c in "._- " else "_" for c in f["name"])
            zf.write(f["path"], safe_name)
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="batch_{batch_id}.zip"',
        },
    )
