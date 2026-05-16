"""资产管理 Skill - 缓存/去重/清理 (Phase 3 增强版)"""

import os
import hashlib
import time
import json
import shutil
from pathlib import Path
from typing import Optional

from app.skills.base import BaseSkill, SkillContext, SkillResult
from app.config import settings


class AssetManagerSkill(BaseSkill):
    """资产管理技能 - 资产缓存、去重、生命周期管理、元数据索引"""

    CACHE_DB_NAME = "asset_cache.json"

    @property
    def skill_id(self) -> str:
        return "asset-manager"

    async def execute(self, ctx: SkillContext) -> SkillResult:
        project_id: str = ctx.state.get("project_id", "unknown")
        assets: list[dict] = ctx.state.get("assets", [])
        tts_audio: list[str] = ctx.state.get("tts_audio", [])
        output_path: str = ctx.state.get("output_path", "")

        stats = {
            "total_assets": len(assets),
            "total_tts": len(tts_audio),
            "cache_hits": 0,
            "disk_usage_bytes": 0,
        }

        # 1) 验证所有资产文件存在
        valid_assets = []
        for asset in assets:
            path = asset.get("path", "")
            if path and os.path.exists(path):
                valid_assets.append(asset)
                stats["disk_usage_bytes"] += os.path.getsize(path)
            elif path:
                # 文件缺失，记录警告
                ctx.state.setdefault("warnings", []).append(
                    f"资产文件缺失: {asset.get('scene_id', 'unknown')} -> {path}"
                )
        stats["valid_assets"] = len(valid_assets)

        # 2) 清理过期缓存
        cache_dir = f"{settings.data_dir}/cache"
        cleaned = self.clean_old_files(cache_dir, max_age_hours=24)
        stats["cleaned_files"] = cleaned

        # 3) 记录资产使用到元数据
        self._log_asset_usage(project_id, valid_assets, tts_audio, output_path)

        return SkillResult(
            success=True,
            data={
                "message": "资产管理完成",
                "valid_assets": valid_assets,
                "stats": stats,
            },
        )

    # ------------------------------------------------------------------
    # 文件缓存管理
    # ------------------------------------------------------------------

    @staticmethod
    def hash_file(filepath: str) -> str:
        """计算文件 SHA256"""
        h = hashlib.sha256()
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()

    @staticmethod
    def hash_bytes(data: bytes) -> str:
        """计算字节数据 SHA256"""
        return hashlib.sha256(data).hexdigest()

    @staticmethod
    def ensure_dir(path: str):
        os.makedirs(path, exist_ok=True)

    @staticmethod
    def clean_old_files(directory: str, max_age_hours: int = 24) -> int:
        """清理过期文件，返回清理数量"""
        if not os.path.isdir(directory):
            return 0
        now = time.time()
        count = 0
        for fname in os.listdir(directory):
            fpath = os.path.join(directory, fname)
            if os.path.isfile(fpath):
                age = now - os.path.getmtime(fpath)
                if age > max_age_hours * 3600:
                    try:
                        os.remove(fpath)
                        count += 1
                    except Exception:
                        pass
        return count

    # ------------------------------------------------------------------
    # 缓存读写
    # ------------------------------------------------------------------

    def get_cached_path(self, cache_key: str, ext: str = ".mp3") -> Optional[str]:
        """根据缓存键获取缓存文件路径（如果存在）"""
        cache_dir = f"{settings.data_dir}/cache"
        filename = f"{cache_key}{ext}"
        path = os.path.join(cache_dir, filename)
        return path if os.path.exists(path) else None

    def save_to_cache(self, cache_key: str, data: bytes, ext: str = ".mp3") -> str:
        """保存数据到缓存"""
        cache_dir = f"{settings.data_dir}/cache"
        os.makedirs(cache_dir, exist_ok=True)
        path = os.path.join(cache_dir, f"{cache_key}{ext}")
        with open(path, "wb") as f:
            f.write(data)
        return path

    # ------------------------------------------------------------------
    # 项目清理
    # ------------------------------------------------------------------

    @staticmethod
    def clean_project_temp(project_id: str):
        """清理项目的临时文件"""
        temp_dir = f"{settings.data_dir}/temp/{project_id}"
        if os.path.isdir(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)

        assets_dir = f"{settings.data_dir}/assets/{project_id}"
        if os.path.isdir(assets_dir):
            shutil.rmtree(assets_dir, ignore_errors=True)

    # ------------------------------------------------------------------
    # 内部方法
    # ------------------------------------------------------------------

    @staticmethod
    def _log_asset_usage(
        project_id: str,
        assets: list[dict],
        tts_audio: list[str],
        output_path: str,
    ):
        """记录资产使用情况到元数据文件"""
        meta_dir = f"{settings.data_dir}/meta"
        os.makedirs(meta_dir, exist_ok=True)
        meta_path = os.path.join(meta_dir, f"{project_id}.json")

        try:
            meta = {
                "project_id": project_id,
                "timestamp": time.time(),
                "asset_count": len(assets),
                "tts_count": len(tts_audio),
                "output_path": output_path,
                "assets": [
                    {
                        "scene_id": a.get("scene_id"),
                        "type": a.get("type"),
                        "file_size": a.get("file_size", 0),
                    }
                    for a in assets
                ],
            }
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump(meta, f, ensure_ascii=False, indent=2)
        except Exception:
            pass
