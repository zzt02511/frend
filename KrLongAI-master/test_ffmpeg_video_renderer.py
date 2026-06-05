import tempfile
import unittest
from pathlib import Path, PurePosixPath
from unittest.mock import patch

from ffmpeg_video_renderer import (
    build_ffmpeg_command,
    build_silence_trim_command,
    ffmpeg_available,
    parse_silence_intervals,
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

    def test_write_srt_removes_configured_filler_words(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            srt_path = Path(tmpdir) / "captions" / "captions.srt"
            plan = sample_plan()
            plan["cleanup"] = {"removeFillerWords": True}
            plan["segments"][0]["text"] = "Um this door, uh, has good detail."

            write_srt(plan, srt_path)

            content = srt_path.read_text(encoding="utf-8")
            self.assertIn("this door has good detail.", content)
            self.assertNotIn("Um", content)
            self.assertNotIn(" uh", content)

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

    def test_render_edit_plan_execute_false_includes_silence_trim_preprocess_command(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            project_dir = Path(tmpdir)
            plan = sample_plan()
            plan["cleanup"] = {"trimSilence": True, "silenceThreshold": "-35dB", "minimumSilence": 0.35}

            result = render_edit_plan(plan, project_dir, ffmpeg_path="ffmpeg", execute=False)

            self.assertEqual(result["status"], "command_ready")
            self.assertIn("preprocessCommand", result)
            self.assertIn("silencedetect", " ".join(result["preprocessCommand"]))
            self.assertEqual(
                result["command"][3].replace("\\", "/"),
                (project_dir / "processed" / "talking_trimmed.mp4").as_posix(),
            )
            self.assertEqual(result["preprocessedSource"].replace("\\", "/"), result["command"][3].replace("\\", "/"))

    def test_silence_trim_command_trims_audio_and_video_ranges(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            project_dir = Path(tmpdir)
            plan = sample_plan()
            plan["cleanup"] = {"trimSilence": True}

            command = build_silence_trim_command(plan, project_dir, "ffmpeg", [(1.0, 2.0)])

            joined = " ".join(command)
            self.assertIn("trim=start=0.00:end=1.00", joined)
            self.assertIn("atrim=start=0.00:end=1.00", joined)
            self.assertIn("trim=start=2.00", joined)
            self.assertIn("atrim=start=2.00", joined)
            self.assertIn("concat=n=2:v=1:a=1", joined)

    def test_parse_silence_intervals_reads_ffmpeg_silencedetect_output(self):
        log = "silence_start: 1.25\nsilence_end: 2.5 | silence_duration: 1.25\n"

        self.assertEqual(parse_silence_intervals(log), [(1.25, 2.5)])

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

    def test_build_ffmpeg_command_includes_precision_layers_when_plan_has_assets(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            project_dir = Path(tmpdir)
            plan = sample_plan()
            plan["materials"] = [
                {
                    "id": "asset-factory",
                    "name": "factory-check.mp4",
                    "url": "uploads/assets/factory-check.mp4",
                    "type": "video",
                    "tags": ["factory"],
                    "notes": "",
                }
            ]
            plan["segments"][1]["brollSlots"] = [
                {"startOffset": 0.4, "duration": 2.0, "assetId": "asset-factory", "reason": "factory"}
            ]
            plan["audio"] = {"bgmPath": "uploads/bgm/light.mp3"}

            command = build_ffmpeg_command(plan, project_dir=project_dir, ffmpeg_path="ffmpeg")

            joined = " ".join(command).replace("\\", "/")
            self.assertIn("uploads/assets/factory-check.mp4", joined)
            self.assertIn("uploads/bgm/light.mp3", joined)
            self.assertIn("-filter_complex", command)
            self.assertIn("drawtext", joined)
            self.assertIn("overlay", joined)
            self.assertIn("volume=0.18", joined)
            self.assertIn("progress", joined)
            self.assertIn("-map", command)

    def test_build_ffmpeg_command_trims_and_shifts_broll_onto_timeline(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            project_dir = Path(tmpdir)
            plan = sample_plan()
            plan["materials"] = [{"id": "asset-case", "url": "uploads/assets/case.mp4", "type": "video"}]
            plan["segments"][1]["brollSlots"] = [
                {"startOffset": 0.4, "duration": 2.0, "assetId": "asset-case", "reason": "case"}
            ]

            command = build_ffmpeg_command(plan, project_dir=project_dir)

            joined = " ".join(command)
            self.assertIn("trim=duration=2.00", joined)
            self.assertIn("setpts=PTS-STARTPTS+3.60/TB", joined)
            self.assertIn("overlay=0:0:enable='between(t,3.60,5.60)'", joined)

    def test_build_ffmpeg_command_escapes_percent_in_drawtext(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            project_dir = Path(tmpdir)
            plan = sample_plan()
            plan["overlays"]["title"] = "100% offer"
            plan["overlays"]["cta"] = "save 20%"

            command = build_ffmpeg_command(plan, project_dir=project_dir)

            joined = " ".join(command)
            self.assertIn("100\\% offer", joined)
            self.assertIn("save 20\\%", joined)
            self.assertNotIn("100% offer", joined)

    def test_build_ffmpeg_command_uses_optional_audio_map_without_bgm(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            project_dir = Path(tmpdir)

            command = build_ffmpeg_command(sample_plan(), project_dir=project_dir)

            map_indices = [index for index, value in enumerate(command) if value == "-map"]
            mapped_values = [command[index + 1] for index in map_indices]
            self.assertIn("0:a?", mapped_values)

    def test_build_ffmpeg_command_uses_timeline_safe_progress_bar(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            project_dir = Path(tmpdir)

            command = build_ffmpeg_command(sample_plan(), project_dir=project_dir)

            joined = " ".join(command)
            self.assertIn("drawbox", joined)
            self.assertIn("enable='gte(t,", joined)
            self.assertNotIn("w*t/duration", joined)

    def test_build_cover_command_exports_cover_frame(self):
        from ffmpeg_video_renderer import build_cover_command

        with tempfile.TemporaryDirectory() as tmpdir:
            project_dir = Path(tmpdir)

            command = build_cover_command(sample_plan(), project_dir=project_dir, ffmpeg_path="ffmpeg")

            joined = " ".join(command).replace("\\", "/")
            self.assertEqual(command[0], "ffmpeg")
            self.assertIn("-ss", command)
            self.assertIn("uploads/talking.mp4", joined)
            self.assertIn("renders/cover.jpg", joined)
            self.assertIn("drawtext", joined)

    def test_render_edit_plan_exports_cover_after_successful_render(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            project_dir = Path(tmpdir)
            completed = type("Completed", (), {"returncode": 0, "stdout": "ok\n", "stderr": ""})()

            with patch("ffmpeg_video_renderer.ffmpeg_available", return_value=True), patch(
                "ffmpeg_video_renderer.subprocess.run", return_value=completed
            ) as run:
                result = render_edit_plan(sample_plan(), project_dir)

            self.assertTrue(result["ok"])
            self.assertEqual(result["status"], "done")
            self.assertIn("coverCommand", result)
            self.assertIn("cover", result)
            self.assertEqual(run.call_count, 2)
            log_text = (project_dir / "logs" / "ffmpeg.log").read_text(encoding="utf-8")
            self.assertIn("# cover", log_text)

    def test_render_edit_plan_returns_cover_returncode_when_cover_launch_errors(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            project_dir = Path(tmpdir)
            completed = type("Completed", (), {"returncode": 0, "stdout": "ok\n", "stderr": ""})()

            with patch("ffmpeg_video_renderer.ffmpeg_available", return_value=True), patch(
                "ffmpeg_video_renderer.subprocess.run", side_effect=[completed, OSError("cover launch failed")]
            ):
                result = render_edit_plan(sample_plan(), project_dir)

            self.assertFalse(result["ok"])
            self.assertEqual(result["status"], "failed")
            self.assertIsNone(result["coverReturncode"])
            self.assertIn("coverCommand", result)
            self.assertIn("cover", result)


if __name__ == "__main__":
    unittest.main()
