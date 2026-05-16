"""LangGraph StateGraph - Agent 工作流图定义

工作流:
  template_parse → script_generate → [collect_assets, generate_tts]
  → generate_srt → ffmpeg_render → finalize
"""

from langgraph.graph import StateGraph, END
from app.agents.state import AgentState
from app.agents.coordinator import finalize_node


def build_video_generation_graph() -> StateGraph:
    """构建视频生成 LangGraph"""
    from app.agents.coordinator import create_initial_state

    graph = StateGraph(AgentState)

    # 添加节点
    graph.add_node("template_parse", _template_parse_node)
    graph.add_node("script_generate", _script_generate_node)
    graph.add_node("collect_assets", _collect_assets_node)
    graph.add_node("generate_tts", _generate_tts_node)
    graph.add_node("generate_srt", _generate_srt_node)
    graph.add_node("ffmpeg_render", _ffmpeg_render_node)
    graph.add_node("finalize", finalize_node)

    # 设置入口
    graph.set_entry_point("template_parse")

    # 线性流程
    graph.add_edge("template_parse", "script_generate")
    graph.add_edge("script_generate", "collect_assets")
    graph.add_edge("collect_assets", "generate_tts")
    graph.add_edge("generate_tts", "generate_srt")
    graph.add_edge("generate_srt", "ffmpeg_render")
    graph.add_edge("ffmpeg_render", "finalize")
    graph.add_edge("finalize", END)

    return graph.compile()


# === 节点处理器（Phase 2 桩实现，Phase 3 完善） ===


async def _template_parse_node(state: AgentState) -> dict:
    """模板解析节点"""
    from app.skills.template_parser import TemplateParserSkill

    skill = TemplateParserSkill()
    ctx = type("Ctx", (), {"state": state, "working_memory": state.get("working_memory", {}), "config": state.get("config", {})})()
    result = await skill.execute(ctx)

    if not result.success:
        return {**state, "errors": state.get("errors", []) + [result.error or "模板解析失败"], "current_step": "template_parse"}

    resolved = result.data or {}
    return {
        **state,
        "template": resolved,
        "current_step": "template_parse",
        "progress": 0.15,
    }


async def _script_generate_node(state: AgentState) -> dict:
    """脚本生成节点"""
    from app.skills.script_writer import ScriptWriterSkill

    skill = ScriptWriterSkill()
    ctx = type("Ctx", (), {"state": state, "working_memory": state.get("working_memory", {}), "config": state.get("config", {})})()
    result = await skill.execute(ctx)

    return {
        **state,
        "script": result.data.get("scenes", []) if result.success else [],
        "errors": state.get("errors", []) + ([result.error] if not result.success and result.error else []),
        "current_step": "script_generate",
        "progress": 0.35,
    }


async def _collect_assets_node(state: AgentState) -> dict:
    """资产采集节点"""
    from app.skills.image_gen import ImageGenSkill

    skill = ImageGenSkill()
    ctx = type("Ctx", (), {"state": state, "working_memory": state.get("working_memory", {}), "config": state.get("config", {})})()
    result = await skill.execute(ctx)

    return {
        **state,
        "assets": result.data.get("assets", []) if result.success else [],
        "current_step": "collect_assets",
        "progress": 0.50,
    }


async def _generate_tts_node(state: AgentState) -> dict:
    """TTS 生成节点"""
    from app.skills.tts_speaker import TTSSpeakerSkill

    skill = TTSSpeakerSkill()
    ctx = type("Ctx", (), {"state": state, "working_memory": state.get("working_memory", {}), "config": state.get("config", {})})()
    result = await skill.execute(ctx)

    return {
        **state,
        "tts_audio": result.data.get("audio_files", []) if result.success else [],
        "current_step": "generate_tts",
        "progress": 0.65,
    }


async def _generate_srt_node(state: AgentState) -> dict:
    """字幕生成节点"""
    from app.skills.subtitle_gen import SubtitleGenSkill

    skill = SubtitleGenSkill()
    ctx = type("Ctx", (), {"state": state, "working_memory": state.get("working_memory", {}), "config": state.get("config", {})})()
    result = await skill.execute(ctx)

    return {
        **state,
        "subtitles": result.data.get("subtitles", []) if result.success else [],
        "current_step": "generate_srt",
        "progress": 0.75,
    }


async def _ffmpeg_render_node(state: AgentState) -> dict:
    """FFmpeg 渲染节点"""
    from app.skills.ffmpeg_renderer import FFmpegRendererSkill

    skill = FFmpegRendererSkill()
    ctx = type("Ctx", (), {"state": state, "working_memory": state.get("working_memory", {}), "config": state.get("config", {})})()
    result = await skill.execute(ctx)

    return {
        **state,
        "ffmpeg_command": result.data.get("command", "") if result.success else "",
        "output_path": result.data.get("output_path", "") if result.success else "",
        "current_step": "ffmpeg_render",
        "progress": 0.95,
    }


# 编译图实例
video_graph = build_video_generation_graph()
