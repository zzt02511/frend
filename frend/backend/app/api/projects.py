"""项目管理 API + 渲染触发 - SQLite 持久化"""

import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import db as database
from app.sandbox.job_queue import job_queue
from app.skills.template_parser import TemplateParserSkill

router = APIRouter()
_parser = TemplateParserSkill()


def _enrich_project(project: dict) -> dict:
    """补充 template_name 字段"""
    if not project:
        return project
    tpl_name = project.get("template_id", "")
    templates = _parser.list_available_templates()
    for t in templates:
        if t.get("id") == project["template_id"]:
            tpl_name = t.get("name", project["template_id"])
            break
    project["template_name"] = tpl_name
    return project


class CreateProjectRequest(BaseModel):
    template_id: str
    params: dict = {}


class ProjectResponse(BaseModel):
    project_id: str
    template_id: str
    template_name: str = ""
    status: str = "draft"
    params: dict = {}


@router.post("", response_model=ProjectResponse)
async def create_project(req: CreateProjectRequest):
    result = await database.create_project(req.template_id, req.params)
    return _enrich_project(result)


@router.get("", response_model=list[ProjectResponse])
async def list_projects():
    projects = await database.list_projects()
    return [_enrich_project(p) for p in projects]


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str):
    project = await database.get_project(project_id)
    if not project:
        raise HTTPException(404, "项目不存在")
    return _enrich_project(project)


@router.post("/{project_id}/render")
async def submit_render(project_id: str):
    """提交项目进行渲染"""
    project = await database.get_project(project_id)
    if not project:
        raise HTTPException(404, "项目不存在")

    await database.update_project_status(project_id, "rendering")

    # 创建渲染作业
    job = await job_queue.enqueue(
        project_id=project_id,
        template_id=project["template_id"],
        user_params=project["params"],
    )

    # 异步启动渲染
    asyncio.create_task(_run_render_job(job["job_id"]))

    return {
        "job_id": job["job_id"],
        "project_id": project_id,
        "status": "queued",
        "message": "渲染作业已提交",
    }


async def _run_render_job(job_id: str):
    """运行渲染作业 - 通过 LangGraph 编排，带重试"""
    job = await database.get_job(job_id)
    if not job:
        return

    try:
        # 获取并发许可
        if not await job_queue.acquire(job_id):
            return

        await database.update_job_status(job_id, "running")
        await database.update_job_progress(job_id, 0.0, "init", "开始处理...")

        # 标记运行中任务（用于超时检测和取消）
        current_task = asyncio.current_task()
        if current_task:
            job_queue.mark_running(job_id, current_task)

        # 运行 LangGraph 图
        from app.agents.graph import video_graph
        from app.agents.coordinator import create_initial_state
        from app.config import settings

        initial_state = create_initial_state(
            project_id=job["project_id"],
            template_id=job["template_id"],
            user_params=job["user_params"],
            config={"data_dir": settings.data_dir, **job["config"]},
        )

        # 执行图
        result = await video_graph.ainvoke(initial_state)

        # 检查结果
        errors = result.get("errors", [])
        output_path = result.get("output_path", "")

        if errors and any(e for e in errors):
            error_msg = "; ".join(errors[:3])
            # 检查是否可重试
            if job_queue.should_retry(job_id):
                job_queue.record_retry(job_id)
                retry_count = job_queue._retry_counts.get(job_id, 0)
                await database.update_job_progress(job_id, 0.0, "retry", f"第 {retry_count} 次重试...")
                await database.update_job_status(job_id, "queued", error=error_msg)
                # 重新调度
                await asyncio.sleep(2 ** retry_count)  # 指数退避
                asyncio.create_task(_run_render_job(job_id))
            else:
                await database.update_job_status(job_id, "failed", error=error_msg)
                job_queue.release(job_id)
        else:
            await database.update_job_progress(job_id, 1.0, "complete", "渲染完成")
            await database.update_job_status(job_id, "completed", output_path=output_path)
            job_queue.release(job_id)

        # 更新项目状态
        project = await database.get_project(job["project_id"])
        if project:
            await database.update_project_status(
                job["project_id"],
                "completed" if not errors else "failed",
            )

    except asyncio.CancelledError:
        await database.update_job_status(job_id, "cancelled", error="作业被取消")
        job_queue.release(job_id)

    except Exception as e:
        await database.update_job_status(job_id, "failed", error=f"渲染异常: {e}")
        job_queue.release(job_id)
