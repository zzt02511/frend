import tempfile
import unittest
from pathlib import Path

from ffmpeg_video_renderer import (
    build_ffmpeg_command,
    ffmpeg_available,
    render_status_when_ffmpeg_missing,
    write_srt,
)


def sample_plan():
    return {
        "projectId": "demo",
        "sourceTalkingVideo": "uploads/talking.mp4",
        "aspectRatio": "9:16",
        "segments": [
            {
                "id": "seg-001",
                "start": 0.0,
                "end": 3.2,
                "text": "装修选门别只看价格。",
                "keywords": ["装修", "选门"],
                "brollSlots": [],
            },
            {
                "id": "seg-002",
                "start": 3.2,
                "end": 6.4,
                "text": "还要看安装案例。",
                "keywords": ["安装", "案例"],
                "brollSlots": [],
            },
        ],
        "overlays": {"title": "装修选门别只看价格", "cta": "评论区回复户型", "progressBar": True},
        "render": {"output": "renders/final.mp4", "status": "draft"},
    }


class FFmpegVideoRendererTests(unittest.TestCase):
    def test_write_srt_uses_segment_times_and_chinese_text(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            srt_path = Path(tmpdir) / "captions" / "captions.srt"

            write_srt(sample_plan(), srt_path)

            content = srt_path.read_text(encoding="utf-8")
            self.assertIn("00:00:00,000 --> 00:00:03,200", content)
            self.assertIn("装修选门别只看价格。", content)
            self.assertIn("还要看安装案例。", content)

    def test_build_ffmpeg_command_contains_core_paths_and_vertical_scale(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            project_dir = Path(tmpdir)

            command = build_ffmpeg_command(sample_plan(), project_dir)

            joined_command = " ".join(command)
            self.assertEqual(command[0], "ffmpeg")
            self.assertIn("uploads/talking.mp4", joined_command)
            self.assertIn("captions/captions.srt", joined_command.replace("\\", "/"))
            self.assertIn("renders/final.mp4", joined_command.replace("\\", "/"))
            self.assertIn("scale=1080:1920", joined_command)

    def test_render_status_when_ffmpeg_missing_returns_explicit_json(self):
        command = ["missing-ffmpeg", "-i", "uploads/talking.mp4", "renders/final.mp4"]

        status = render_status_when_ffmpeg_missing(command)

        self.assertEqual(
            status,
            {
                "ok": False,
                "status": "missing_ffmpeg",
                "message": "未找到 FFmpeg，请先安装 FFmpeg 或配置 ffmpeg_path。",
                "command": command,
            },
        )

    def test_ffmpeg_available_returns_boolean_for_definitely_missing_binary(self):
        available = ffmpeg_available("definitely-missing-ffmpeg-binary-for-test")

        self.assertIsInstance(available, bool)
        self.assertFalse(available)


if __name__ == "__main__":
    unittest.main()
