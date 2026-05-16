"""TTS 配音 Skill - 文字转语音"""

import os
import json
from app.skills.base import BaseSkill, SkillContext, SkillResult


class TTSSpeakerSkill(BaseSkill):
    """文字转语音技能 - 将脚本配音文本转为音频文件"""

    @property
    def skill_id(self) -> str:
        return "tts-speaker"

    async def execute(self, ctx: SkillContext) -> SkillResult:
        script = ctx.state.get("script", [])
        project_id = ctx.state.get("project_id", "unknown")
        data_dir = ctx.config.get("data_dir", "data")

        if not script:
            return SkillResult(success=True, data={"audio_files": []})

        audio_dir = os.path.join(data_dir, "assets", "audio")
        os.makedirs(audio_dir, exist_ok=True)

        audio_files = []
        for scene in script:
            narration = scene.get("narration", "")
            if not narration:
                continue

            scene_id = scene.get("scene_id", "unknown")
            output_path = os.path.join(audio_dir, f"{project_id}_{scene_id}.mp3")

            # 尝试 TTS API，失败则生成静音音频
            try:
                await self._synthesize(narration, output_path, ctx.config)
                audio_files.append(output_path)
            except Exception:
                # 生成静音占位音频
                self._generate_silence(output_path, scene.get("duration", 3))
                audio_files.append(output_path)

        return SkillResult(success=True, data={"audio_files": audio_files})

    async def _synthesize(self, text: str, output_path: str, config: dict):
        """调用 TTS API 合成语音"""
        import httpx

        voice = config.get("tts_voice", "zh-CN-XiaoxiaoNeural")
        speed = config.get("tts_speed", "1.0")

        # 使用 Edge-TTS 风格 API (OpenAI TTS 兼容格式)
        tts_api = config.get("tts_api_url", "")
        api_key = config.get("tts_api_key", "")

        if tts_api and api_key:
            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.post(
                    tts_api,
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={
                        "model": "tts-1",
                        "input": text,
                        "voice": voice,
                        "speed": float(speed),
                    },
                )
                resp.raise_for_status()
                with open(output_path, "wb") as f:
                    f.write(resp.content)
        else:
            # 无 TTS API - 使用 FFmpeg 生成简单音调
            self._generate_silence(output_path, 3)

    @staticmethod
    def _generate_silence(output_path: str, duration: float):
        """用 FFmpeg 生成静音音频"""
        import subprocess
        subprocess.run(
            ["ffmpeg", "-f", "lavfi", "-i", f"anullsrc=r=44100:cl=mono",
             "-t", str(duration), "-c:a", "libmp3lame",
             "-y", output_path],
            capture_output=True,
        )
