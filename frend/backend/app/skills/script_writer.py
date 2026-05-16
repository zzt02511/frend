"""脚本编写 Skill - LLM 驱动生成场景级脚本"""

import logging
from app.skills.base import BaseSkill, SkillContext, SkillResult

logger = logging.getLogger("frend.script_writer")


class ScriptWriterSkill(BaseSkill):
    """视频脚本编写技能 - 使用 LLM 生成场景级脚本"""

    @property
    def skill_id(self) -> str:
        return "script-writer"

    async def execute(self, ctx: SkillContext) -> SkillResult:
        template = ctx.state.get("template", {})
        user_params = ctx.state.get("user_params", {})
        topic = user_params.get("topic", "")
        tone = user_params.get("tone", "轻松")

        scenes = template.get("scenes", [])
        scene_count = len(scenes)

        if not topic:
            # 无 LLM 时的回退脚本
            return SkillResult(success=True, data={
                "scenes": [
                    {"scene_id": s.get("id", f"scene_{i}"),
                     "narration": f"场景 {i+1} 内容",
                     "visual_desc": f"场景 {i+1} 视觉描述",
                     "duration": s.get("duration", 5)}
                    for i, s in enumerate(scenes)
                ]
            })

        # 尝试 LLM 生成
        try:
            llm = self._get_llm(ctx)
            if llm:
                prompt = self._build_prompt(topic, tone, scene_count, scenes)
                result = await llm.chat_json(
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.7,
                    max_tokens=2048,
                )
                scenes_data = result.get("scenes", result if isinstance(result, list) else [])
                return SkillResult(success=True, data={"scenes": scenes_data})
        except Exception as e:
            logger.warning(f"LLM 脚本生成失败，使用回退模板: {e}")

        # LLM 失败回退
        return SkillResult(success=True, data={
            "scenes": [
                {"scene_id": s.get("id", f"scene_{i}"),
                 "narration": f"关于{topic}的第{i+1}部分",
                 "visual_desc": f"展示{topic}相关的视觉内容",
                 "duration": s.get("duration", 5)}
                for i, s in enumerate(scenes)
            ]
        })

    def _build_prompt(self, topic: str, tone: str, scene_count: int, scenes: list) -> str:
        scene_descriptions = "\n".join(
            f"  场景{i+1} (ID: {s.get('id', '')}): {s.get('duration', 5)}秒"
            for i, s in enumerate(scenes)
        )
        return (
            f"你是一个短视频脚本编写助手。请为主题「{topic}」生成一个{scene_count}场景的视频脚本。\n\n"
            f"风格要求：{tone}\n\n"
            f"模板场景结构：\n{scene_descriptions}\n\n"
            f"请为每个场景生成：\n"
            f"1. narration: 配音文本（口语化、吸引人）\n"
            f"2. visual_desc: 视觉描述（用于后续图像生成）\n"
            f"3. duration: 推荐时长（秒）\n\n"
            f"以JSON格式返回：{{'scenes': [{{'scene_id': str, 'narration': str, 'visual_desc': str, 'duration': float}}]}}"
        )

    @staticmethod
    def _get_llm(ctx: SkillContext):
        """获取 LLM 客户端（如果配置了）"""
        llm = ctx.config.get("_llm_service")
        if llm:
            return llm
        api_key = ctx.config.get("llm_api_key", "")
        if api_key:
            from app.services.llm_service import LLMService
            return LLMService.from_config(ctx.config)
        return None
