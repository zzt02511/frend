"""LLM 服务层 - 客户端工厂 + 重试/回退"""

import json
import hashlib
from typing import Literal

import httpx


class LLMService:
    """LLM API 客户端工厂（参照 Banana 的 MiniMaxAPI 模式）"""

    def __init__(self, api_key: str = "", base_url: str = "", model: str = ""):
        self.api_key = api_key
        self.base_url = base_url or "https://api.minimax.chat/v1"
        self.model = model or "MiniMax-M2.1"
        self._cache: dict[str, str] = {}

    @classmethod
    def from_config(cls, config: dict) -> "LLMService":
        return cls(
            api_key=config.get("llm_api_key", ""),
            base_url=config.get("llm_base_url", ""),
            model=config.get("llm_model", ""),
        )

    async def chat(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int = 2048,
        response_format: Literal["text", "json_object"] = "text",
        use_cache: bool = True,
    ) -> str:
        """发送聊天请求到 LLM API"""
        # 缓存检查
        if use_cache:
            cache_key = self._make_cache_key(messages, temperature, max_tokens)
            if cache_key in self._cache:
                return self._cache[cache_key]

        # 构建请求
        body = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if response_format == "json_object":
            body["response_format"] = {"type": "json_object"}

        # 发送请求（带重试）
        last_error = None
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=60) as client:
                    resp = await client.post(
                        f"{self.base_url}/chat/completions",
                        headers={
                            "Authorization": f"Bearer {self.api_key}",
                            "Content-Type": "application/json",
                        },
                        json=body,
                    )
                    resp.raise_for_status()
                    data = resp.json()
                    content = data["choices"][0]["message"]["content"]

                    if use_cache:
                        self._cache[cache_key] = content
                    return content
            except Exception as e:
                last_error = e
                if attempt < 2:
                    import asyncio
                    wait = [1, 4][attempt]
                    await asyncio.sleep(wait)
                continue

        raise RuntimeError(f"LLM API 调用失败 (重试3次): {last_error}")

    async def chat_json(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> dict:
        """发送聊天请求并解析 JSON 响应"""
        content = await self.chat(
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format="json_object",
        )
        # 清理 markdown 代码块标记
        content = content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[-1]
        if content.endswith("```"):
            content = content.rsplit("```", 1)[0]
        return json.loads(content.strip())

    def _make_cache_key(self, messages: list[dict], temperature: float, max_tokens: int) -> str:
        raw = json.dumps([messages, temperature, max_tokens], sort_keys=True)
        return hashlib.md5(raw.encode()).hexdigest()

    def clear_cache(self):
        self._cache.clear()
