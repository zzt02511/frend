"""FFmpeg 渲染 Skill - 全场景渲染流水线"""

import os
import time

from app.skills.base import BaseSkill, SkillContext, SkillResult
from app.utils.ffmpeg import (
    build_scene_command,
    build_concat_command,
    build_audio_mix_command,
    build_subtitle_command,
)
from app.utils.media import probe_file
from app.config import settings
from app.sandbox.local_sandbox import sandbox


class FFmpegRendererSkill(BaseSkill):
    """FFmpeg 渲染技能 - 逐场景渲染 → 拼接 → 音频混合 → 字幕烧录"""

    @property
    def skill_id(self) -> str:
        return "ffmpeg-renderer"

    async def execute(self, ctx: SkillContext) -> SkillResult:
        script: list[dict] = ctx.state.get("script", [])
        template: dict = ctx.state.get("template", {})
        template_scenes: list[dict] = template.get("scenes", [])
        project_id: str = ctx.state.get("project_id", "unknown")

        tts_audio: list[str] = ctx.state.get("tts_audio", [])
        assets: list[dict] = ctx.state.get("assets", [])
        subtitles_data: list[dict] = ctx.state.get("subtitles", [])

        video_config = template.get("video", {})
        width = video_config.get("width", 1080)
        height = video_config.get("height", 1920)
        fps = video_config.get("fps", 30)

        subtitles_config = template.get("subtitles", {})
        audio_config = template.get("audio", {})

        # 临时目录和输出目录
        temp_dir = f"{settings.data_dir}/temp/{project_id}"
        output_dir = f"{settings.data_dir}/output"
        os.makedirs(temp_dir, exist_ok=True)
        os.makedirs(output_dir, exist_ok=True)

        final_output = f"{output_dir}/{project_id}.mp4"
        scene_files: list[str] = []
        errors: list[str] = []

        try:
            # ========== Step 1: 逐场景渲染 ==========
            total_scenes = len(script)
            for i, scene in enumerate(script):
                scene_id = scene.get("scene_id", f"scene_{i}")
                scene_path = f"{temp_dir}/{scene_id}.mp4"
                duration = scene.get("duration", 5)

                # 获取对应的模板场景元素配置
                template_scene = template_scenes[i] if i < len(template_scenes) else {}
                bg_color = "#1a1a2e"
                text_content = scene.get("text", "")
                text_color = "#ffffff"
                text_size = 48
                image_path = ""

                # 从元素配置中提取样式
                for el in template_scene.get("elements", []):
                    el_type = el.get("type", "")
                    if el_type == "background":
                        bg_color = el.get("fill", bg_color)
                    elif el_type == "text":
                        text_content = text_content or el.get("content", "")
                        text_color = el.get("color", text_color)
                        text_size = el.get("font_size", text_size)
                    elif el_type == "image":
                        # 查找匹配场景的资产
                        for asset in assets:
                            if asset.get("scene_index") == i and asset.get("path"):
                                image_path = asset["path"]
                                break

                cmd = build_scene_command(
                    output_path=scene_path,
                    width=width,
                    height=height,
                    fps=fps,
                    duration=duration,
                    bg_color=bg_color,
                    text_content=text_content,
                    text_color=text_color,
                    text_size=text_size,
                    image_path=image_path,
                    transition=template_scene.get("transition", "fade_in"),
                    scene_index=i,
                )

                result = await sandbox.run_ffmpeg(cmd)
                if not result.success:
                    errors.append(f"场景 {scene_id} 渲染失败: {result.error}")
                    # 失败时生成占位场景
                    fallback_cmd = build_scene_command(
                        output_path=scene_path,
                        width=width, height=height, fps=fps,
                        duration=duration,
                        bg_color="#333333",
                        text_content=f"[渲染失败] {scene_id}",
                        text_color="#ff5252", text_size=36,
                    )
                    fallback_result = await sandbox.run_ffmpeg(fallback_cmd)
                    if not fallback_result.success:
                        errors.append(f"场景 {scene_id} 降级渲染也失败: {fallback_result.error}")
                        continue

                scene_files.append(scene_path)

                # 更新进度
                ctx.state["progress"] = 0.1 + (i + 1) / total_scenes * 0.4
                ctx.state["current_step"] = f"渲染场景 {i+1}/{total_scenes}"

            if not scene_files:
                return SkillResult(
                    success=False,
                    data={},
                    error="所有场景渲染失败",
                )

            # ========== Step 2: 拼接场景 ==========
            ctx.state["current_step"] = "拼接场景视频"
            ctx.state["progress"] = 0.55

            concat_output = f"{temp_dir}/concat.mp4"
            if len(scene_files) == 1:
                concat_output = scene_files[0]
            else:
                cmd = build_concat_command(scene_files, concat_output)
                result = await sandbox.run_ffmpeg(cmd)
                if not result.success:
                    errors.append(f"场景拼接失败: {result.error}")
                    # 尝试直接复制第一个场景
                    import shutil
                    shutil.copy(scene_files[0], concat_output)

            # ========== Step 3: 音频混合 ==========
            ctx.state["current_step"] = "混合音频"
            ctx.state["progress"] = 0.70

            mixed_output = f"{temp_dir}/mixed.mp4"
            has_tts = bool(tts_audio and any(os.path.exists(p) for p in tts_audio))
            bgm_path = ""
            bgm_param = ctx.state.get("user_params", {}).get("bgm", "")

            # 检查内置 BGM
            bgm_candidates = [
                f"{settings.data_dir}/bgm/{bgm_param}.mp3",
                f"{settings.data_dir}/bgm/{bgm_param}.wav",
            ]
            for bp in bgm_candidates:
                if os.path.exists(bp):
                    bgm_path = bp
                    break

            if has_tts or bgm_path:
                cmd = build_audio_mix_command(
                    video_path=concat_output,
                    tts_paths=[p for p in tts_audio if os.path.exists(p)],
                    bgm_path=bgm_path,
                    output_path=mixed_output,
                    bgm_volume=audio_config.get("bgm_volume", 0.3),
                )
                result = await sandbox.run_ffmpeg(cmd)
                if result.success:
                    current_video = mixed_output
                else:
                    errors.append(f"音频混合失败: {result.error}")
                    current_video = concat_output
            else:
                current_video = concat_output

            # ========== Step 4: 字幕烧录 ==========
            subtitle_enabled = subtitles_config.get("enabled", False)
            subtitle_output = f"{temp_dir}/subtitled.mp4"

            if subtitle_enabled and subtitles_data and self._generate_srt(subtitles_data, temp_dir, project_id):
                srt_path = f"{temp_dir}/{project_id}.srt"
                ctx.state["current_step"] = "烧录字幕"
                ctx.state["progress"] = 0.85

                cmd = build_subtitle_command(
                    video_path=current_video,
                    srt_path=srt_path,
                    output_path=subtitle_output,
                )
                result = await sandbox.run_ffmpeg(cmd)
                if result.success:
                    current_video = subtitle_output
                else:
                    errors.append(f"字幕烧录失败: {result.error}")
            else:
                # 无字幕，直接复制
                import shutil
                if current_video != final_output:
                    shutil.copy2(current_video, final_output)
                current_video = final_output

            # ========== Step 5: 最终复制到输出 ==========
            if current_video != final_output:
                import shutil
                shutil.copy2(current_video, final_output)

            # ========== 验证输出 ==========
            media_info = probe_file(final_output)
            if media_info is None or media_info.file_size_bytes == 0:
                return SkillResult(
                    success=False,
                    data={},
                    error="最终输出文件无效或为空",
                )

            ctx.state["output_path"] = final_output
            ctx.state["progress"] = 1.0
            ctx.state["current_step"] = "渲染完成"

            return SkillResult(
                success=True,
                data={
                    "output_path": final_output,
                    "file_size_bytes": media_info.file_size_bytes,
                    "duration_s": media_info.duration_s,
                    "width": media_info.width,
                    "height": media_info.height,
                    "fps": media_info.fps,
                    "scene_count": len(scene_files),
                    "has_audio": media_info.has_audio,
                    "warnings": errors,
                },
                error="; ".join(errors) if errors else None,
            )

        except Exception as e:
            return SkillResult(
                success=False,
                data={},
                error=f"渲染异常: {e}",
            )
        finally:
            # 清理临时文件（保留输出）
            self._cleanup_temp(temp_dir, keep_pattern=f"{project_id}.mp4")

    # ------------------------------------------------------------------
    # 内部方法
    # ------------------------------------------------------------------

    def _generate_srt(self, subtitles: list[dict], temp_dir: str, project_id: str) -> bool:
        """从字幕数据生成 SRT 文件"""
        if not subtitles:
            return False
        try:
            srt_path = f"{temp_dir}/{project_id}.srt"
            with open(srt_path, "w", encoding="utf-8") as f:
                for i, sub in enumerate(subtitles, 1):
                    start = sub.get("start", 0)
                    end = sub.get("end", start + 2)
                    text = sub.get("text", "")
                    f.write(f"{i}\n")
                    f.write(f"{self._format_srt_time(start)} --> {self._format_srt_time(end)}\n")
                    f.write(f"{text}\n\n")
            return os.path.getsize(srt_path) > 0
        except Exception:
            return False

    @staticmethod
    def _format_srt_time(seconds: float) -> str:
        """格式化 SRT 时间戳 HH:MM:SS,mmm"""
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = int(seconds % 60)
        ms = int((seconds - int(seconds)) * 1000)
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

    @staticmethod
    def _cleanup_temp(temp_dir: str, keep_pattern: str = ""):
        """清理临时目录，可选择保留特定文件"""
        if not os.path.exists(temp_dir):
            return
        for fname in os.listdir(temp_dir):
            if keep_pattern and keep_pattern in fname:
                continue
            fpath = os.path.join(temp_dir, fname)
            try:
                if os.path.isfile(fpath):
                    os.remove(fpath)
            except Exception:
                pass
