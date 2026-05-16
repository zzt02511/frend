"""Jinja2 模板环境 - 用于 FFmpeg 命令生成"""

import os
from pathlib import Path
from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.config import settings


def create_jinja2_env() -> Environment:
    """创建 Jinja2 环境，加载 FFmpeg 模板目录"""
    templates_dir = Path(settings.ffmpeg_templates_dir)
    templates_dir.mkdir(parents=True, exist_ok=True)

    env = Environment(
        loader=FileSystemLoader(str(templates_dir)),
        autoescape=select_autoescape([]),
        trim_blocks=True,
        lstrip_blocks=True,
    )
    return env


# 全局实例
jinja_env = create_jinja2_env()


def render_ffmpeg_template(template_name: str, **kwargs) -> str:
    """渲染 FFmpeg 模板"""
    template = jinja_env.get_template(template_name)
    return template.render(**kwargs)
