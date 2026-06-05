import json
import tempfile
import unittest
from pathlib import Path

from content_pipeline import build_pipeline_package
from custom_home_agent import CaseInput


class ContentPipelineTalkingVideoTests(unittest.TestCase):
    def test_pipeline_package_exports_talking_video_task_metadata(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            source = tmp / "source-detail.jpg"
            source.write_bytes(b"fake image")
            export_dir = tmp / "exports"
            case = CaseInput(city="Suzhou", district="Wuzhong", community="Lake Garden", quantity=1)
            rows = [
                {
                    "index": 1,
                    "pillar": "case_story",
                    "titles": ["Door case story"],
                    "cover": "Door checklist",
                    "rewritten_script": "Open with the pain point. Show the door detail. End with a store visit CTA.",
                    "xiaohongshu_note": "note",
                    "xiaohongshu_video_plan": ["talking head", "door detail"],
                    "dm_keyword": "door",
                }
            ]
            project_data = {
                "name": "pipeline-demo",
                "materials": [
                    {
                        "name": "source-detail.jpg",
                        "path": str(source),
                        "tags": ["door", "detail"],
                    }
                ],
                "talking_video": {
                    "projectId": "real-test",
                    "sourceTalkingVideo": "uploads/talking.mp4",
                    "aspectRatio": "9:16",
                    "durationTarget": 36.4,
                },
            }

            build_pipeline_package(case, rows, project_data, export_dir)

            package_dir = export_dir / "pipeline-demo"
            pipeline = json.loads((package_dir / "pipeline.json").read_text(encoding="utf-8"))
            talking_stage = next(stage for stage in pipeline["stages"] if stage["id"] == "talking_video_auto_edit")
            self.assertEqual(talking_stage["task_file"], "talking_video_task.json")

            task = json.loads((package_dir / "talking_video_task.json").read_text(encoding="utf-8"))
            self.assertEqual(task["projectId"], "real-test")
            self.assertEqual(task["sourceTalkingVideo"], "uploads/talking.mp4")
            self.assertEqual(task["render"]["output"], "talking_video_exports/real-test/final.mp4")
            self.assertEqual(task["scripts"][0]["script"], rows[0]["rewritten_script"])
            self.assertTrue(task["materials"][0]["export_path"].endswith("materials/source-detail.jpg"))

            publish = json.loads((package_dir / "publish_manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(publish[0]["talking_video_task"], str(package_dir / "talking_video_task.json"))

            readme = (package_dir / "README.md").read_text(encoding="utf-8")
            self.assertIn("talking_video_task.json", readme)


if __name__ == "__main__":
    unittest.main()
