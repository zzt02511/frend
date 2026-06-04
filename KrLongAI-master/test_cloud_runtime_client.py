import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import cloud_runtime_client as client
from cloud_runtime_client import CloudRuntimeSettings


class FakeCloudHandler(BaseHTTPRequestHandler):
    requests = []

    def do_GET(self):
        self.__class__.requests.append(
            {
                "path": self.path,
                "payload": None,
                "authorization": self.headers.get("Authorization"),
                "x_api_key": self.headers.get("X-Api-Key"),
                "token": self.headers.get("token"),
            }
        )
        self._send({"ok": True, "path": self.path})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        payload = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
        self.__class__.requests.append(
            {
                "path": self.path,
                "payload": payload,
                "authorization": self.headers.get("Authorization"),
                "x_api_key": self.headers.get("X-Api-Key"),
                "token": self.headers.get("token"),
            }
        )
        self._send(
            {
                "ok": True,
                "path": self.path,
                "received": payload,
                "taskId": "fake-task",
                "data": {"video_id": "heygen-video"},
                "audio_url": "https://cdn.example.test/audio.mp3",
            }
        )

    def _send(self, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        return


class CloudRuntimeClientTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), FakeCloudHandler)
        cls.port = cls.server.server_address[1]
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.thread.join(timeout=2)

    def setUp(self):
        self.old_settings_path = client.SETTINGS_PATH
        client.SETTINGS_PATH = self.old_settings_path.with_name("test_cloud_settings.json")
        if client.SETTINGS_PATH.exists():
            client.SETTINGS_PATH.unlink()
        FakeCloudHandler.requests = []

    def tearDown(self):
        if client.SETTINGS_PATH.exists():
            client.SETTINGS_PATH.unlink()
        client.SETTINGS_PATH = self.old_settings_path

    def test_submit_heygem_task_uses_remote_endpoint_and_script(self):
        base = f"http://127.0.0.1:{self.port}"
        client.save_settings(CloudRuntimeSettings(heygem_base_url=base, tts_base_url=base, avatar_id="avatar-a", voice_id="voice-b"))

        result = client.submit_heygem_task(
            {
                "titles": ["测试标题"],
                "rewritten_script": "这是一段门店顾问口播。",
                "pillar": "案例讲解",
                "cover": "真实案例",
            }
        )

        self.assertTrue(result["ok"])
        self.assertEqual(FakeCloudHandler.requests[-1]["path"], "/easy/submit")
        payload = FakeCloudHandler.requests[-1]["payload"]
        self.assertEqual(payload["text"], "这是一段门店顾问口播。")
        self.assertEqual(payload["avatar_id"], "avatar-a")
        self.assertEqual(payload["voice_id"], "voice-b")

    def test_submit_tts_task_uses_remote_endpoint(self):
        base = f"http://127.0.0.1:{self.port}"
        client.save_settings(CloudRuntimeSettings(heygem_base_url=base, tts_base_url=base, voice_id="voice-b"))

        result = client.submit_tts_task("生成一段语音")

        self.assertTrue(result["ok"])
        self.assertEqual(FakeCloudHandler.requests[-1]["path"], "/v1/invoke")
        self.assertEqual(FakeCloudHandler.requests[-1]["payload"]["text"], "生成一段语音")
        self.assertEqual(FakeCloudHandler.requests[-1]["payload"]["voice_id"], "voice-b")

    def test_submit_avatar_task_can_use_third_party_template(self):
        base = f"http://127.0.0.1:{self.port}"
        client.save_settings(
            CloudRuntimeSettings(
                avatar_provider="heygen",
                avatar_submit_url=f"{base}/v2/video/generate",
                avatar_api_key="avatar-key",
                avatar_auth_header="X-Api-Key",
                avatar_auth_scheme="",
                avatar_response_task_path="data.video_id",
                avatar_id="avatar-a",
                voice_id="voice-b",
                avatar_payload_template=json.dumps(
                    {
                        "video_inputs": [
                            {
                                "character": {"type": "avatar", "avatar_id": "{avatar_id}"},
                                "voice": {"type": "text", "input_text": "{script}", "voice_id": "{voice_id}"},
                            }
                        ],
                        "title": "{title}",
                    },
                    ensure_ascii=False,
                ),
            )
        )

        result = client.submit_heygem_task({"titles": ["案例口播"], "rewritten_script": "真实图片加避坑建议。"})

        self.assertTrue(result["ok"])
        self.assertEqual(result["task_id"], "heygen-video")
        request = FakeCloudHandler.requests[-1]
        self.assertEqual(request["path"], "/v2/video/generate")
        self.assertEqual(request["x_api_key"], "avatar-key")
        self.assertEqual(request["payload"]["video_inputs"][0]["voice"]["input_text"], "真实图片加避坑建议。")

    def test_submit_avatar_task_generates_duix_token_from_app_credentials(self):
        base = f"http://127.0.0.1:{self.port}"
        client.save_settings(
            CloudRuntimeSettings(
                avatar_provider="duix_api",
                avatar_submit_url=f"{base}/duix-openapi-v2/sdk/v2/createAvatar",
                avatar_app_id="duix-app-id",
                avatar_api_key="duix-app-key",
                avatar_auth_header="token",
                avatar_auth_scheme="",
                avatar_response_task_path="data.video_id",
                avatar_id="conversation-123",
                voice_id="guina",
                avatar_payload_template=json.dumps(
                    {
                        "ttsName": "{voice_id}",
                        "conversationId": "{avatar_id}",
                        "defaultSpeakingLanguage": "zh",
                        "greetings": "{script}",
                        "name": "{title}",
                    },
                    ensure_ascii=False,
                ),
            )
        )

        result = client.submit_heygem_task({"titles": ["Duix 顾问"], "rewritten_script": "先讲真实痛点，再讲解决方案。"})

        self.assertTrue(result["ok"])
        request = FakeCloudHandler.requests[-1]
        self.assertEqual(request["path"], "/duix-openapi-v2/sdk/v2/createAvatar")
        self.assertEqual(request["payload"]["conversationId"], "conversation-123")
        self.assertEqual(request["payload"]["ttsName"], "guina")
        self.assertEqual(request["payload"]["greetings"], "先讲真实痛点，再讲解决方案。")
        self.assertIsNone(request["authorization"])
        self.assertEqual(request["token"].count("."), 2)

    def test_query_duix_avatar_task_status_uses_get_task_id_query(self):
        base = f"http://127.0.0.1:{self.port}"
        client.save_settings(
            CloudRuntimeSettings(
                avatar_provider="duix_api",
                avatar_status_url=f"{base}/duix-openapi-v2/sdk/v2/queryAvatar",
                avatar_app_id="duix-app-id",
                avatar_api_key="duix-app-key",
                avatar_auth_header="token",
                avatar_auth_scheme="",
                avatar_response_video_path="path",
            )
        )

        result = client.query_avatar_task_status("task-123")

        self.assertTrue(result["ok"])
        request = FakeCloudHandler.requests[-1]
        self.assertEqual(request["path"], "/duix-openapi-v2/sdk/v2/queryAvatar?taskId=task-123")
        self.assertIsNone(request["payload"])
        self.assertEqual(request["token"].count("."), 2)

    def test_submit_voice_task_can_use_third_party_template(self):
        base = f"http://127.0.0.1:{self.port}"
        client.save_settings(
            CloudRuntimeSettings(
                voice_provider="openai_tts",
                voice_submit_url=f"{base}/v1/audio/speech",
                voice_api_key="voice-key",
                voice_id="alloy",
                voice_payload_template=json.dumps(
                    {"model": "gpt-4o-mini-tts", "voice": "{voice_id}", "input": "{text}"},
                    ensure_ascii=False,
                ),
            )
        )

        result = client.submit_tts_task("生成一段小红书口播")

        self.assertTrue(result["ok"])
        self.assertEqual(result["audio_url"], "https://cdn.example.test/audio.mp3")
        request = FakeCloudHandler.requests[-1]
        self.assertEqual(request["path"], "/v1/audio/speech")
        self.assertEqual(request["authorization"], "Bearer voice-key")
        self.assertEqual(request["payload"]["input"], "生成一段小红书口播")

    def test_avatar_payload_template_can_include_clone_assets_and_background(self):
        settings = CloudRuntimeSettings(
            avatar_id="avatar-existing",
            voice_id="voice-existing",
            avatar_payload_template=json.dumps(
                {
                    "script": "{script}",
                    "background_url": "{background_url}",
                    "avatar_asset_url": "{avatar_asset_url}",
                    "voice_asset_url": "{voice_asset_url}",
                    "aspect_ratio": "{aspect_ratio}",
                    "task_type": "{task_type}",
                },
                ensure_ascii=False,
            ),
        )

        payload = client.build_avatar_task_payload(
            {
                "titles": ["真实背景口播"],
                "script": "用户文案生成数字人口播。",
                "background_url": "/digital_human_assets/background/demo/bg.jpg",
                "avatar_asset_url": "/digital_human_assets/avatar/demo/person.mp4",
                "voice_asset_url": "/digital_human_assets/voice/demo/voice.wav",
                "aspect_ratio": "9:16",
                "task_type": "avatar_video",
            },
            settings,
        )

        self.assertEqual(payload["background_url"], "/digital_human_assets/background/demo/bg.jpg")
        self.assertEqual(payload["avatar_asset_url"], "/digital_human_assets/avatar/demo/person.mp4")
        self.assertEqual(payload["voice_asset_url"], "/digital_human_assets/voice/demo/voice.wav")
        self.assertEqual(payload["aspect_ratio"], "9:16")
        self.assertEqual(payload["task_type"], "avatar_video")


if __name__ == "__main__":
    unittest.main()
