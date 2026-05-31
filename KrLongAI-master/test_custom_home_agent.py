import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from custom_home_agent import CaseInput, generate_outputs, rewrite_script, validate_copy


class CustomHomeAgentTests(unittest.TestCase):
    def test_generates_requested_quantity_and_required_assets(self):
        case = CaseInput(city="苏州", district="吴中", community="湖畔花园", quantity=10)
        outputs = generate_outputs(case)

        self.assertEqual(len(outputs), 10)
        for item in outputs:
            self.assertEqual(len(item.titles), 3)
            self.assertTrue(item.script)
            self.assertTrue(item.cover)
            self.assertTrue(item.comment_prompt)
            self.assertTrue(item.dm_keyword)
            self.assertEqual(len(item.storyboard), 3)
            self.assertTrue(item.llm_prompt)
            self.assertGreaterEqual(item.score, 0)
            self.assertTrue(item.rewritten_script)

    def test_rotates_all_five_content_pillars(self):
        outputs = generate_outputs(CaseInput(quantity=5))
        pillars = {item.pillar for item in outputs}

        self.assertEqual(pillars, {"装修避坑", "案例讲解", "价格解释", "工艺展示", "本地信任"})

    def test_flags_risky_claims(self):
        notes = validate_copy("我们保证0甲醛，全网最低价，装修一定省50%。")

        self.assertGreaterEqual(len(notes), 3)

    def test_cli_outputs_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            case_path = Path(tmp) / "case.json"
            case_path.write_text(
                json.dumps({"city": "杭州", "cabinet_type": "衣柜定制", "quantity": 2}, ensure_ascii=False),
                encoding="utf-8",
            )
            result = subprocess.run(
                [sys.executable, "custom_home_agent.py", "--input", str(case_path), "--json"],
                check=True,
                capture_output=True,
                text=True,
                encoding="utf-8",
            )

        data = json.loads(result.stdout)
        self.assertEqual(len(data), 2)
        self.assertIn("衣柜定制", data[0]["script"])
        self.assertIn("storyboard", data[0])
        self.assertIn("llm_prompt", data[0])
        self.assertIn("score", data[0])
        self.assertIn("rewritten_script", data[0])

    def test_output_contains_storyboard_and_prompt(self):
        output = generate_outputs(CaseInput(quantity=1, benchmark_copy="同行爆款开头", promotion="到店领设计方案"))[0]

        self.assertIn("非标定制家居短视频编导", output.llm_prompt)
        self.assertIn("业主痛点", output.llm_prompt)
        self.assertIn("门店卖点", output.llm_prompt)
        self.assertIn("到店领设计方案", output.llm_prompt)
        self.assertIn("同行爆款开头", output.llm_prompt)
        self.assertTrue(any("门店" in shot or "特写" in shot for shot in output.storyboard))

    def test_empty_optional_prompt_fields_are_omitted(self):
        output = generate_outputs(
            CaseInput(
                quantity=1,
                pain_points="",
                selling_points="",
                budget="",
                promotion="",
                address="",
                contact="",
                benchmark_copy="",
            )
        )[0]

        self.assertNotIn("业主痛点：", output.llm_prompt)
        self.assertNotIn("门店卖点：", output.llm_prompt)
        self.assertNotIn("预算/报价表达：", output.llm_prompt)
        self.assertNotIn("活动引导：", output.llm_prompt)
        self.assertNotIn("对标参考文案：", output.llm_prompt)

    def test_rewrite_script_is_more_consultative(self):
        case = CaseInput(store_name="木作先生全屋定制", city="苏州", district="吴中")
        rewritten = rewrite_script("很多客户来店里第一句话就是：报价看不懂。", case, "价格解释")

        self.assertIn("木作先生全屋定制", rewritten)
        self.assertIn("同城业主", rewritten)
        self.assertIn("不要只比总价", rewritten)


if __name__ == "__main__":
    unittest.main()
