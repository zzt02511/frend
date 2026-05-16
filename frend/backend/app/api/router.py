"""API 主路由器"""

from fastapi import APIRouter

from app.api.templates import router as templates_router
from app.api.projects import router as projects_router
from app.api.jobs import router as jobs_router
from app.api.llm_proxy import router as llm_router
from app.api.batch import router as batch_router

api_router = APIRouter()

api_router.include_router(templates_router, prefix="/templates", tags=["templates"])
api_router.include_router(projects_router, prefix="/projects", tags=["projects"])
api_router.include_router(jobs_router, prefix="/jobs", tags=["jobs"])
api_router.include_router(llm_router, prefix="/llm", tags=["llm"])
api_router.include_router(batch_router, prefix="", tags=["batch"])
