"""技能基类 - DEERFLOW 风格的 Skill 抽象"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class SkillContext:
    """调用技能时传递的上下文"""
    state: dict = field(default_factory=dict)
    working_memory: dict = field(default_factory=dict)
    config: dict = field(default_factory=dict)
    data_dir: str = ""


@dataclass
class SkillResult:
    """技能执行结果"""
    success: bool = True
    data: dict | None = None
    error: str | None = None
    metrics: dict = field(default_factory=dict)


class BaseSkill(ABC):
    """所有技能的基类 - 遵循 DEERFLOW Skill 设计"""

    @property
    @abstractmethod
    def skill_id(self) -> str: ...

    @abstractmethod
    async def execute(self, ctx: SkillContext) -> SkillResult:
        ...

    def validate_input(self, ctx: SkillContext) -> list[str]:
        """返回输入验证错误列表"""
        return []
