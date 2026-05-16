"""数据库模块 - 异步 PostgreSQL (asyncpg)"""

import json
import time
import uuid
from typing import Optional

import asyncpg

from app.config import settings


# 全局连接池
_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> asyncpg.Pool:
    """获取全局连接池"""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=settings.database_url,
            min_size=2,
            max_size=10,
        )
    return _pool


async def close_pool():
    """关闭连接池"""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def init_db():
    """初始化数据库表结构"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                project_id TEXT PRIMARY KEY,
                template_id TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'draft',
                params TEXT NOT NULL DEFAULT '{}',
                created_at DOUBLE PRECISION NOT NULL,
                updated_at DOUBLE PRECISION NOT NULL
            );

            CREATE TABLE IF NOT EXISTS jobs (
                job_id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                template_id TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'queued',
                progress DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                current_step TEXT NOT NULL DEFAULT '',
                message TEXT NOT NULL DEFAULT '',
                output_path TEXT NOT NULL DEFAULT '',
                error TEXT NOT NULL DEFAULT '',
                user_params TEXT NOT NULL DEFAULT '{}',
                config TEXT NOT NULL DEFAULT '{}',
                created_at DOUBLE PRECISION NOT NULL,
                started_at DOUBLE PRECISION,
                completed_at DOUBLE PRECISION
            );

            CREATE TABLE IF NOT EXISTS assets (
                id SERIAL PRIMARY KEY,
                project_id TEXT NOT NULL,
                scene_index INTEGER NOT NULL DEFAULT 0,
                asset_type TEXT NOT NULL DEFAULT '',
                file_path TEXT NOT NULL DEFAULT '',
                file_size INTEGER NOT NULL DEFAULT 0,
                description TEXT NOT NULL DEFAULT '',
                created_at DOUBLE PRECISION NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_jobs_project ON jobs(project_id);
            CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
            CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id);
        """)


# ============================================================
# 项目 CRUD
# ============================================================


async def create_project(template_id: str, params: dict) -> dict:
    now = time.time()
    project_id = f"proj_{uuid.uuid4().hex[:6]}"
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO projects (project_id, template_id, status, params, created_at, updated_at) VALUES ($1, $2, 'draft', $3, $4, $5)",
            project_id, template_id, json.dumps(params, ensure_ascii=False), now, now,
        )
    return {
        "project_id": project_id,
        "template_id": template_id,
        "status": "draft",
        "params": params,
    }


async def list_projects() -> list[dict]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM projects ORDER BY created_at DESC")
        return [_project_row(r) for r in rows]


async def get_project(project_id: str) -> Optional[dict]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM projects WHERE project_id = $1", project_id)
        return _project_row(row) if row else None


async def update_project_status(project_id: str, status: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE projects SET status = $1, updated_at = $2 WHERE project_id = $3",
            status, time.time(), project_id,
        )


# ============================================================
# 作业 CRUD
# ============================================================


async def create_job(project_id: str, template_id: str, user_params: dict, config: dict = None) -> dict:
    now = time.time()
    job_id = f"job_{uuid.uuid4().hex[:8]}"
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO jobs (job_id, project_id, template_id, status, progress,
               user_params, config, created_at)
               VALUES ($1, $2, $3, 'queued', 0.0, $4, $5, $6)""",
            job_id, project_id, template_id,
            json.dumps(user_params, ensure_ascii=False),
            json.dumps(config or {}, ensure_ascii=False),
            now,
        )
    return {
        "job_id": job_id,
        "project_id": project_id,
        "template_id": template_id,
        "status": "queued",
        "progress": 0.0,
        "current_step": "",
        "message": "",
        "output_path": "",
        "error": "",
        "user_params": user_params,
        "config": config or {},
        "created_at": now,
    }


async def list_jobs() -> list[dict]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM jobs ORDER BY created_at DESC")
        return [_job_row(r) for r in rows]


async def get_job(job_id: str) -> Optional[dict]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM jobs WHERE job_id = $1", job_id)
        return _job_row(row) if row else None


async def update_job_progress(job_id: str, progress: float, step: str = "", message: str = ""):
    pool = await get_pool()
    async with pool.acquire() as conn:
        updates = ["progress = $1"]
        params = [progress]
        idx = 2
        if step:
            updates.append(f"current_step = ${idx}")
            params.append(step)
            idx += 1
        if message:
            updates.append(f"message = ${idx}")
            params.append(message)
            idx += 1
        params.append(job_id)
        await conn.execute(f"UPDATE jobs SET {', '.join(updates)} WHERE job_id = ${idx}", *params)


async def update_job_status(job_id: str, status: str, error: str = "", output_path: str = ""):
    pool = await get_pool()
    now = time.time()
    async with pool.acquire() as conn:
        if status in ("completed", "failed", "cancelled"):
            await conn.execute(
                "UPDATE jobs SET status = $1, completed_at = $2, progress = 1.0, error = $3, output_path = $4 WHERE job_id = $5",
                status, now, error, output_path, job_id,
            )
        elif status == "running":
            await conn.execute(
                "UPDATE jobs SET status = $1, started_at = $2 WHERE job_id = $3",
                status, now, job_id,
            )
        else:
            await conn.execute("UPDATE jobs SET status = $1 WHERE job_id = $2", status, job_id)


# ============================================================
# 作业清理
# ============================================================


async def list_finished_jobs(limit: int = 1000) -> list[dict]:
    """列出已结束的作业（非 queued/running），按创建时间排序"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM jobs WHERE status NOT IN ('queued', 'running') ORDER BY created_at ASC"
        )
        return [_job_row(r) for r in rows[:limit]]


async def delete_jobs(job_ids: list[str]) -> int:
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(
            "DELETE FROM jobs WHERE job_id = ANY($1::text[])",
            job_ids,
        )
        # asyncpg execute returns "DELETE N" string
        return int(result.split()[-1]) if result else 0


# ============================================================
# 行转换器
# ============================================================


def _project_row(row) -> dict:
    return {
        "project_id": row["project_id"],
        "template_id": row["template_id"],
        "status": row["status"],
        "params": json.loads(row["params"]),
    }


def _job_row(row) -> dict:
    return {
        "job_id": row["job_id"],
        "project_id": row["project_id"],
        "template_id": row["template_id"],
        "status": row["status"],
        "progress": row["progress"],
        "current_step": row["current_step"],
        "message": row["message"],
        "output_path": row["output_path"],
        "error": row["error"],
        "user_params": json.loads(row["user_params"]),
        "config": json.loads(row["config"]),
        "created_at": row["created_at"],
        "started_at": row["started_at"],
        "completed_at": row["completed_at"],
    }
