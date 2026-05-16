"""字幕生成 Skill - 从脚本生成 SRT 格式字幕"""

from app.skills.base import BaseSkill, SkillContext, SkillResult


class SubtitleGenSkill(BaseSkill):
    """字幕生成技能 - 根据脚本和时间轴生成 SRT"""

    @property
    def skill_id(self) -> str:
        return "subtitle-gen"

    async def execute(self, ctx: SkillContext) -> SkillResult:
        script = ctx.state.get("script", [])
        if not script:
            return SkillResult(success=True, data={"subtitles": [], "srt_content": ""})

        # 累计时间轴生成字幕
        subtitles = []
        current_time = 0.0
        idx = 1

        for scene in script:
            narration = scene.get("narration", "") or scene.get("text", "")
            duration = scene.get("duration", 3)
            if not narration:
                current_time += duration
                continue

            # 根据文本长度分段
            segments = self._split_text(narration, duration)
            seg_duration = duration / max(len(segments), 1)

            for seg in segments:
                start = current_time
                end = current_time + seg_duration
                subtitles.append({
                    "index": idx,
                    "start": start,
                    "end": end,
                    "start_str": self._format_time(start),
                    "end_str": self._format_time(end),
                    "text": seg.strip(),
                })
                current_time += seg_duration
                idx += 1

        # 生成 SRT 内容
        srt_lines = []
        for s in subtitles:
            srt_lines.append(str(s["index"]))
            srt_lines.append(f"{s['start_str']} --> {s['end_str']}")
            srt_lines.append(s["text"])
            srt_lines.append("")

        return SkillResult(success=True, data={
            "subtitles": subtitles,
            "srt_content": "\n".join(srt_lines),
        })

    @staticmethod
    def _split_text(text: str, duration: float) -> list[str]:
        """将文本按时间和语义分段"""
        # 按标点分割
        import re
        parts = re.split(r'[。！？，、；：\n]', text)
        parts = [p.strip() for p in parts if p.strip()]

        if not parts:
            return [text]

        # 估算每段时长（中文约3-5字/秒）
        max_chars = max(10, int(duration * 4))
        result = []
        current = ""

        for part in parts:
            if len(current) + len(part) <= max_chars:
                current += part
            else:
                if current:
                    result.append(current)
                current = part

        if current:
            result.append(current)

        return result or [text]

    @staticmethod
    def _format_time(seconds: float) -> str:
        """将秒数格式化为 SRT 时间格式 HH:MM:SS,mmm"""
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = int(seconds % 60)
        ms = int((seconds % 1) * 1000)
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
