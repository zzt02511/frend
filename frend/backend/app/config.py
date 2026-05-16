"""集中式配置管理 - 基于 pydantic-settings"""

from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # 应用基础
    app_name: str = "Frend - 短视频工厂"
    debug: bool = True

    # 路径
    data_dir: str = str(Path(__file__).parent.parent.parent / "data")
    templates_dir: str = str(Path(__file__).parent.parent.parent / "templates")
    skills_yaml_dir: str = str(Path(__file__).parent.parent / "skills_yaml")
    ffmpeg_templates_dir: str = str(Path(__file__).parent.parent / "ffmpeg_templates")

    # 服务器
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: list[str] = ["http://localhost:3000"]

    # 数据库 (PostgreSQL)
    database_url: str = "postgresql://postgres:123456@localhost:5432/frend"

    # 渲染限制
    max_concurrent_jobs: int = 2
    max_job_duration_seconds: int = 300
    max_asset_storage_mb: int = 500

    # FFmpeg
    ffmpeg_path: str = "ffmpeg"
    ffprobe_path: str = "ffprobe"

    model_config = {"env_prefix": "FREND_", "env_file": ".env"}


settings = Settings()
