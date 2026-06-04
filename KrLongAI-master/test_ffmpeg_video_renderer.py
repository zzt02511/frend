import tempfile
import unittest
from pathlib import Path, PurePosixPath
from unittest.mock import patch

from ffmpeg_video_renderer import (
    build_ffmpeg_command,
    ffmpeg_available,
    render_edit_plan,
    render_status_when_ffmpeg_missing,
    resolve_project_path,
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

    def test_build_ffmpeg_command_treats_leading_slash_paths_as_project_relative(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            project_dir = Path(tmpdir)
            plan = sample_plan()
            plan["sourceTalkingVideo"] = "/videos/talking.mp4"
            plan["render"]["output"] = "/renders/final.mp4"

            command = build_ffmpeg_command(plan, project_dir)

            self.assertEqual(command[3], (project_dir / "videos" / "talking.mp4").as_posix())
            self.assertEqual(command[-1], (project_dir / "renders" / "final.mp4").as_posix())

    def test_resolve_project_path_preserves_posix_absolute_paths(self):
        with patch("ffmpeg_video_renderer.Path", PurePosixPath):
            path = resolve_project_path("/tmp/talking.mp4", PurePosixPath("/project"), "uploads/talking.mp4")

        self.assertEqual(path, PurePosixPath("/tmp/talking.mp4"))

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

    def test_render_edit_plan_writes_missing_ffmpeg_log(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            project_dir = Path(tmpdir)

            result = render_edit_plan(
                sample_plan(),
                project_dir,
                ffmpeg_path="definitely-missing-ffmpeg-binary-for-test",
            )

            log_path = project_dir / "logs" / "ffmpeg.log"
            self.assertEqual(result["status"], "missing_ffmpeg")
            self.assertTrue(log_path.exists())
            self.assertIn("missing_ffmpeg", log_path.read_text(encoding="utf-8"))

    def test_render_edit_plan_execute_false_returns_command_without_subprocess(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            project_dir = Path(tmpdir)

            with patch("ffmpeg_video_renderer.ffmpeg_available", return_value=False), patch(
                "ffmpeg_video_renderer.subprocess.run"
            ) as run:
                result = render_edit_plan(sample_plan(), project_dir, execute=False)

            self.assertEqual(result["status"], "command_ready")
            self.assertIn("command", result)
            run.assert_not_called()

    def test_render_edit_plan_returns_done_payload_after_successful_subprocess(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            project_dir = Path(tmpdir)
            completed = type(
                "Completed",
                (),
                {"returncode": 0, "stdout": "encoded ok\n", "stderr": ""},
            )()

            with patch("ffmpeg_video_renderer.ffmpeg_available", return_value=True), patch(
                "ffmpeg_video_renderer.subprocess.run", return_value=completed
            ):
                result = render_edit_plan(sample_plan(), project_dir)

            self.assertTrue(result["ok"])
            self.assertEqual(result["status"], "done")
            self.assertEqual(result["returncode"], 0)
            self.assertIn("encoded ok", (project_dir / "logs" / "ffmpeg.log").read_text(encoding="utf-8"))

    def test_render_edit_plan_returns_failed_payload_after_subprocess_failure(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            project_dir = Path(tmpdir)
            completed = type(
                "Completed",
                (),
                {"returncode": 1, "stdout": "", "stderr": "bad input\n"},
            )()

            with patch("ffmpeg_video_renderer.ffmpeg_available", return_value=True), patch(
                "ffmpeg_video_renderer.subprocess.run", return_value=completed
            ):
                result = render_edit_plan(sample_plan(), project_dir)

            self.assertFalse(result["ok"])
            self.assertEqual(result["status"], "failed")
            self.assertEqual(result["returncode"], 1)
            self.assertIn("bad input", (project_dir / "logs" / "ffmpeg.log").read_text(encoding="utf-8"))

    def test_render_edit_plan_returns_failed_payload_when_ffmpeg_launch_errors(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            project_dir = Path(tmpdir)

            with patch("ffmpeg_video_renderer.ffmpeg_available", return_value=True), patch(
                "ffmpeg_video_renderer.subprocess.run", side_effect=OSError("not executable")
            ):
                result = render_edit_plan(sample_plan(), project_dir, ffmpeg_path="broken-ffmpeg")

            self.assertFalse(result["ok"])
            self.assertEqual(result["status"], "failed")
            self.assertEqual(result["returncode"], None)
            self.assertIn("not executable", (project_dir / "logs" / "ffmpeg.log").read_text(encoding="utf-8"))

    def test_render_edit_plan_returns_failed_payload_for_unsupported_url_paths(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            project_dir = Path(tmpdir)
            plan = sample_plan()
            plan["sourceTalkingVideo"] = "https://example.com/videos/talking.mp4"

            result = render_edit_plan(plan, project_dir)

            log_text = (project_dir / "logs" / "ffmpeg.log").read_text(encoding="utf-8")
            self.assertFalse(result["ok"])
            self.assertEqual(result["status"], "failed")
            self.assertIn("Unsupported URL media path", result["message"])
            self.assertIn("Unsupported URL media path", log_text)

    def test_render_edit_plan_returns_failed_payload_for_unsupported_output_url_paths(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            project_dir = Path(tmpdir)
            plan = sample_plan()
            plan["render"]["output"] = "https://example.com/renders/final.mp4"

            result = render_edit_plan(plan, project_dir)

            log_text = (project_dir / "logs" / "ffmpeg.log").read_text(encoding="utf-8")
            self.assertFalse(result["ok"])
            self.assertEqual(result["status"], "failed")
            self.assertIn("Unsupported URL media path", result["message"])
            self.assertIn("Unsupported URL media path", log_text)


if __name__ == "__main__":
    unittest.main()
