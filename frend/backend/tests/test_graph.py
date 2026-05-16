"""LangGraph 模板解析测试"""

import sys
import json
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))
from app.agents.graph import build_video_generation_graph
from app.agents.coordinator import create_initial_state


@pytest.fixture
def test_state():
    return create_initial_state(
        project_id="test_proj_001",
        template_id="knowledge-short",
        user_params={"topic": "量子计算", "tone": "轻松"},
        config={"data_dir": str(Path(__file__).parent.parent.parent / "data")},
    )


@pytest.mark.asyncio
async def test_template_parse_node(test_state):
    """验证模板解析节点产出 template 字段"""
    from app.agents.graph import _template_parse_node

    result = await _template_parse_node(test_state)
    assert "template" in result
    template = result["template"]
    assert "scenes" in template
    assert len(template["scenes"]) > 0

    # 模板中的第一个场景应该有效
    first_scene = template["scenes"][0]
    assert "duration" in first_scene


@pytest.mark.asyncio
async def test_template_parse_without_llm(test_state):
    """不依赖 LLM 的模板解析和回退脚本生成"""
    from app.agents.graph import _template_parse_node, _script_generate_node

    parsed = await _template_parse_node(test_state)
    result = await _script_generate_node(parsed)

    assert "script" in result
    assert len(result["script"]) > 0
    assert "current_step" in result
    assert "progress" in result

    # 应包含所有场景的脚本
    scenes = result["script"]
    template_scenes = parsed.get("template", {}).get("scenes", [])
    assert len(scenes) == len(template_scenes)


@pytest.mark.asyncio
async def test_graph_compilation():
    """验证 LangGraph 图正常编译"""
    graph = build_video_generation_graph()
    assert graph is not None
    assert hasattr(graph, "ainvoke")


@pytest.mark.skip(reason="需要 LLM API 密钥")
@pytest.mark.asyncio
async def test_full_graph_execution(test_state):
    """完整图执行（跳过，需要外部 API）"""
    graph = build_video_generation_graph()
    result = await graph.ainvoke(test_state)
    assert "current_step" in result
    assert result["current_step"] in ("complete", "ffmpeg_render", "generate_srt")
