import base64
import json
import subprocess
import tempfile
import threading
import unittest
import urllib.request
import zipfile
from http.server import ThreadingHTTPServer
from pathlib import Path

import custom_home_server
import video_pipeline
from cloud_runtime_client import CloudRuntimeSettings
from video_pipeline import DoubaoTTSRequest


def create_ffmpeg_smoke_assets(ffmpeg: str, temp: Path) -> tuple[Path, Path, Path]:
    background = temp / "bg.png"
    avatar = temp / "avatar.mp4"
    voice = temp / "voice.mp3"
    subprocess.run(
        [ffmpeg, "-y", "-f", "lavfi", "-i", "color=c=0x4b6b57:s=360x640:d=2", "-frames:v", "1", str(background)],
        check=True,
        capture_output=True,
        text=True,
    )
    subprocess.run(
        [
            ffmpeg,
            "-y",
            "-f",
            "lavfi",
            "-i",
            "color=c=0xd9b58a:s=180x320:d=2",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            str(avatar),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    subprocess.run(
        [ffmpeg, "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-c:a", "libmp3lame", str(voice)],
        check=True,
        capture_output=True,
        text=True,
    )
    return background, avatar, voice


def create_bgm_asset(ffmpeg: str, temp: Path) -> Path:
    bgm = temp / "bgm.mp3"
    subprocess.run(
        [ffmpeg, "-y", "-f", "lavfi", "-i", "sine=frequency=880:duration=2", "-c:a", "libmp3lame", str(bgm)],
        check=True,
        capture_output=True,
        text=True,
    )
    return bgm


class VideoPipelineTests(unittest.TestCase):
    def test_build_doubao_tts_payload_uses_voice_and_text(self):
        request = DoubaoTTSRequest(
            text="生成一段门店口播",
            voice_type="zh_female_test",
            api_key="test-key",
            resource_id="seed-tts-2.0",
        )

        payload = video_pipeline.build_doubao_tts_payload(request)

        self.assertEqual(payload["audio"]["voice_type"], "zh_female_test")
        self.assertEqual(payload["audio"]["encoding"], "mp3")
        self.assertEqual(payload["request"]["text"], "生成一段门店口播")
        self.assertEqual(payload["request"]["operation"], "query")

    def test_json_audio_extractor_accepts_streaming_base64_events(self):
        audio = b"fake-mp3-bytes"
        event = {"data": {"audio": base64.b64encode(audio).decode("ascii")}}
        raw = ("data: " + json.dumps(event) + "\n\n").encode("utf-8")

        parsed = video_pipeline._json_objects_from_bytes(raw)
        chunks = []
        for item in parsed:
            chunks.extend(video_pipeline._find_base64_audio(item))

        self.assertEqual(base64.b64decode(chunks[0]), audio)

    def test_generate_doubao_tts_audio_saves_local_file(self):
        old_asset_dir = video_pipeline.ASSET_DIR
        old_request = video_pipeline.request_doubao_tts
        with tempfile.TemporaryDirectory(dir=video_pipeline.ROOT) as temp_dir:
            video_pipeline.ASSET_DIR = Path(temp_dir)

            def fake_request(request, timeout=120):
                self.assertEqual(request.resource_id, "seed-tts-2.0")
                self.assertEqual(request.voice_type, "zh_female_test")
                return b"audio-bytes", {"payload": {"ok": True}, "content_type": "audio/mpeg"}

            video_pipeline.request_doubao_tts = fake_request
            try:
                result = video_pipeline.generate_doubao_tts_audio(
                    {"text": "测试口播", "project": "demo"},
                    CloudRuntimeSettings(
                        voice_api_key="secret",
                        voice_id="zh_female_test",
                        voice_app_id="seed-tts-2.0",
                        voice_submit_url="https://example.test/tts",
                    ),
                )
            finally:
                video_pipeline.request_doubao_tts = old_request
                video_pipeline.ASSET_DIR = old_asset_dir

        self.assertTrue(result["ok"])
        self.assertEqual(result["provider"], "doubao_tts_v3")
        self.assertEqual(result["file"]["size"], len(b"audio-bytes"))

    def test_compose_reports_missing_ffmpeg(self):
        old_ffmpeg_path = video_pipeline.ffmpeg_path
        video_pipeline.ffmpeg_path = lambda: None
        try:
            result = video_pipeline.compose_with_ffmpeg({})
        finally:
            video_pipeline.ffmpeg_path = old_ffmpeg_path

        self.assertFalse(result["ok"])
        self.assertIn("FFmpeg", result["error"])

    def test_list_pipeline_outputs_returns_recent_videos(self):
        old_output_dir = video_pipeline.OUTPUT_DIR
        with tempfile.TemporaryDirectory(dir=video_pipeline.ROOT) as temp_dir:
            video_pipeline.OUTPUT_DIR = Path(temp_dir)
            project = video_pipeline.OUTPUT_DIR / "demo-output"
            project.mkdir()
            video = project / "demo.mp4"
            subtitle = project / "subtitles.srt"
            manifest = project / "manifest.json"
            video.write_bytes(b"fake-video")
            subtitle.write_text("1\n00:00:00,000 --> 00:00:01,000\nhello\n", encoding="utf-8")
            manifest.write_text(json.dumps({"title": "Demo title", "script": "hello", "aspect_ratio": "9:16"}), encoding="utf-8")
            try:
                rows = video_pipeline.list_pipeline_outputs()
            finally:
                video_pipeline.OUTPUT_DIR = old_output_dir

        self.assertEqual(rows[0]["name"], "demo-output")
        self.assertEqual(rows[0]["title"], "Demo title")
        self.assertEqual(rows[0]["aspectRatio"], "9:16")
        self.assertEqual(rows[0]["video"]["name"], "demo.mp4")
        self.assertEqual(rows[0]["subtitle"]["name"], "subtitles.srt")
        self.assertEqual(rows[0]["manifest"]["name"], "manifest.json")

    def test_probe_media_reads_video_dimensions_and_audio(self):
        ffmpeg = video_pipeline.ffmpeg_path()
        if not ffmpeg or not video_pipeline.ffprobe_path():
            self.skipTest("FFmpeg/FFprobe runtime is not installed")

        with tempfile.TemporaryDirectory(dir=video_pipeline.ROOT) as temp_dir:
            temp = Path(temp_dir)
            output = temp / "probe.mp4"
            subprocess.run(
                [
                    ffmpeg,
                    "-y",
                    "-f",
                    "lavfi",
                    "-i",
                    "color=c=0x4b6b57:s=320x240:d=1",
                    "-f",
                    "lavfi",
                    "-i",
                    "sine=frequency=440:duration=1",
                    "-shortest",
                    "-c:v",
                    "libx264",
                    "-pix_fmt",
                    "yuv420p",
                    "-c:a",
                    "aac",
                    str(output),
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            media = video_pipeline.probe_media(output)

        self.assertEqual(media["width"], 320)
        self.assertEqual(media["height"], 240)
        self.assertTrue(media["hasAudio"])
        self.assertGreater(media["duration"], 0)

    def test_delete_pipeline_output_removes_only_named_output_dir(self):
        old_output_dir = video_pipeline.OUTPUT_DIR
        with tempfile.TemporaryDirectory(dir=video_pipeline.ROOT) as temp_dir:
            video_pipeline.OUTPUT_DIR = Path(temp_dir)
            project = video_pipeline.OUTPUT_DIR / "delete-me"
            project.mkdir()
            (project / "demo.mp4").write_bytes(b"fake-video")
            try:
                result = video_pipeline.delete_pipeline_output("delete-me")
            finally:
                video_pipeline.OUTPUT_DIR = old_output_dir

        self.assertTrue(result["ok"])
        self.assertTrue(result["deleted"])
        self.assertFalse(project.exists())

    def test_build_pipeline_output_zip_packages_delivery_files(self):
        old_output_dir = video_pipeline.OUTPUT_DIR
        with tempfile.TemporaryDirectory(dir=video_pipeline.ROOT) as temp_dir:
            video_pipeline.OUTPUT_DIR = Path(temp_dir)
            project = video_pipeline.OUTPUT_DIR / "zip-me"
            project.mkdir()
            (project / "demo.mp4").write_bytes(b"video")
            (project / "subtitles.srt").write_text("subtitle", encoding="utf-8")
            (project / "manifest.json").write_text("{}", encoding="utf-8")
            (project / "ignore.tmp").write_text("ignore", encoding="utf-8")
            try:
                zip_path, error = video_pipeline.build_pipeline_output_zip("zip-me")
                self.assertFalse(error)
                with zipfile.ZipFile(zip_path) as archive:
                    names = set(archive.namelist())
            finally:
                video_pipeline.OUTPUT_DIR = old_output_dir

        self.assertEqual(names, {"demo.mp4", "subtitles.srt", "manifest.json"})

    def test_compose_with_ffmpeg_creates_playable_mp4_when_runtime_exists(self):
        ffmpeg = video_pipeline.ffmpeg_path()
        if not ffmpeg:
            self.skipTest("FFmpeg runtime is not installed")

        old_output_dir = video_pipeline.OUTPUT_DIR
        with tempfile.TemporaryDirectory(dir=video_pipeline.ROOT) as temp_dir:
            temp = Path(temp_dir)
            video_pipeline.OUTPUT_DIR = temp / "outputs"
            background, avatar, voice = create_ffmpeg_smoke_assets(ffmpeg, temp)

            try:
                result = video_pipeline.compose_with_ffmpeg(
                    {
                        "name": "compose-smoke",
                        "script": "这是一次真实 FFmpeg 合成验证。",
                        "aspect_ratio": "9:16",
                        "background": {"url": "/" + background.relative_to(video_pipeline.ROOT).as_posix()},
                        "avatar_video": {"url": "/" + avatar.relative_to(video_pipeline.ROOT).as_posix()},
                        "voice": {"url": "/" + voice.relative_to(video_pipeline.ROOT).as_posix()},
                    }
                )
            finally:
                video_pipeline.OUTPUT_DIR = old_output_dir

        self.assertTrue(result["ok"], result.get("error"))
        self.assertGreater(result["file"]["size"], 0)
        self.assertEqual(result["file"]["url"].split("/")[-1].split(".")[-1], "mp4")
        self.assertEqual(result["manifest"]["name"], "manifest.json")
        self.assertEqual(result["media"]["width"], 1080)
        self.assertEqual(result["media"]["height"], 1920)
        self.assertTrue(result["media"]["hasAudio"])

    def test_compose_with_ffmpeg_can_mix_optional_bgm(self):
        ffmpeg = video_pipeline.ffmpeg_path()
        if not ffmpeg:
            self.skipTest("FFmpeg runtime is not installed")

        old_output_dir = video_pipeline.OUTPUT_DIR
        with tempfile.TemporaryDirectory(dir=video_pipeline.ROOT) as temp_dir:
            temp = Path(temp_dir)
            video_pipeline.OUTPUT_DIR = temp / "outputs"
            background, avatar, voice = create_ffmpeg_smoke_assets(ffmpeg, temp)
            bgm = create_bgm_asset(ffmpeg, temp)
            try:
                result = video_pipeline.compose_with_ffmpeg(
                    {
                        "name": "compose-bgm-smoke",
                        "script": "BGM mix smoke.",
                        "aspect_ratio": "9:16",
                        "background": {"url": "/" + background.relative_to(video_pipeline.ROOT).as_posix()},
                        "avatar_video": {"url": "/" + avatar.relative_to(video_pipeline.ROOT).as_posix()},
                        "voice": {"url": "/" + voice.relative_to(video_pipeline.ROOT).as_posix()},
                        "bgm": {"url": "/" + bgm.relative_to(video_pipeline.ROOT).as_posix()},
                        "bgm_volume": 0.12,
                    }
                )
                manifest = json.loads((video_pipeline.OUTPUT_DIR / "compose-bgm-smoke" / "manifest.json").read_text(encoding="utf-8"))
            finally:
                video_pipeline.OUTPUT_DIR = old_output_dir

        self.assertTrue(result["ok"], result.get("error"))
        self.assertTrue(result["media"]["hasAudio"])
        self.assertEqual(manifest["bgm"]["url"], "/" + bgm.relative_to(video_pipeline.ROOT).as_posix())
        self.assertEqual(manifest["bgm_volume"], 0.12)

    def test_avatar_pipeline_task_records_submit_result(self):
        old_task_dir = video_pipeline.TASK_DIR
        with tempfile.TemporaryDirectory(dir=video_pipeline.ROOT) as temp_dir:
            video_pipeline.TASK_DIR = Path(temp_dir)
            try:
                record = video_pipeline.record_avatar_pipeline_task(
                    {"name": "demo", "script": "hello"},
                    {
                        "ok": True,
                        "provider": "duix_api",
                        "endpoint": "https://example.test/submit",
                        "task_id": "task-123",
                        "video_url": "",
                        "response": {"code": 0},
                    },
                )
                rows = video_pipeline.list_avatar_pipeline_tasks()
            finally:
                video_pipeline.TASK_DIR = old_task_dir

        self.assertEqual(record["task_id"], "task-123")
        self.assertEqual(record["status"], "submitted")
        self.assertEqual(rows[0]["task_id"], "task-123")
        self.assertEqual(rows[0]["project"], "demo")

    def test_refresh_avatar_pipeline_task_updates_status_and_video_url(self):
        old_task_dir = video_pipeline.TASK_DIR
        old_query = video_pipeline.query_avatar_pipeline_task
        with tempfile.TemporaryDirectory(dir=video_pipeline.ROOT) as temp_dir:
            video_pipeline.TASK_DIR = Path(temp_dir)

            def fake_query(task_id, settings=None):
                self.assertEqual(task_id, "task-123")
                return {
                    "ok": True,
                    "task_id": "task-123",
                    "status": "completed",
                    "video_url": "https://cdn.example.test/final.mp4",
                    "response": {"data": {"status": "completed"}},
                }

            video_pipeline.query_avatar_pipeline_task = fake_query
            try:
                video_pipeline.record_avatar_pipeline_task(
                    {"name": "demo", "script": "hello"},
                    {"ok": True, "provider": "duix_api", "task_id": "task-123", "video_url": ""},
                )
                refreshed = video_pipeline.refresh_avatar_pipeline_task("task-123")
                rows = video_pipeline.list_avatar_pipeline_tasks()
            finally:
                video_pipeline.query_avatar_pipeline_task = old_query
                video_pipeline.TASK_DIR = old_task_dir

        self.assertTrue(refreshed["ok"])
        self.assertEqual(refreshed["task"]["status"], "completed")
        self.assertEqual(refreshed["task"]["video_url"], "https://cdn.example.test/final.mp4")
        self.assertEqual(rows[0]["status"], "completed")


class VideoPipelineHttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        class QuietHandler(custom_home_server.CustomHomeHandler):
            def log_message(self, *args):
                return

        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler)
        cls.port = cls.server.server_address[1]
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.thread.join(timeout=2)

    def _post_json(self, path, payload):
        request = urllib.request.Request(
            f"http://127.0.0.1:{self.port}{path}",
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={"Content-Type": "application/json; charset=utf-8"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))

    def test_pipeline_tts_endpoint_returns_generated_audio_metadata(self):
        old_generate = custom_home_server.generate_doubao_tts_audio

        def fake_generate(payload, settings):
            return {
                "ok": True,
                "provider": "doubao_tts_v3",
                "file": {"name": "voice.mp3", "url": "/digital_human_assets/voice/generated/demo/voice.mp3", "size": 123},
                "text": payload.get("text"),
            }

        custom_home_server.generate_doubao_tts_audio = fake_generate
        try:
            result = self._post_json("/api/pipeline/tts", {"text": "HTTP TTS smoke"})
        finally:
            custom_home_server.generate_doubao_tts_audio = old_generate

        self.assertTrue(result["ok"])
        self.assertEqual(result["provider"], "doubao_tts_v3")
        self.assertEqual(result["file"]["name"], "voice.mp3")

    def test_pipeline_compose_endpoint_returns_final_video_metadata(self):
        old_compose = custom_home_server.compose_with_ffmpeg

        def fake_compose(payload):
            return {
                "ok": True,
                "file": {"name": "final.mp4", "url": "/digital_human_outputs/demo/final.mp4", "size": 456},
                "name": payload.get("name"),
            }

        custom_home_server.compose_with_ffmpeg = fake_compose
        try:
            result = self._post_json("/api/pipeline/compose", {"name": "HTTP compose smoke"})
        finally:
            custom_home_server.compose_with_ffmpeg = old_compose

        self.assertTrue(result["ok"])
        self.assertEqual(result["file"]["name"], "final.mp4")

    def test_pipeline_compose_endpoint_runs_real_ffmpeg_when_runtime_exists(self):
        ffmpeg = video_pipeline.ffmpeg_path()
        if not ffmpeg:
            self.skipTest("FFmpeg runtime is not installed")

        old_output_dir = video_pipeline.OUTPUT_DIR
        with tempfile.TemporaryDirectory(dir=video_pipeline.ROOT) as temp_dir:
            temp = Path(temp_dir)
            video_pipeline.OUTPUT_DIR = temp / "http-outputs"
            background, avatar, voice = create_ffmpeg_smoke_assets(ffmpeg, temp)
            try:
                result = self._post_json(
                    "/api/pipeline/compose",
                    {
                        "name": "http-compose-smoke",
                        "script": "HTTP compose endpoint real FFmpeg smoke.",
                        "aspect_ratio": "9:16",
                        "background": {"url": "/" + background.relative_to(video_pipeline.ROOT).as_posix()},
                        "avatar_video": {"url": "/" + avatar.relative_to(video_pipeline.ROOT).as_posix()},
                        "voice": {"url": "/" + voice.relative_to(video_pipeline.ROOT).as_posix()},
                    },
                )
            finally:
                video_pipeline.OUTPUT_DIR = old_output_dir

        self.assertTrue(result["ok"], result.get("error"))
        self.assertGreater(result["file"]["size"], 0)
        self.assertTrue(result["file"]["url"].endswith(".mp4"))

    def test_pipeline_outputs_endpoint_lists_local_outputs(self):
        old_outputs = custom_home_server.list_pipeline_outputs

        def fake_outputs():
            return [
                {
                    "name": "demo",
                    "video": {"name": "demo.mp4", "url": "/digital_human_outputs/demo/demo.mp4", "size": 100},
                    "media": {"duration": 2.0, "width": 1080, "height": 1920, "hasAudio": True},
                    "subtitle": None,
                    "videos": [],
                }
            ]

        custom_home_server.list_pipeline_outputs = fake_outputs
        try:
            result = urllib.request.urlopen(f"http://127.0.0.1:{self.port}/api/pipeline/outputs", timeout=10)
            rows = json.loads(result.read().decode("utf-8"))
        finally:
            custom_home_server.list_pipeline_outputs = old_outputs

        self.assertEqual(rows[0]["name"], "demo")
        self.assertEqual(rows[0]["video"]["name"], "demo.mp4")

    def test_pipeline_avatar_tasks_endpoint_lists_tasks(self):
        old_tasks = custom_home_server.list_avatar_pipeline_tasks

        def fake_tasks():
            return [{"task_id": "task-123", "status": "submitted", "project": "demo"}]

        custom_home_server.list_avatar_pipeline_tasks = fake_tasks
        try:
            result = urllib.request.urlopen(f"http://127.0.0.1:{self.port}/api/pipeline/avatar-tasks", timeout=10)
            rows = json.loads(result.read().decode("utf-8"))
        finally:
            custom_home_server.list_avatar_pipeline_tasks = old_tasks

        self.assertEqual(rows[0]["task_id"], "task-123")
        self.assertEqual(rows[0]["status"], "submitted")

    def test_pipeline_avatar_task_refresh_endpoint_updates_task(self):
        old_refresh = custom_home_server.refresh_avatar_pipeline_task

        def fake_refresh(task_id):
            return {"ok": True, "task": {"task_id": task_id, "status": "completed", "video_url": "https://example.test/final.mp4"}}

        custom_home_server.refresh_avatar_pipeline_task = fake_refresh
        try:
            result = self._post_json("/api/pipeline/avatar-tasks/task-123/refresh", {})
        finally:
            custom_home_server.refresh_avatar_pipeline_task = old_refresh

        self.assertTrue(result["ok"])
        self.assertEqual(result["task"]["task_id"], "task-123")
        self.assertEqual(result["task"]["status"], "completed")

    def test_pipeline_output_delete_endpoint_deletes_named_output(self):
        old_delete = custom_home_server.delete_pipeline_output

        def fake_delete(name):
            return {"ok": True, "deleted": True, "name": name, "outputs": []}

        custom_home_server.delete_pipeline_output = fake_delete
        try:
            request = urllib.request.Request(
                f"http://127.0.0.1:{self.port}/api/pipeline/outputs/demo-output",
                method="DELETE",
            )
            with urllib.request.urlopen(request, timeout=10) as response:
                result = json.loads(response.read().decode("utf-8"))
        finally:
            custom_home_server.delete_pipeline_output = old_delete

        self.assertTrue(result["ok"])
        self.assertTrue(result["deleted"])
        self.assertEqual(result["name"], "demo-output")

    def test_pipeline_output_zip_endpoint_returns_zip_download(self):
        old_zip = custom_home_server.build_pipeline_output_zip
        with tempfile.TemporaryDirectory(dir=video_pipeline.ROOT) as temp_dir:
            zip_path = Path(temp_dir) / "demo-delivery.zip"
            with zipfile.ZipFile(zip_path, "w") as archive:
                archive.writestr("demo.mp4", b"video")

            def fake_zip(name):
                return zip_path, ""

            custom_home_server.build_pipeline_output_zip = fake_zip
            try:
                result = urllib.request.urlopen(
                    f"http://127.0.0.1:{self.port}/api/pipeline/outputs/demo-output/zip",
                    timeout=10,
                )
                body = result.read()
            finally:
                custom_home_server.build_pipeline_output_zip = old_zip

        self.assertEqual(result.headers.get("Content-Type"), "application/zip")
        self.assertGreater(len(body), 0)


if __name__ == "__main__":
    unittest.main()
