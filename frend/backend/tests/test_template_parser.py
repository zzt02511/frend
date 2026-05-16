"""模板解析器单元测试"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))
from app.skills.template_parser import TemplateParserSkill
from app.skills.base import SkillContext


@pytest.fixture
def parser():
    return TemplateParserSkill()


@pytest.fixture
def ctx():
    return SkillContext(
        config={"templates_dir": str(Path(__file__).parent.parent.parent / "templates")},
        state={},
        working_memory={},
    )


@pytest.mark.asyncio
async def test_parse_knowledge_short(parser, ctx):
    """解析 knowledge-short 模板"""
    ctx.state = {"template_id": "knowledge-short"}
    result = await parser.execute(ctx)
    assert result.success
    data = result.data
    assert len(data.get("scenes", [])) > 0
    assert "video" in data
    assert "parameters" in data

    # 验证场景结构
    scene = data["scenes"][0]
    assert "elements" in scene
    assert "duration" in scene


@pytest.mark.asyncio
async def test_parse_product_promo(parser, ctx):
    """解析 product-promo 模板"""
    ctx.state = {"template_id": "product-promo"}
    result = await parser.execute(ctx)
    assert result.success
    assert len(result.data.get("scenes", [])) > 0


@pytest.mark.asyncio
async def test_parse_invalid_template(parser, ctx):
    """不存在的模板应返回错误"""
    ctx.state = {"template_id": "nonexistent"}
    result = await parser.execute(ctx)
    assert not result.success


@pytest.mark.asyncio
async def test_parse_no_template_id(parser, ctx):
    """缺少 template_id 应返回错误"""
    ctx.state = {}
    result = await parser.execute(ctx)
    assert not result.success


@pytest.mark.asyncio
async def test_video_config_values(parser, ctx):
    """验证视频配置的默认值"""
    ctx.state = {"template_id": "knowledge-short"}
    result = await parser.execute(ctx)
    vc = result.data.get("video", {})
    assert vc.get("width", 0) > 0
    assert vc.get("height", 0) > 0
    assert vc.get("fps", 0) > 0


@pytest.mark.asyncio
async def test_template_parameters(parser, ctx):
    """验证模板参数定义"""
    ctx.state = {"template_id": "knowledge-short"}
    result = await parser.execute(ctx)
    params = result.data.get("parameters", [])
    param_names = [p.get("name") for p in params]
    assert "topic" in param_names
