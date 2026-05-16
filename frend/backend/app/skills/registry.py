"""技能注册表 - DEERFLOW 风格的按需加载"""

import os
import yaml
from pathlib import Path
from app.config import settings
from app.skills.base import BaseSkill


class SkillRegistry:
    """技能注册表 - 从 YAML 定义按需加载技能"""

    def __init__(self):
        self._skills: dict[str, BaseSkill] = {}
        self._yaml_defs: dict[str, dict] = {}

    def load_all_yaml_defs(self):
        """扫描 skills_yaml 目录加载所有 YAML 定义"""
        skills_dir = Path(settings.skills_yaml_dir)
        if not skills_dir.exists():
            return
        for f in sorted(skills_dir.glob("*.yaml")):
            try:
                with open(f, "r", encoding="utf-8") as fh:
                    data = yaml.safe_load(fh)
                if data and "id" in data:
                    self._yaml_defs[data["id"]] = data
            except Exception:
                continue

    def register(self, skill: BaseSkill):
        """注册技能实例"""
        self._skills[skill.skill_id] = skill

    def get(self, skill_id: str) -> BaseSkill | None:
        """按 ID 获取技能"""
        return self._skills.get(skill_id)

    def get_yaml_def(self, skill_id: str) -> dict | None:
        """获取技能的 YAML 定义"""
        return self._yaml_defs.get(skill_id)

    def list_skills(self) -> list[dict]:
        """列出所有已注册技能"""
        return [
            {"id": s.skill_id, "name": s.__class__.__name__}
            for s in self._skills.values()
        ]

    def list_yaml_defs(self) -> list[dict]:
        """列出所有 YAML 技能定义"""
        return list(self._yaml_defs.values())


# 全局注册表
registry = SkillRegistry()
