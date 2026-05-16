"""作业队列单元测试"""

import asyncio

import pytest

from app.sandbox.job_queue import JobQueue, JobStatus


@pytest.fixture
def q(test_db):
    return JobQueue(max_concurrent=4)


@pytest.mark.asyncio
async def test_enqueue(q):
    job = await q.enqueue("proj_001", "knowledge-short", {"topic": "test"})
    assert job["job_id"].startswith("job_")
    assert job["status"] == "queued"
    assert job["project_id"] == "proj_001"


@pytest.mark.asyncio
async def test_get_job_not_found(q):
    job = await q.get_job("nonexistent")
    assert job is None


@pytest.mark.asyncio
async def test_list_jobs(q):
    await q.enqueue("proj_001", "knowledge-short", {"topic": "A"})
    await q.enqueue("proj_002", "product-promo", {"topic": "B"})
    jobs = await q.list_jobs()
    assert len(jobs) >= 2


@pytest.mark.asyncio
async def test_update_progress(q):
    job = await q.enqueue("proj_001", "knowledge-short", {"topic": "test"})
    await q.update_progress(job["job_id"], 0.5, "script", "生成中")
    updated = await q.get_job(job["job_id"])
    assert updated["progress"] == 0.5
    assert updated["current_step"] == "script"
    assert updated["message"] == "生成中"


@pytest.mark.asyncio
async def test_set_status_completed(q):
    job = await q.enqueue("proj_001", "knowledge-short", {"topic": "test"})
    jid = job["job_id"]
    await q.set_status(jid, JobStatus.COMPLETED, output_path="/tmp/test.mp4")
    updated = await q.get_job(jid)
    assert updated["status"] == "completed"
    assert updated["output_path"] == "/tmp/test.mp4"
    assert updated["progress"] == 1.0


@pytest.mark.asyncio
async def test_set_status_failed(q):
    job = await q.enqueue("proj_001", "knowledge-short", {"topic": "test"})
    jid = job["job_id"]
    await q.set_status(jid, JobStatus.FAILED, error="渲染失败")
    updated = await q.get_job(jid)
    assert updated["status"] == "failed"
    assert "渲染失败" in updated["error"]


@pytest.mark.asyncio
async def test_set_status_cancelled(q):
    job = await q.enqueue("proj_001", "knowledge-short", {"topic": "test"})
    jid = job["job_id"]
    await q.set_status(jid, JobStatus.CANCELLED, error="用户取消")
    updated = await q.get_job(jid)
    assert updated["status"] == "cancelled"


@pytest.mark.asyncio
async def test_concurrent_acquire_release(q):
    a1 = await q.acquire("job_001")
    assert a1
    a2 = await q.acquire("job_002")
    assert a2
    q.release("job_001")
    a3 = await q.acquire("job_003")
    assert a3


@pytest.mark.asyncio
async def test_double_acquire_rejected(q):
    """mark_running 后重复 acquire 应拒绝"""
    assert await q.acquire("job_001")
    q.mark_running("job_001", asyncio.create_task(asyncio.sleep(1)))
    assert not await q.acquire("job_001")
    q.release("job_001")


@pytest.mark.asyncio
async def test_timeout_detection(q):
    from app.config import settings
    original = settings.max_job_duration_seconds
    settings.max_job_duration_seconds = -1
    try:
        q._started_at["test_job"] = 0
        assert q.is_timed_out("test_job")
    finally:
        settings.max_job_duration_seconds = original


@pytest.mark.asyncio
async def test_sse_subscribe_broadcast(q):
    job = await q.enqueue("proj_001", "knowledge-short", {"topic": "test"})
    jid = job["job_id"]
    queue = await q.subscribe(jid)
    await q._broadcast(jid, {"type": "progress", "job_id": jid, "progress": 0.5})
    msg = await queue.get()
    assert msg["type"] == "progress"
    assert msg["progress"] == 0.5
    q.unsubscribe(jid, queue)
    assert len(q._sse_queues.get(jid, [])) == 0


@pytest.mark.asyncio
async def test_retry_mechanism(q):
    """max_retries=2，前2次可重试，第3次不重试"""
    assert q.should_retry("job_001")
    q.record_retry("job_001")
    assert q.should_retry("job_001")
    q.record_retry("job_001")
    # 2 retries = max_retries, should NOT retry
    assert not q.should_retry("job_001")
