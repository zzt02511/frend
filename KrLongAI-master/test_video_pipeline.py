import base64
import json
import tempfile
import unittest
from pathlib import Path

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


if __name__ == "__main__":
    unittest.main()
