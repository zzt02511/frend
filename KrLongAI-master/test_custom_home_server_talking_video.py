import json
import tempfile
import threading
import unittest
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path

import custom_home_server as server_module
from custom_home_server import CustomHomeHandler


class TalkingVideoServerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.old_talking_dir = getattr(server_module, "TALKING_VIDEO_DIR", None)
        server_module.TALKING_VIDEO_DIR = Path(self.tmp.name) / "talking_video_projects"
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), CustomHomeHandler)
        self.port = self.httpd.server_address[1]
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.httpd.shutdown()
        self.thread.join(timeout=2)
        self.httpd.server_close()
        if self.old_talking_dir is not None:
            server_module.TALKING_VIDEO_DIR = self.old_talking_dir
        self.tmp.cleanup()

    def request_json(self, method, path, payload=None):
        conn = HTTPConnection("127.0.0.1", self.port, timeout=5)
        body = json.dumps(payload or {}, ensure_ascii=False).encode("utf-8")
        conn.request(method, path, body=body, headers={"Content-Type": "application/json; charset=utf-8"})
        response = conn.getresponse()
        data = json.loads(response.read().decode("utf-8"))
        conn.close()
        return response.status, data

    def test_create_list_and_load_talking_video_project(self):
        status, created = self.request_json("POST", "/api/talking-video/projects", {"name": "demo project"})
        self.assertEqual(status, 200)
        self.assertTrue(created["ok"])
        project_id = created["project"]["id"]

        status, projects = self.request_json("GET", "/api/talking-video/projects")
        self.assertEqual(status, 200)
        self.assertEqual(projects[0]["id"], project_id)

        status, loaded = self.request_json("GET", f"/api/talking-video/projects/{project_id}")
        self.assertEqual(status, 200)
        self.assertEqual(loaded["id"], project_id)

    def test_generate_plan_endpoint_saves_edit_plan(self):
        _, created = self.request_json("POST", "/api/talking-video/projects", {"name": "demo"})
        project_id = created["project"]["id"]

        status, result = self.request_json(
            "POST",
            "/api/talking-video/plan",
            {
                "projectId": project_id,
                "talkingVideo": "uploads/talking.mp4",
                "script": "Choose materials carefully. Show the factory inspection.",
                "duration": 18,
                "materials": [{"name": "factory-check.mp4", "url": "uploads/assets/factory-check.mp4"}],
            },
        )

        self.assertEqual(status, 200)
        self.assertTrue(result["ok"])
        self.assertEqual(result["plan"]["projectId"], project_id)
        self.assertTrue((server_module.TALKING_VIDEO_DIR / project_id / "edit_plan.json").exists())

    def test_render_endpoint_returns_missing_ffmpeg_when_configured_path_is_missing(self):
        _, created = self.request_json("POST", "/api/talking-video/projects", {"name": "demo"})
        project_id = created["project"]["id"]
        self.request_json(
            "POST",
            "/api/talking-video/plan",
            {
                "projectId": project_id,
                "talkingVideo": "uploads/talking.mp4",
                "script": "Choose materials carefully.",
                "duration": 8,
                "materials": [],
            },
        )

        status, result = self.request_json(
            "POST",
            "/api/talking-video/render",
            {"projectId": project_id, "ffmpegPath": "definitely-not-existing-ffmpeg"},
        )

        self.assertEqual(status, 200)
        self.assertFalse(result["ok"])
        self.assertEqual(result["status"], "missing_ffmpeg")
        self.assertIn("command", result)

    def test_plan_endpoint_rejects_media_paths_outside_project(self):
        _, created = self.request_json("POST", "/api/talking-video/projects", {"name": "demo"})
        project_id = created["project"]["id"]

        status, result = self.request_json(
            "POST",
            "/api/talking-video/plan",
            {
                "projectId": project_id,
                "talkingVideo": "../outside.mp4",
                "script": "Choose materials carefully.",
                "materials": [{"name": "case.mp4", "url": "C:/secret/case.mp4"}],
            },
        )

        self.assertEqual(status, 400)
        self.assertFalse(result["ok"])
        self.assertIn("path", result["error"])
        self.assertFalse((server_module.TALKING_VIDEO_DIR / project_id / "edit_plan.json").exists())

    def test_render_endpoint_parses_execute_false_string_as_dry_run(self):
        _, created = self.request_json("POST", "/api/talking-video/projects", {"name": "demo"})
        project_id = created["project"]["id"]
        self.request_json(
            "POST",
            "/api/talking-video/plan",
            {
                "projectId": project_id,
                "talkingVideo": "uploads/talking.mp4",
                "script": "Choose materials carefully.",
                "duration": 8,
                "materials": [],
            },
        )

        status, result = self.request_json(
            "POST",
            "/api/talking-video/render",
            {
                "projectId": project_id,
                "ffmpegPath": "definitely-not-existing-ffmpeg",
                "execute": "false",
            },
        )

        self.assertEqual(status, 200)
        self.assertTrue(result["ok"])
        self.assertEqual(result["status"], "command_ready")


if __name__ == "__main__":
    unittest.main()
