#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Client helpers for remote/API content-production services."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import time
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlencode, urljoin


SETTINGS_PATH = Path(__file__).resolve().parent / "custom_home_cloud_settings.json"


@dataclass
class CloudRuntimeSettings:
    heygem_base_url: str = "http://127.0.0.1:8383"
    tts_base_url: str = "http://127.0.0.1:18180"
    api_key: str = ""
    avatar_id: str = ""
    voice_id: str = ""
    timeout_seconds: int = 60

    avatar_provider: str = "heygem"
    avatar_app_id: str = ""
    avatar_submit_url: str = ""
    avatar_status_url: str = ""
    avatar_api_key: str = ""
    avatar_auth_header: str = "Authorization"
    avatar_auth_scheme: str = "Bearer"
    avatar_response_task_path: str = "taskId"
    avatar_response_status_path: str = "status"
    avatar_response_video_path: str = "video_url"
    avatar_payload_template: str = ""

    voice_provider: str = "duix"
    voice_app_id: str = ""
    voice_submit_url: str = ""
    voice_api_key: str = ""
    voice_auth_header: str = "Authorization"
    voice_auth_scheme: str = "Bearer"
    voice_response_audio_path: str = "audio_url"
    voice_payload_template: str = ""


AVATAR_PROVIDER_PRESETS: dict[str, dict[str, str]] = {
    "heygem": {
        "name": "HeyGem / 自建服务",
        "submit_url": "",
        "auth_header": "Authorization",
        "auth_scheme": "Bearer",
        "task_path": "taskId",
        "video_path": "video_url",
        "template": "",
    },
    "duix_api": {
        "name": "硅基智能 Duix 官方 API",
        "submit_url": "https://api.duix.ai/duix-openapi-v2/sdk/v2/createAvatar",
        "status_url": "https://api.duix.ai/duix-openapi-v2/sdk/v2/queryAvatar",
        "auth_header": "token",
        "auth_scheme": "",
        "task_path": "data.taskId",
        "video_path": "data.coverImage",
        "template": json.dumps(
            {
                "ttsName": "{voice_id}",
                "conversationId": "{avatar_id}",
                "defaultSpeakingLanguage": "zh",
                "greetings": "{script}",
                "name": "{title}",
                "profile": "门店顾问数字人，擅长讲解真实案例、业主痛点和装修避坑建议。",
            },
            ensure_ascii=False,
            indent=2,
        ),
    },
    "heygen": {
        "name": "HeyGen API",
        "submit_url": "https://api.heygen.com/v3/videos",
        "auth_header": "X-Api-Key",
        "auth_scheme": "",
        "task_path": "data.video_id",
        "video_path": "data.video_url",
        "template": json.dumps(
            {
                "type": "avatar",
                "avatar_id": "{avatar_id}",
                "script": "{script}",
                "voice_id": "{voice_id}",
                "title": "{title}",
                "aspect_ratio": "{aspect_ratio}",
                "output_format": "mp4",
                "background_url": "{background_url}",
                "task_type": "{task_type}",
            },
            ensure_ascii=False,
            indent=2,
        ),
    },
    "did": {
        "name": "D-ID API",
        "submit_url": "https://api.d-id.com/talks",
        "auth_header": "x-api-key-external",
        "auth_scheme": "",
        "task_path": "id",
        "video_path": "result_url",
        "template": json.dumps(
            {
                "source_url": "{avatar_id}",
                "script": {
                    "type": "text",
                    "input": "{script}",
                    "provider": {"type": "microsoft", "voice_id": "{voice_id}"},
                },
                "name": "{title}",
                "background_url": "{background_url}",
                "task_type": "{task_type}",
            },
            ensure_ascii=False,
            indent=2,
        ),
    },
}


VOICE_PROVIDER_PRESETS: dict[str, dict[str, str]] = {
    "duix": {
        "name": "Duix / 自建 TTS",
        "submit_url": "",
        "auth_header": "Authorization",
        "auth_scheme": "Bearer",
        "audio_path": "audio_url",
        "template": "",
    },
    "openai_tts": {
        "name": "OpenAI TTS",
        "submit_url": "https://api.openai.com/v1/audio/speech",
        "auth_header": "Authorization",
        "auth_scheme": "Bearer",
        "audio_path": "url",
        "template": json.dumps(
            {"model": "gpt-4o-mini-tts", "voice": "{voice_id}", "input": "{text}", "response_format": "mp3"},
            ensure_ascii=False,
            indent=2,
        ),
    },
    "volcengine_tts": {
        "name": "豆包语音大模型 V3",
        "submit_url": "https://openspeech.bytedance.com/api/v3/tts/unidirectional",
        "auth_header": "X-Api-Key",
        "auth_scheme": "",
        "audio_path": "data.audio",
        "template": json.dumps(
            {
                "user": {"uid": "custom-home-agent"},
                "audio": {"voice_type": "{voice_id}", "encoding": "mp3", "speed_ratio": 1.0},
                "request": {"reqid": "{task_id}", "text": "{text}", "operation": "query"},
            },
            ensure_ascii=False,
            indent=2,
        ),
    },
}


def provider_presets() -> dict[str, dict[str, dict[str, str]]]:
    return {"avatar": AVATAR_PROVIDER_PRESETS, "voice": VOICE_PROVIDER_PRESETS}


def normalize_base_url(url: str) -> str:
    text = str(url or "").strip()
    return text.rstrip("/") if text else ""


def load_settings() -> CloudRuntimeSettings:
    if not SETTINGS_PATH.exists():
        return CloudRuntimeSettings()
    data = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
    allowed = CloudRuntimeSettings.__dataclass_fields__
    return CloudRuntimeSettings(**{key: value for key, value in data.items() if key in allowed})


def save_settings(settings: CloudRuntimeSettings) -> CloudRuntimeSettings:
    settings.heygem_base_url = normalize_base_url(settings.heygem_base_url)
    settings.tts_base_url = normalize_base_url(settings.tts_base_url)
    settings.avatar_submit_url = normalize_base_url(settings.avatar_submit_url)
    settings.avatar_status_url = normalize_base_url(settings.avatar_status_url)
    settings.voice_submit_url = normalize_base_url(settings.voice_submit_url)
    SETTINGS_PATH.write_text(json.dumps(asdict(settings), ensure_ascii=False, indent=2), encoding="utf-8")
    return settings


def public_settings(settings: CloudRuntimeSettings | None = None) -> dict[str, Any]:
    settings = settings or load_settings()
    data = asdict(settings)
    for key in ("api_key", "avatar_api_key", "voice_api_key"):
        data[key] = "***" if data.get(key) else ""
    data["provider_presets"] = provider_presets()
    return data


def _make_headers(
    api_key: str = "",
    auth_header: str = "Authorization",
    auth_scheme: str = "Bearer",
    has_body: bool = False,
) -> dict[str, str]:
    headers = {"Accept": "application/json"}
    if has_body:
        headers["Content-Type"] = "application/json; charset=utf-8"
    if api_key and auth_header:
        value = f"{auth_scheme} {api_key}".strip() if auth_scheme else api_key
        headers[auth_header] = value
    return headers


def _base64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def create_duix_token(app_id: str, app_key: str, sig_exp: int = 1800) -> str:
    """Create a Duix JWT token from appId/appKey without extra dependencies."""
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {"appId": app_id, "iat": now, "exp": now + int(sig_exp)}
    signing_input = ".".join(
        [
            _base64url(json.dumps(header, separators=(",", ":"), ensure_ascii=False).encode("utf-8")),
            _base64url(json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")),
        ]
    )
    signature = hmac.new(app_key.encode("utf-8"), signing_input.encode("ascii"), hashlib.sha256).digest()
    return f"{signing_input}.{_base64url(signature)}"


def _request_json(
    method: str,
    url: str,
    payload: dict[str, Any] | None = None,
    api_key: str = "",
    timeout: int = 60,
    auth_header: str = "Authorization",
    auth_scheme: str = "Bearer",
) -> dict[str, Any]:
    body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers=_make_headers(api_key, auth_header, auth_scheme, body is not None),
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            raw = response.read()
            content_type = response.headers.get("Content-Type", "")
            if "application/json" in content_type:
                return json.loads(raw.decode("utf-8") or "{}")
            return {"ok": True, "status": response.status, "text": raw.decode("utf-8", errors="replace")}
    except urllib.error.HTTPError as exc:
        text = exc.read().decode("utf-8", errors="replace")
        return {"ok": False, "status": exc.code, "error": text}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def _format_template(template: str, values: dict[str, Any]) -> dict[str, Any]:
    if not template.strip():
        return {}
    safe_values = {key: "" if value is None else str(value) for key, value in values.items()}
    rendered = re.sub(
        r"\{([A-Za-z_][A-Za-z0-9_]*)\}",
        lambda match: json.dumps(safe_values.get(match.group(1), match.group(0)), ensure_ascii=False)[1:-1],
        template,
    )
    return json.loads(rendered)


def _deep_get(payload: dict[str, Any], dotted_path: str) -> Any:
    value: Any = payload
    for part in (dotted_path or "").split("."):
        if not part:
            continue
        if isinstance(value, dict):
            value = value.get(part)
        elif isinstance(value, list) and part.isdigit():
            value = value[int(part)]
        else:
            return None
    return value


def health_check(settings: CloudRuntimeSettings | None = None) -> dict[str, Any]:
    settings = settings or load_settings()
    heygem_url = normalize_base_url(settings.heygem_base_url)
    tts_url = normalize_base_url(settings.tts_base_url)
    checks = {
        "heygem": _request_json("GET", heygem_url + "/", api_key=settings.api_key, timeout=8)
        if heygem_url
        else {"ok": False, "error": "未配置 HeyGem 地址"},
        "tts": _request_json("GET", tts_url + "/", api_key=settings.api_key, timeout=8)
        if tts_url
        else {"ok": False, "error": "未配置 TTS 地址"},
        "settings": public_settings(settings),
    }
    if settings.avatar_submit_url:
        checks["avatar_api"] = {"ok": True, "endpoint": settings.avatar_submit_url, "provider": settings.avatar_provider}
    if settings.voice_submit_url:
        checks["voice_api"] = {"ok": True, "endpoint": settings.voice_submit_url, "provider": settings.voice_provider}
    return checks


def build_heygem_task_payload(row: dict[str, Any], settings: CloudRuntimeSettings | None = None) -> dict[str, Any]:
    settings = settings or load_settings()
    script = str(row.get("rewritten_script") or row.get("script") or "").strip()
    title = (row.get("titles") or ["数字人口播视频"])[0]
    return {
        "task_id": f"custom-home-{int(time.time())}",
        "task_name": title,
        "title": title,
        "text": script,
        "script": script,
        "avatar_id": settings.avatar_id,
        "voice_id": settings.voice_id,
        "background_url": row.get("background_url") or "",
        "avatar_asset_url": row.get("avatar_asset_url") or "",
        "voice_asset_url": row.get("voice_asset_url") or "",
        "task_type": row.get("task_type") or row.get("pillar") or "",
        "clone_mode": row.get("clone_mode") or "",
        "aspect_ratio": row.get("aspect_ratio") or "9:16",
        "metadata": {
            "pillar": row.get("pillar"),
            "cover": row.get("cover"),
            "dm_keyword": row.get("dm_keyword"),
            "background": row.get("background"),
            "avatar_asset": row.get("avatar_asset"),
            "voice_asset": row.get("voice_asset"),
            "visual_notes": row.get("visual_notes"),
            "xiaohongshu_video_plan": row.get("xiaohongshu_video_plan") or [],
        },
    }


def build_avatar_task_payload(row: dict[str, Any], settings: CloudRuntimeSettings | None = None) -> dict[str, Any]:
    settings = settings or load_settings()
    default_payload = build_heygem_task_payload(row, settings)
    if not settings.avatar_payload_template.strip():
        return default_payload
    values = {
        **default_payload,
        "api_key": settings.avatar_api_key or settings.api_key,
        "app_id": settings.avatar_app_id,
    }
    return _format_template(settings.avatar_payload_template, values)


def build_voice_task_payload(text: str, settings: CloudRuntimeSettings | None = None) -> dict[str, Any]:
    settings = settings or load_settings()
    task_id = f"voice-{int(time.time())}"
    default_payload = {"task_id": task_id, "text": text, "voice_id": settings.voice_id}
    if not settings.voice_payload_template.strip():
        return default_payload
    values = {
        **default_payload,
        "script": text,
        "title": "语音任务",
        "api_key": settings.voice_api_key or settings.api_key,
        "app_id": settings.voice_app_id,
    }
    return _format_template(settings.voice_payload_template, values)


def _result_ok(result: dict[str, Any]) -> bool:
    return bool(result.get("ok", True)) if "error" not in result else False


def _avatar_auth_value(settings: CloudRuntimeSettings) -> str:
    if settings.avatar_provider == "duix_api" and settings.avatar_app_id and settings.avatar_api_key:
        return create_duix_token(settings.avatar_app_id, settings.avatar_api_key)
    return settings.avatar_api_key or settings.api_key


def submit_heygem_task(row: dict[str, Any], payload_override: dict[str, Any] | None = None) -> dict[str, Any]:
    settings = load_settings()
    if settings.avatar_submit_url:
        payload = payload_override or build_avatar_task_payload(row, settings)
        result = _request_json(
            "POST",
            settings.avatar_submit_url,
            payload=payload,
            api_key=_avatar_auth_value(settings),
            timeout=settings.timeout_seconds,
            auth_header=settings.avatar_auth_header,
            auth_scheme=settings.avatar_auth_scheme,
        )
        return {
            "ok": _result_ok(result),
            "provider": settings.avatar_provider,
            "endpoint": settings.avatar_submit_url,
            "task_id": _deep_get(result, settings.avatar_response_task_path),
            "video_url": _deep_get(result, settings.avatar_response_video_path),
            "payload": payload,
            "response": result,
        }

    base = normalize_base_url(settings.heygem_base_url)
    if not base:
        return {"ok": False, "error": "未配置 HeyGem 云主机地址"}
    payload = payload_override or build_heygem_task_payload(row, settings)
    endpoint = urljoin(base + "/", "easy/submit")
    result = _request_json("POST", endpoint, payload=payload, api_key=settings.api_key, timeout=settings.timeout_seconds)
    return {
        "ok": _result_ok(result),
        "provider": "heygem",
        "endpoint": endpoint,
        "task_id": _deep_get(result, "taskId") or _deep_get(result, "task_id"),
        "payload": payload,
        "response": result,
    }


def submit_tts_task(text: str, payload_override: dict[str, Any] | None = None) -> dict[str, Any]:
    settings = load_settings()
    if settings.voice_submit_url:
        payload = payload_override or build_voice_task_payload(text, settings)
        result = _request_json(
            "POST",
            settings.voice_submit_url,
            payload=payload,
            api_key=settings.voice_api_key or settings.api_key,
            timeout=settings.timeout_seconds,
            auth_header=settings.voice_auth_header,
            auth_scheme=settings.voice_auth_scheme,
        )
        return {
            "ok": _result_ok(result),
            "provider": settings.voice_provider,
            "endpoint": settings.voice_submit_url,
            "audio_url": _deep_get(result, settings.voice_response_audio_path),
            "payload": payload,
            "response": result,
        }

    base = normalize_base_url(settings.tts_base_url)
    if not base:
        return {"ok": False, "error": "未配置 TTS 云主机地址"}
    payload = payload_override or {"text": text, "voice_id": settings.voice_id}
    endpoint = urljoin(base + "/", "v1/invoke")
    result = _request_json("POST", endpoint, payload=payload, api_key=settings.api_key, timeout=settings.timeout_seconds)
    return {
        "ok": _result_ok(result),
        "provider": "duix",
        "endpoint": endpoint,
        "audio_url": _deep_get(result, "audio_url"),
        "payload": payload,
        "response": result,
    }


def query_avatar_task_status(task_id: str, payload_override: dict[str, Any] | None = None) -> dict[str, Any]:
    settings = load_settings()
    task_id = str(task_id or "").strip()
    if not task_id:
        return {"ok": False, "error": "缂哄皯 task_id"}
    if not settings.avatar_status_url:
        return {"ok": False, "error": "鏈厤缃暟瀛椾汉浠诲姟 status URL"}

    if "{task_id}" in settings.avatar_status_url:
        endpoint = settings.avatar_status_url.replace("{task_id}", task_id)
        payload = None
        method = "GET"
    elif settings.avatar_provider == "duix_api" or "queryAvatar" in settings.avatar_status_url:
        separator = "&" if "?" in settings.avatar_status_url else "?"
        endpoint = f"{settings.avatar_status_url}{separator}{urlencode({'taskId': task_id})}"
        payload = None
        method = "GET"
    else:
        endpoint = settings.avatar_status_url
        payload = payload_override or {"taskId": task_id, "task_id": task_id}
        method = "POST"
    result = _request_json(
        method,
        endpoint,
        payload=payload,
        api_key=_avatar_auth_value(settings),
        timeout=settings.timeout_seconds,
        auth_header=settings.avatar_auth_header,
        auth_scheme=settings.avatar_auth_scheme,
    )
    return {
        "ok": _result_ok(result),
        "provider": settings.avatar_provider,
        "endpoint": endpoint,
        "task_id": task_id,
        "status": _deep_get(result, settings.avatar_response_status_path) or _deep_get(result, "data.status"),
        "video_url": _deep_get(result, settings.avatar_response_video_path),
        "payload": payload,
        "response": result,
    }
