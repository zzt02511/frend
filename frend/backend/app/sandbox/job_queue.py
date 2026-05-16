"""作业队列 - SQLite 持久化 + SSE 实时推送 + 并发控制 + 超时/重试/清理"""

import asyncio
import json
import time
import logging
from enum import Enum
from typing import Optional

from app import db as database
from app.config import settings

logger = logging.getLogger("frend.job_queue")


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobQueue:
    """异步作业队列 - 持久化存储 + 并发限制 + SSE 事件推送 + 超时/重试/清理"""

    def __init__(self, max_concurrent: int = 2, max_retries: int = 2, cleanup_interval: int = 300):
        self._running: dict[str, asyncio.Task] = {}
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._sse_queues: dict[str, list[asyncio.Queue]] = {}
        # 超时追踪
        self._started_at: dict[str, float] = {}
        # 重试计数
        self._retry_counts: dict[str, int] = {}
        self._max_retries = max_retries
        self._cleanup_interval = cleanup_interval
        self._cleanup_task: Optional[asyncio.Task] = None

    # ============================================================
    # 作业 CRUD（委托 SQLite）
    # ============================================================

    async def enqueue(self, project_id: str, template_id: str, user_params: dict, config: dict = None) -> dict:
        """创建并加入作业到 SQLite"""
        return await database.create_job(
            project_id=project_id,
            template_id=template_id,
            user_params=user_params,
            config=config,
        )

    async def get_job(self, job_id: str) -> Optional[dict]:
        return await database.get_job(job_id)

    async def list_jobs(self) -> list[dict]:
        return await database.list_jobs()

    async def update_progress(self, job_id: str, progress: float, step: str = "", message: str = ""):
        """更新进度 - 持久化 + 广播"""
        await database.update_job_progress(job_id, progress, step, message)
        await self._broadcast(job_id, {
            "type": "progress",
            "job_id": job_id,
            "progress": progress,
            "step": step or "",
            "message": message,
        })

    async def set_status(self, job_id: str, status: JobStatus, error: str = "", output_path: str = ""):
        """设置状态 - 持久化 + 广播"""
        await database.update_job_status(
            job_id, status.value,
            error=error, output_path=output_path,
        )

        event_type = {
            JobStatus.COMPLETED: "complete",
            JobStatus.FAILED: "error",
            JobStatus.CANCELLED: "cancelled",
        }.get(status, "progress")

        await self._broadcast(job_id, {
            "type": event_type,
            "job_id": job_id,
            "status": status.value,
            "progress": 1.0 if status == JobStatus.COMPLETED else 0.0,
            "output_path": output_path,
            "error": error,
        })

    # ============================================================
    # 并发控制
    # ============================================================

    async def acquire(self, job_id: str) -> bool:
        if job_id in self._running:
            return False
        await self._semaphore.acquire()
        return True

    def release(self, job_id: str):
        self._running.pop(job_id, None)
        self._started_at.pop(job_id, None)
        self._retry_counts.pop(job_id, None)
        self._semaphore.release()

    def mark_running(self, job_id: str, task: asyncio.Task):
        self._running[job_id] = task
        self._started_at[job_id] = time.time()

    async def cancel(self, job_id: str):
        task = self._running.get(job_id)
        if task:
            task.cancel()
            self.release(job_id)

    # ============================================================
    # 超时检测
    # ============================================================

    def is_timed_out(self, job_id: str) -> bool:
        started = self._started_at.get(job_id)
        if started is None:
            return False
        elapsed = time.time() - started
        return elapsed > settings.max_job_duration_seconds

    async def check_timeouts(self):
        """检查所有运行中的作业是否超时"""
        now = time.time()
        for job_id, started in list(self._started_at.items()):
            elapsed = now - started
            if elapsed > settings.max_job_duration_seconds:
                logger.warning(f"作业 {job_id} 超时 ({elapsed:.0f}s > {settings.max_job_duration_seconds}s)，自动取消")
                await self.set_status(job_id, JobStatus.FAILED, error=f"执行超时 ({elapsed:.0f}s)")
                await self.cancel(job_id)

    # ============================================================
    # 重试
    # ============================================================

    def should_retry(self, job_id: str) -> bool:
        count = self._retry_counts.get(job_id, 0)
        return count < self._max_retries

    def record_retry(self, job_id: str):
        self._retry_counts[job_id] = self._retry_counts.get(job_id, 0) + 1

    # ============================================================
    # 周期性清理
    # ============================================================

    async def _cleanup_loop(self):
        """后台清理任务 - 保留最近 50 条作业，删除更早的完成/失败/取消记录"""
        while True:
            try:
                await asyncio.sleep(self._cleanup_interval)
                await self._run_cleanup()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"清理任务异常: {e}")

    async def _run_cleanup(self):
        """执行单次清理"""
        keep_count = 50
        # 获取所有已结束的作业 ID（除 queued/running 外）
        finished = await database.list_finished_jobs(limit=1000)
        if len(finished) <= keep_count:
            return
        to_delete = finished[:-keep_count]
        ids_to_delete = [j["job_id"] for j in to_delete]
        if ids_to_delete:
            deleted = await database.delete_jobs(ids_to_delete)
            logger.info(f"清理了 {deleted} 条旧作业记录 (保留 {keep_count} 条)")

    def start_cleanup(self):
        """启动后台清理任务"""
        if self._cleanup_task is None or self._cleanup_task.done():
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())
            logger.info("后台清理任务已启动")

    def stop_cleanup(self):
        """停止后台清理任务"""
        if self._cleanup_task and not self._cleanup_task.done():
            self._cleanup_task.cancel()
            self._cleanup_task = None

    # ============================================================
    # SSE 推送
    # ============================================================

    async def subscribe(self, job_id: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        if job_id not in self._sse_queues:
            self._sse_queues[job_id] = []
        self._sse_queues[job_id].append(q)
        return q

    def unsubscribe(self, job_id: str, q: asyncio.Queue):
        if job_id in self._sse_queues:
            self._sse_queues[job_id] = [x for x in self._sse_queues[job_id] if x is not q]

    async def _broadcast(self, job_id: str, data: dict):
        queues = self._sse_queues.get(job_id, [])
        for q in queues:
            await q.put(data)


# 全局作业队列
job_queue = JobQueue()
