import json
import unittest
from pathlib import Path

from talking_video_editor import (
    MaterialAsset,
    build_edit_plan,
    normalize_materials,
    safe_project_id,
    segment_script,
)


class TalkingVideoEditorTests(unittest.TestCase):
    def test_safe_project_id_removes_windows_unsafe_characters(self):
        self.assertEqual(safe_project_id(" 苏州/门店:口播*测试 "), "苏州-门店-口播-测试")
        self.assertEqual(safe_project_id(""), "talking-video")

    def test_segment_script_splits_chinese_sentences_into_timed_segments(self):
        segments = segment_script(
            "装修选门不要只看价格。先看门套和锁具，再看安装案例！最后到店看实物。",
            duration=30.0,
        )
        self.assertEqual(len(segments), 3)
        self.assertEqual(segments[0]["start"], 0.0)
        self.assertAlmostEqual(segments[-1]["end"], 30.0)
        self.assertIn("装修选门", segments[0]["text"])

    def test_normalize_materials_infers_type_and_tags(self):
        materials = normalize_materials([
            {"name": "工厂质检.mp4", "url": "/custom_home_materials/demo/工厂质检.mp4", "notes": "生产线 质检 工厂实力"},
            {"name": "入户门细节.jpg", "url": "/custom_home_materials/demo/入户门细节.jpg", "tags": ["产品", "细节"]},
        ])
        self.assertEqual(materials[0].type, "video")
        self.assertIn("工厂", materials[0].tags)
        self.assertEqual(materials[1].type, "image")
        self.assertIn("产品", materials[1].tags)

    def test_normalize_materials_uses_url_extension_when_name_has_none(self):
        materials = normalize_materials([
            {"name": "门店探访", "url": "/custom_home_materials/demo/门店探访.webm"},
        ])

        self.assertEqual(materials[0].type, "video")

    def test_build_edit_plan_returns_stable_structure_and_matches_broll(self):
        materials = [
            {
                "id": "asset-factory",
                "name": "工厂质检.mp4",
                "url": "/custom_home_materials/demo/工厂质检.mp4",
                "notes": "生产线 质检 工厂实力",
            },
            {
                "id": "asset-case",
                "name": "门店安装案例.jpg",
                "url": "/custom_home_materials/demo/门店安装案例.jpg",
                "tags": ["门店", "案例"],
            },
        ]
        plan = build_edit_plan(
            project_id=" 苏州/门店:口播 ",
            talking_video="/videos/talking.mp4",
            script="选门不要只看价格。我们工厂质检更严格，门店也有真实安装案例。现在到店看实物。",
            materials=materials,
            duration=24,
            aspect_ratio="9:16",
            cta="到店看样",
        )

        self.assertEqual(plan["projectId"], "苏州-门店-口播")
        self.assertEqual(plan["sourceTalkingVideo"], "/videos/talking.mp4")
        self.assertEqual(plan["aspectRatio"], "9:16")
        self.assertEqual(plan["durationTarget"], 24)
        self.assertEqual(plan["scriptSource"], "user-script")
        self.assertEqual(plan["captions"], {"style": "bold-bottom", "highlightKeywords": True})
        self.assertEqual(plan["overlays"]["cta"], "到店看样")
        self.assertTrue(plan["overlays"]["title"])
        self.assertTrue(plan["overlays"]["progressBar"])
        self.assertEqual(plan["cover"]["frameAt"], 1.2)
        self.assertEqual(plan["render"], {"output": "renders/final.mp4", "status": "draft"})

        slots = [slot for segment in plan["segments"] for slot in segment["brollSlots"]]
        self.assertTrue(slots)
        self.assertIn(slots[0]["assetId"], {"asset-factory", "asset-case"})
        self.assertIn("匹配关键词", slots[0]["reason"])

    def test_build_edit_plan_accepts_explicit_title_for_overlay_and_cover(self):
        try:
            plan = build_edit_plan(
                project_id="标题测试",
                talking_video="/videos/talking.mp4",
                script="选门不要只看价格。到店看实物更放心。",
                materials=[],
                duration=12,
                title="苏州门店选门避坑",
            )
        except TypeError as exc:
            self.fail(f"build_edit_plan should accept title keyword: {exc}")

        self.assertEqual(plan["overlays"]["title"], "苏州门店选门避坑")
        self.assertEqual(plan["cover"]["text"], "苏州门店选门避坑")

    def test_build_edit_plan_degrades_when_materials_are_missing(self):
        plan = build_edit_plan(
            project_id="缺素材测试",
            talking_video="/videos/talking.mp4",
            script="工厂质检和门店案例都很重要。",
            materials=[],
            duration=12,
        )

        self.assertTrue(any("素材" in warning for warning in plan["warnings"]))
        self.assertEqual(
            [slot for segment in plan["segments"] for slot in segment["brollSlots"]],
            [],
        )

    def test_build_edit_plan_degrades_when_script_is_missing(self):
        plan = build_edit_plan(
            project_id="",
            talking_video="/videos/talking.mp4",
            script="",
            materials=[],
        )

        self.assertEqual(plan["scriptSource"], "missing")
        self.assertIn("补充口播脚本后重新生成剪辑方案", plan["segments"][0]["text"])
        self.assertTrue(any("脚本" in warning for warning in plan["warnings"]))

    def test_plan_is_json_serializable_and_preserves_chinese_script_text(self):
        materials = [
            MaterialAsset(
                id="asset-product",
                name="入户门细节.jpg",
                url="/custom_home_materials/demo/入户门细节.jpg",
                type="image",
                tags=["产品", "细节"],
                notes="锁具 门套",
            )
        ]
        plan = build_edit_plan(
            project_id="中文脚本测试",
            talking_video="/videos/talking.mp4",
            script="入户门要看门套。锁具细节也要看。",
            materials=materials,
            duration=10,
        )

        encoded = json.dumps(plan, ensure_ascii=False)
        self.assertIn("入户门要看门套", encoded)
        decoded = json.loads(encoded)
        self.assertIn("锁具细节", decoded["segments"][1]["text"])
        self.assertIsInstance(Path(decoded["render"]["output"]), Path)


if __name__ == "__main__":
    unittest.main()
