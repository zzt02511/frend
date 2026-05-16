"""渲染作业 API + SSE 实时流"""

import json
import os
import asyncio
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel

from app.sandbox.job_queue import job_queue
from app.config import settings

router = APIRouter()


class JobResponse(BaseModel):
    job_id: str
    project_id: str
    template_id: str
    status: str
    progress: float = 0.0
    current_step: str = ""
    message: str = ""
    output_path: str = ""
    error: str = ""
    created_at: float = 0.0


def _job_to_response(job: dict) -> JobResponse:
    return JobResponse(
        job_id=job["job_id"],
        project_id=job["project_id"],
        template_id=job["template_id"],
        status=job["status"],
        progress=job["progress"],
        current_step=job["current_step"],
        message=job["message"],
        output_path=job["output_path"],
        error=job["error"],
        created_at=job["created_at"],
    )


@router.get("", response_model=list[JobResponse])
async def list_jobs():
    jobs = await job_queue.list_jobs()
    return [_job_to_response(j) for j in jobs]


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: str):
    job = await job_queue.get_job(job_id)
    if not job:
        raise HTTPException(404, "作业不存在")
    return _job_to_response(job)


@router.post("/{job_id}/cancel")
async def cancel_job(job_id: str):
    job = await job_queue.get_job(job_id)
    if not job:
        raise HTTPException(404, "作业不存在")
    if job["status"] in ("completed", "failed", "cancelled"):
        raise HTTPException(400, "作业已结束")
    from app.sandbox.job_queue import JobStatus
    await job_queue.set_status(job_id, JobStatus.CANCELLED, error="用户取消")
    from app.sandbox.local_sandbox import sandbox
    await sandbox.cancel(job_id)
    return {"status": "cancelled"}


@router.get("/{job_id}/stream")
async def job_stream(job_id: str):
    """SSE 实时作业进度流"""
    job = await job_queue.get_job(job_id)
    if not job:
        raise HTTPException(404, "作业不存在")

    event_queue = await job_queue.subscribe(job_id)

    async def event_generator():
        try:
            # 先发送当前状态
            yield f"data: {json.dumps({'type': 'connected', 'job_id': job_id, 'status': job['status'], 'progress': job['progress']})}\n\n"

            while True:
                try:
                    data = await asyncio.wait_for(event_queue.get(), timeout=30)
                    yield f"data: {json.dumps(data)}\n\n"
                    if data.get("type") in ("complete", "error", "cancelled"):
                        break
                except asyncio.TimeoutError:
                    # 心跳保活
                    yield f": heartbeat\n\n"
        finally:
            job_queue.unsubscribe(job_id, event_queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{job_id}/download")
async def download_job_output(job_id: str):
    """下载渲染完成的视频文件"""
    job = await job_queue.get_job(job_id)
    if not job:
        raise HTTPException(404, "作业不存在")
    if job["status"] != "completed":
        raise HTTPException(400, "作业尚未完成")
    if not job["output_path"] or not os.path.exists(job["output_path"]):
        raise HTTPException(404, "输出文件不存在")

    filename = os.path.basename(job["output_path"])
    return FileResponse(
        path=job["output_path"],
        filename=filename,
        media_type="video/mp4",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
