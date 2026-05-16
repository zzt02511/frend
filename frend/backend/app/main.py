"""Frend - FastAPI 应用入口"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    import os

    # 1. 初始化 PostgreSQL 数据库
    from app import db as database
    await database.init_db()

    # 2. 确保数据目录存在
    dirs = [
        f"{settings.data_dir}/assets/images",
        f"{settings.data_dir}/assets/audio",
        f"{settings.data_dir}/assets/fonts",
        f"{settings.data_dir}/projects",
        f"{settings.data_dir}/output",
        f"{settings.data_dir}/cache",
    ]
    for d in dirs:
        os.makedirs(d, exist_ok=True)

    # 3. 注册技能到注册表
    from app.skills.registry import registry
    from app.skills.template_parser import TemplateParserSkill
    from app.skills.script_writer import ScriptWriterSkill
    from app.skills.image_gen import ImageGenSkill
    from app.skills.tts_speaker import TTSSpeakerSkill
    from app.skills.subtitle_gen import SubtitleGenSkill
    from app.skills.ffmpeg_renderer import FFmpegRendererSkill
    from app.skills.asset_manager import AssetManagerSkill

    registry.load_all_yaml_defs()
    for skill in [
        TemplateParserSkill(),
        ScriptWriterSkill(),
        ImageGenSkill(),
        TTSSpeakerSkill(),
        SubtitleGenSkill(),
        FFmpegRendererSkill(),
        AssetManagerSkill(),
    ]:
        registry.register(skill)

    print(f"[Frend] 已注册 {len(registry.list_skills())} 个技能")
    print(f"[Frend] 已加载 {len(registry.list_yaml_defs())} 个 YAML 定义")

    # 4. 启动作业队列后台任务
    from app.sandbox.job_queue import job_queue
    job_queue.start_cleanup()

    # 5. 启动超时检测循环
    import asyncio

    async def _timeout_check_loop():
        while True:
            try:
                await asyncio.sleep(15)
                await job_queue.check_timeouts()
            except asyncio.CancelledError:
                break
            except Exception:
                pass

    timeout_task = asyncio.create_task(_timeout_check_loop())

    yield

    # 清理
    timeout_task.cancel()
    job_queue.stop_cleanup()
    await database.close_pool()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 路由
app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "app": settings.app_name}
