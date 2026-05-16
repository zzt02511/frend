"""pytest 配置 - 使用临时 SQLite 文件进行测试"""

import asyncio
import os
import sys
import tempfile
from pathlib import Path
from typing import Generator

import pytest

# 确保 app 包可导入
sys.path.insert(0, str(Path(__file__).parent.parent))


@pytest.fixture(scope="session")
def event_loop():
    """为整个 session 使用同一个事件循环"""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function")
def test_db():
    """每个测试函数使用独立的临时 SQLite 数据库"""
    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.close()
    db_path = tmp.name.replace("\\", "/")

    # 覆盖 settings 中的 db_path
    from app.config import settings
    original_path = settings.db_path
    settings.db_path = db_path

    # 同步初始化数据库
    import sqlite3
    from app.db import _init_db
    _init_db()

    yield db_path

    # 清理
    settings.db_path = original_path
    try:
        os.unlink(db_path)
    except OSError:
        pass
