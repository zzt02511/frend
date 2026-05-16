"""LLM BFF 代理 API - 参照 Banana 的 /api/minimax 模式"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class ChatRequest(BaseModel):
    messages: list[dict]
    model: str = ""
    temperature: float = 0.7
    max_tokens: int = 2048
    api_key: str = ""
    base_url: str = ""


class ChatResponse(BaseModel):
    content: str
    model: str


@router.post("/chat", response_model=ChatResponse)
async def llm_chat(req: ChatRequest):
    """BFF 代理 - 前端 → 后端 → LLM API"""
    from app.services.llm_service import LLMService

    if not req.api_key:
        raise HTTPException(400, "api_key 是必需的")

    try:
        llm = LLMService(
            api_key=req.api_key,
            base_url=req.base_url,
            model=req.model,
        )
        content = await llm.chat(
            messages=req.messages,
            temperature=req.temperature,
            max_tokens=req.max_tokens,
        )
        return ChatResponse(content=content, model=llm.model)
    except Exception as e:
        raise HTTPException(502, f"LLM API 调用失败: {e}")
