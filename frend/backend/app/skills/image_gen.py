"""图像生成 Skill - AI 图像生成/搜索 (Phase 3 增强版)"""

import os
import hashlib
from typing import Optional

import httpx

from app.skills.base import BaseSkill, SkillContext, SkillResult
from app.config import settings


class ImageGenSkill(BaseSkill):
    """图像生成技能 - 根据场景描述生成或搜索配图，支持多种后端"""

    # 支持的供应商后端
    PROVIDER_PLACEHOLDER = "placeholder"  # 纯色占位图（无需 API）
    PROVIDER_DUMMY = "dummy"              # 在线占位图服务

    @property
    def skill_id(self) -> str:
        return "image-gen"

    async def execute(self, ctx: SkillContext) -> SkillResult:
        script: list[dict] = ctx.state.get("script", [])
        project_id: str = ctx.state.get("project_id", "unknown")
        template: dict = ctx.state.get("template", {})
        template_scenes: list[dict] = template.get("scenes", [])

        assets_dir = f"{settings.data_dir}/assets/{project_id}"
        os.makedirs(assets_dir, exist_ok=True)

        assets: list[dict] = []
        errors: list[str] = []

        for i, scene in enumerate(script):
            scene_id = scene.get("scene_id", f"scene_{i}")
            visual_desc = scene.get("visual_desc", "")

            # 判断此场景是否需要图像
            template_scene = template_scenes[i] if i < len(template_scenes) else {}
            has_image_element = any(
                el.get("type") == "image" for el in template_scene.get("elements", [])
            )
            if not has_image_element:
                # 无图像元素，跳过
                assets.append({
                    "scene_index": i,
                    "scene_id": scene_id,
                    "type": "none",
                    "path": "",
                    "description": visual_desc,
                })
                continue

            # 尝试生成/下载图像
            image_path = await self._fetch_image(
                prompt=visual_desc or scene.get("text", f"Scene {i}"),
                output_dir=assets_dir,
                filename=f"scene_{i}",
            )

            if image_path and os.path.exists(image_path):
                assets.append({
                    "scene_index": i,
                    "scene_id": scene_id,
                    "type": "image",
                    "path": os.path.abspath(image_path),
                    "description": visual_desc,
                    "file_size": os.path.getsize(image_path),
                })
            else:
                # 降级：生成纯色占位图
                placeholder = self._generate_placeholder(
                    output_dir=assets_dir,
                    filename=f"scene_{i}_placeholder",
                    width=600,
                    height=600,
                    color=self._get_scene_color(template_scene),
                )
                assets.append({
                    "scene_index": i,
                    "scene_id": scene_id,
                    "type": "placeholder",
                    "path": placeholder or "",
                    "description": visual_desc,
                })
                errors.append(f"场景 {scene_id} 图像获取失败，使用占位图")

        return SkillResult(
            success=True,
            data={"assets": assets},
            error="; ".join(errors) if errors else None,
        )

    # ------------------------------------------------------------------
    # 图像获取策略
    # ------------------------------------------------------------------

    async def _fetch_image(
        self,
        prompt: str,
        output_dir: str,
        filename: str,
    ) -> Optional[str]:
        """依次尝试各个图像后端，返回路径或 None"""
        # 1) 尝试 AI 图像生成（如果有 API 配置）
        api_key = settings.llm_api_key or os.getenv("IMAGE_GEN_API_KEY", "")
        api_url = os.getenv(
            "IMAGE_GEN_API_URL",
            "https://api.siliconflow.cn/v1/images/generations",
        )

        if api_key:
            try:
                return await self._generate_ai_image(
                    prompt=prompt,
                    api_url=api_url,
                    api_key=api_key,
                    output_dir=output_dir,
                    filename=filename,
                )
            except Exception:
                pass

        # 2) 降级：在线占位图
        try:
            return await self._fetch_dummy_image(
                prompt=prompt,
                output_dir=output_dir,
                filename=filename,
            )
        except Exception:
            pass

        return None

    async def _generate_ai_image(
        self,
        prompt: str,
        api_url: str,
        api_key: str,
        output_dir: str,
        filename: str,
    ) -> Optional[str]:
        """通过 AI 图像 API 生成图像"""
        # 增强提示词，适配短视频场景
        enhanced_prompt = (
            f"Short video scene, {prompt}, "
            f"vertical 9:16 style, clean composition, soft lighting, 4K"
        )

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                api_url,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "black-forest-labs/FLUX.1-schnell",
                    "prompt": enhanced_prompt,
                    "n": 1,
                    "size": "1024x1024",
                },
            )
            resp.raise_for_status()
            data = resp.json()

            # 解析返回的 image URL
            image_url = ""
            if "data" in data and len(data["data"]) > 0:
                image_url = data["data"][0].get("url", "")
            if not image_url:
                return None

            # 下载图像
            img_resp = await client.get(image_url)
            img_resp.raise_for_status()

            ext = self._detect_ext(img_resp.headers.get("content-type", ""))
            output_path = f"{output_dir}/{filename}{ext}"
            with open(output_path, "wb") as f:
                f.write(img_resp.content)
            return output_path

    async def _fetch_dummy_image(
        self,
        prompt: str,
        output_dir: str,
        filename: str,
    ) -> Optional[str]:
        """使用在线占位图服务"""
        # 用 prompt 的 hash 作为 seed
        seed = hashlib.md5(prompt.encode()).hexdigest()[:8]
        color = self._hash_to_color(seed)
        output_path = f"{output_dir}/{filename}.svg"

        svg_content = f"""<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
  <rect width="600" height="600" fill="{color}"/>
  <text x="300" y="300" text-anchor="middle" dy=".3em"
        font-family="sans-serif" font-size="18" fill="#ffffff" opacity="0.8">
    {prompt[:50]}
  </text>
</svg>"""
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(svg_content)
        return output_path

    @staticmethod
    def _generate_placeholder(
        output_dir: str,
        filename: str,
        width: int = 600,
        height: int = 600,
        color: str = "#1a1a2e",
    ) -> Optional[str]:
        """生成纯色 SVG 占位图"""
        try:
            output_path = f"{output_dir}/{filename}.svg"
            svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}">
  <rect width="{width}" height="{height}" fill="{color}"/>
</svg>"""
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(svg)
            return output_path
        except Exception:
            return None

    @staticmethod
    def _get_scene_color(template_scene: dict) -> str:
        """从模板场景中提取背景色"""
        for el in template_scene.get("elements", []):
            if el.get("type") == "background":
                return el.get("fill", "#1a1a2e")
        return "#1a1a2e"

    @staticmethod
    def _detect_ext(content_type: str) -> str:
        mapping = {
            "image/png": ".png",
            "image/jpeg": ".jpg",
            "image/jpg": ".jpg",
            "image/webp": ".webp",
        }
        return mapping.get(content_type.split(";")[0].strip(), ".png")

    @staticmethod
    def _hash_to_color(seed: str) -> str:
        """根据 hash 生成一个柔和的背景色"""
        h = hashlib.md5(seed.encode()).hexdigest()
        r = int(h[:2], 16) % 60 + 10
        g = int(h[2:4], 16) % 60 + 10
        b = int(h[4:6], 16) % 80 + 20
        return f"#{r:02x}{g:02x}{b:02x}"
