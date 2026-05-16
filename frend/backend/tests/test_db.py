"""数据库模块单元测试"""

import pytest

from app import db as database


@pytest.mark.asyncio
async def test_create_project():
    project = await database.create_project("knowledge-short", {"topic": "test"})
    assert project["project_id"].startswith("proj_")
    assert project["template_id"] == "knowledge-short"
    assert project["status"] == "draft"
    assert project["params"] == {"topic": "test"}


@pytest.mark.asyncio
async def test_get_project_not_found():
    project = await database.get_project("proj_nonexistent")
    assert project is None


@pytest.mark.asyncio
async def test_list_projects():
    await database.create_project("knowledge-short", {"topic": "A"})
    await database.create_project("product-promo", {"topic": "B"})
    projects = await database.list_projects()
    assert len(projects) >= 2


@pytest.mark.asyncio
async def test_update_project_status():
    project = await database.create_project("knowledge-short", {"topic": "test"})
    pid = project["project_id"]

    await database.update_project_status(pid, "rendering")
    updated = await database.get_project(pid)
    assert updated["status"] == "rendering"


@pytest.mark.asyncio
async def test_create_job():
    job = await database.create_job("proj_001", "knowledge-short", {"topic": "test"})
    assert job["job_id"].startswith("job_")
    assert job["status"] == "queued"
    assert job["progress"] == 0.0


@pytest.mark.asyncio
async def test_get_job():
    created = await database.create_job("proj_002", "knowledge-short", {"topic": "test"})
    fetched = await database.get_job(created["job_id"])
    assert fetched is not None
    assert fetched["job_id"] == created["job_id"]
    assert fetched["status"] == "queued"


@pytest.mark.asyncio
async def test_update_job_progress():
    job = await database.create_job("proj_003", "knowledge-short", {"topic": "test"})
    jid = job["job_id"]

    await database.update_job_progress(jid, 0.5, "script", "生成脚本中")
    updated = await database.get_job(jid)
    assert updated["progress"] == 0.5
    assert updated["current_step"] == "script"
    assert updated["message"] == "生成脚本中"


@pytest.mark.asyncio
async def test_update_job_status():
    job = await database.create_job("proj_004", "knowledge-short", {"topic": "test"})
    jid = job["job_id"]

    await database.update_job_status(jid, "running")
    assert (await database.get_job(jid))["status"] == "running"

    await database.update_job_status(jid, "completed", output_path="/tmp/test.mp4")
    updated = await database.get_job(jid)
    assert updated["status"] == "completed"
    assert updated["output_path"] == "/tmp/test.mp4"
    assert updated["progress"] == 1.0


@pytest.mark.asyncio
async def test_list_jobs():
    await database.create_job("proj_005", "knowledge-short", {"topic": "A"})
    await database.create_job("proj_006", "product-promo", {"topic": "B"})
    jobs = await database.list_jobs()
    assert len(jobs) >= 2


@pytest.mark.asyncio
async def test_job_with_config():
    cfg = {"data_dir": "/tmp", "resolution": "1080p"}
    job = await database.create_job("proj_007", "knowledge-short", {"topic": "test"}, config=cfg)
    assert job["config"] == cfg


@pytest.mark.asyncio
async def test_list_finished_jobs():
    """验证 list_finished_jobs 只返回已结束的作业"""
    running = await database.create_job("proj_008", "knowledge-short", {"topic": "test"})
    await database.update_job_status(running["job_id"], "running")

    completed = await database.create_job("proj_009", "knowledge-short", {"topic": "test"})
    await database.update_job_status(completed["job_id"], "completed")

    finished = await database.list_finished_jobs()
    jids = [j["job_id"] for j in finished]
    assert completed["job_id"] in jids
    assert running["job_id"] not in jids


@pytest.mark.asyncio
async def test_delete_jobs():
    job1 = await database.create_job("proj_010", "knowledge-short", {"topic": "A"})
    job2 = await database.create_job("proj_011", "knowledge-short", {"topic": "B"})
    await database.update_job_status(job1["job_id"], "completed")
    await database.update_job_status(job2["job_id"], "failed")

    deleted = await database.delete_jobs([job1["job_id"], job2["job_id"]])
    assert deleted == 2

    assert await database.get_job(job1["job_id"]) is None
    assert await database.get_job(job2["job_id"]) is None
