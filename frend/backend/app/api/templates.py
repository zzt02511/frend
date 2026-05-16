"""模板 CRUD API"""

from fastapi import APIRouter, HTTPException
from app.models.template import TemplateSchema, TemplateSummary
from app.skills.template_parser import TemplateParserSkill

router = APIRouter()
parser = TemplateParserSkill()


@router.get("", response_model=list[TemplateSummary])
async def list_templates():
    """获取所有可用模板的摘要列表"""
    try:
        templates = parser.list_available_templates()
        summaries = []
        for t in templates:
            scenes = t.get("scenes", [])
            params = t.get("parameters", [])
            total_dur = sum(s.get("duration", 0) for s in scenes)
            summaries.append(TemplateSummary(
                id=t.get("id", ""),
                name=t.get("name", ""),
                description=t.get("description", ""),
                category=t.get("category", ""),
                version=t.get("version", "1.0.0"),
                thumbnail=t.get("thumbnail", ""),
                scene_count=len(scenes),
                total_duration=total_dur,
                parameter_count=len(params),
            ))
        return summaries
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{template_id}", response_model=TemplateSchema)
async def get_template(template_id: str):
    """获取模板详情（含完整场景和参数定义）"""
    try:
        result = parser.load_template(template_id)
        if not result.success:
            raise HTTPException(status_code=404, detail=result.error or "模板不存在")
        return result.data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
