import base64
import json
import subprocess
import tempfile
import threading
import unittest
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

import custom_home_server
import video_pipeline
from cloud_runtime_client import CloudRuntimeSettings
from video_pipeline import DoubaoTTSRequest


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

    def test_compose_with_ffmpeg_creates_playable_mp4_when_runtime_exists(self):
        ffmpeg = video_pipeline.ffmpeg_path()
        if not ffmpeg:
            self.skipTest("FFmpeg runtime is not installed")

        old_output_dir = video_pipeline.OUTPUT_DIR
        with tempfile.TemporaryDirectory(dir=video_pipeline.ROOT) as temp_dir:
            temp = Path(temp_dir)
            video_pipeline.OUTPUT_DIR = temp / "outputs"
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


if __name__ == "__main__":
    unittest.main()
