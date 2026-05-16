"""协调器代理 - 编排整体 Agent 工作流"""

from app.agents.state import AgentState


def create_initial_state(
    project_id: str,
    template_id: str,
    user_params: dict | None = None,
    config: dict | None = None,
) -> AgentState:
    """创建初始 AgentState"""
    return {
        "project_id": project_id,
        "template_id": template_id,
        "user_params": user_params or {},
        "template": {},
        "script": [],
        "assets": [],
        "tts_audio": [],
        "subtitles": [],
        "ffmpeg_command": "",
        "output_path": "",
        "errors": [],
        "warnings": [],
        "current_step": "init",
        "progress": 0.0,
        "working_memory": {},
        "config": config or {},
    }


async def finalize_node(state: AgentState) -> dict:
    """最终节点 - 资源清理 + 状态更新"""
    return {
        **state,
        "current_step": "complete",
        "progress": 1.0,
    }
