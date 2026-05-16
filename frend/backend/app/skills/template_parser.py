"""模板解析 Skill - 加载 YAML 模板并验证"""

import os
import re
import yaml
from pathlib import Path

from app.config import settings
from app.models.template import TemplateSchema, ParameterVariable
from app.skills.base import BaseSkill, SkillContext, SkillResult


class TemplateParserSkill(BaseSkill):
    """模板解析技能 - DEERFLOW 风格按需加载"""

    @property
    def skill_id(self) -> str:
        return "template-parser"

    async def execute(self, ctx: SkillContext) -> SkillResult:
        template_id = ctx.state.get("template_id", "")
        result = self.load_template(template_id)
        if result.success and result.data:
            resolved = self.resolve_parameters(result.data, ctx.state.get("user_params", {}))
            return SkillResult(success=True, data=resolved)
        return result

    def validate_input(self, ctx: SkillContext) -> list[str]:
        errors = []
        if not ctx.state.get("template_id"):
            errors.append("template_id 是必需的")
        if not ctx.state.get("user_params"):
            errors.append("user_params 是必需的")
        return errors

    def list_available_templates(self) -> list[dict]:
        """扫描模板目录，返回可用模板列表"""
        templates = []
        templates_dir = Path(settings.templates_dir)
        if not templates_dir.exists():
            return templates

        for f in sorted(templates_dir.glob("*.yaml")):
            if f.name.startswith("_"):
                continue
            try:
                with open(f, "r", encoding="utf-8") as fh:
                    data = yaml.safe_load(fh)
                if data and "template" in data:
                    t = data["template"]
                    t["_path"] = str(f)
                    templates.append(t)
            except Exception:
                continue
        return templates

    def load_template(self, template_id: str) -> SkillResult:
        """按 ID 加载并验证模板"""
        templates_dir = Path(settings.templates_dir)
        if not templates_dir.exists():
            return SkillResult(success=False, error="模板目录不存在")

        for f in templates_dir.glob("*.yaml"):
            if f.name.startswith("_"):
                continue
            try:
                with open(f, "r", encoding="utf-8") as fh:
                    data = yaml.safe_load(fh)
                if data and data.get("template", {}).get("id") == template_id:
                    validated = TemplateSchema(**data["template"])
                    return SkillResult(success=True, data=validated.model_dump())
            except Exception as e:
                continue
        return SkillResult(success=False, error=f"模板 '{template_id}' 未找到")

    def resolve_parameters(self, template: dict, user_params: dict) -> dict:
        """解析模板中的 {{var}} 占位符"""
        import copy
        resolved = copy.deepcopy(template)

        scenes = resolved.get("scenes", [])
        for scene in scenes:
            for element in scene.get("elements", []):
                if "content" in element:
                    element["content"] = self._resolve_text(
                        element["content"], user_params
                    )
                if "source" in element:
                    element["source"] = self._resolve_text(
                        element["source"], user_params
                    )
        return resolved

    @staticmethod
    def _resolve_text(text: str, params: dict) -> str:
        """替换 {{var}} 为参数值"""
        def _replacer(match):
            var_name = match.group(1)
            return str(params.get(var_name, match.group(0)))
        return re.sub(r'\{\{(\w+)\}\}', _replacer, text)
