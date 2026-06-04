#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Local production pipeline helpers for TTS, avatar video, and FFmpeg assembly."""

from __future__ import annotations

import base64
import json
import mimetypes
import os
import re
import shutil
import subprocess
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from cloud_runtime_client import CloudRuntimeSettings, build_heygem_task_payload, load_settings, submit_heygem_task


ROOT = Path(__file__).resolve().parent
ASSET_DIR = ROOT / "digital_human_assets"
OUTPUT_DIR = ROOT / "digital_human_outputs"


def safe_name(name: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', "-", str(name or "").strip())
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" .")
    return cleaned[:80] or "untitled"


def relative_url(path: Path) -> str:
    return "/" + path.resolve().relative_to(ROOT).as_posix()


def file_record(path: Path) -> dict[str, Any]:
    stat = path.stat()
    return {
        "name": path.name,
        "url": relative_url(path),
        "size": stat.st_size,
        "mtime": stat.st_mtime,
    }


def local_path_from_url(url: str | None) -> Path | None:
    text = str(url or "").strip()
    if not text:
        return None
    if text.startswith("/"):
        path = (ROOT / text.lstrip("/")).resolve()
        try:
            path.relative_to(ROOT)
        except ValueError:
            return None
        return path
    candidate = Path(text)
    if candidate.is_absolute():
        return candidate
    return None


def guess_audio_ext(content_type: str, fallback: str = ".mp3") -> str:
    lowered = (content_type or "").lower()
    if "wav" in lowered:
        return ".wav"
    if "mpeg" in lowered or "mp3" in lowered:
        return ".mp3"
    if "ogg" in lowered:
        return ".ogg"
    if "aac" in lowered:
        return ".aac"
    return fallback


def list_pipeline_outputs(limit: int = 50) -> list[dict[str, Any]]:
    if not OUTPUT_DIR.exists():
        return []
    rows: list[dict[str, Any]] = []
    for project_dir in OUTPUT_DIR.iterdir():
        if not project_dir.is_dir():
            continue
        videos = sorted(project_dir.glob("*.mp4"), key=lambda item: item.stat().st_mtime, reverse=True)
        if not videos:
            continue
        subtitle = project_dir / "subtitles.srt"
        latest = videos[0]
        rows.append(
            {
                "name": project_dir.name,
                "updatedAt": latest.stat().st_mtime,
                "video": file_record(latest),
                "subtitle": file_record(subtitle) if subtitle.exists() else None,
                "videos": [file_record(item) for item in videos[:5]],
            }
        )
    rows.sort(key=lambda item: item["updatedAt"], reverse=True)
    return rows[: max(1, int(limit or 50))]


def _json_objects_from_bytes(raw: bytes) -> list[dict[str, Any]]:
    text = raw.decode("utf-8", errors="ignore")
    objects: list[dict[str, Any]] = []
    for line in text.splitlines():
        item = line.strip()
        if not item:
            continue
        if item.startswith("data:"):
            item = item.removeprefix("data:").strip()
        if item == "[DONE]":
            continue
        try:
            parsed = json.loads(item)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            objects.append(parsed)
    if not objects:
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            parsed = None
        if isinstance(parsed, dict):
            objects.append(parsed)
    return objects


def _find_base64_audio(value: Any) -> list[str]:
    found: list[str] = []
    if isinstance(value, dict):
        for key, item in value.items():
            if key.lower() in {"audio", "data", "audio_data", "audiodata"} and isinstance(item, str):
                found.append(item)
            else:
                found.extend(_find_base64_audio(item))
    elif isinstance(value, list):
        for item in value:
            found.extend(_find_base64_audio(item))
    return found


@dataclass
class DoubaoTTSRequest:
    text: str
    voice_type: str
    api_key: str
    resource_id: str = "seed-tts-2.0"
    endpoint: str = "https://openspeech.bytedance.com/api/v3/tts/unidirectional"
    audio_format: str = "mp3"
    speed_ratio: float = 1.0
    project: str = "digital-human"


def build_doubao_tts_payload(request: DoubaoTTSRequest) -> dict[str, Any]:
    return {
        "user": {"uid": "custom-home-agent"},
        "audio": {
            "voice_type": request.voice_type,
            "encoding": request.audio_format,
            "speed_ratio": request.speed_ratio,
        },
        "request": {
            "reqid": f"doubao-tts-{int(time.time() * 1000)}",
            "text": request.text,
            "operation": "query",
        },
    }


def request_doubao_tts(request: DoubaoTTSRequest, timeout: int = 120) -> tuple[bytes, dict[str, Any]]:
    payload = build_doubao_tts_payload(request)
    headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Accept": "application/json, audio/*",
        "X-Api-Key": request.api_key,
        "X-Api-Resource-Id": request.resource_id,
    }
    http_request = urllib.request.Request(
        request.endpoint,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(http_request, timeout=timeout) as response:
            raw = response.read()
            content_type = response.headers.get("Content-Type", "")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Doubao TTS HTTP {exc.code}: {detail}") from exc
    except Exception as exc:
        raise RuntimeError(f"Doubao TTS request failed: {exc}") from exc

    if content_type.startswith("audio/"):
        return raw, {"payload": payload, "content_type": content_type}

    chunks: list[bytes] = []
    parsed_objects = _json_objects_from_bytes(raw)
    for parsed in parsed_objects:
        for item in _find_base64_audio(parsed):
            try:
                chunks.append(base64.b64decode(item))
            except Exception:
                continue
    if chunks:
        return b"".join(chunks), {"payload": payload, "content_type": content_type, "events": parsed_objects}

    raise RuntimeError("Doubao TTS response did not contain decodable audio data")


def generate_doubao_tts_audio(payload: dict[str, Any], settings: CloudRuntimeSettings | None = None) -> dict[str, Any]:
    settings = settings or load_settings()
    text = str(payload.get("text") or payload.get("script") or "").strip()
    if not text:
        return {"ok": False, "error": "缺少要合成的文案"}
    api_key = str(payload.get("api_key") or settings.voice_api_key or settings.api_key or "").strip()
    if not api_key:
        return {"ok": False, "error": "缺少豆包语音 API Key，请先在设置页保存 voice_api_key"}
    voice_type = str(payload.get("voice_type") or settings.voice_id or "").strip()
    if not voice_type:
        return {"ok": False, "error": "缺少 voice_type，请在设置页填写声音 ID"}

    resource_id = str(payload.get("resource_id") or settings.voice_app_id or "seed-tts-2.0").strip()
    endpoint = str(payload.get("endpoint") or settings.voice_submit_url or DoubaoTTSRequest.endpoint).strip()
    project = safe_name(str(payload.get("project") or payload.get("name") or "digital-human"))
    audio_format = str(payload.get("audio_format") or "mp3").strip().lstrip(".") or "mp3"
    speed_ratio = float(payload.get("speed_ratio") or 1.0)
    request = DoubaoTTSRequest(
        text=text,
        voice_type=voice_type,
        api_key=api_key,
        resource_id=resource_id,
        endpoint=endpoint,
        audio_format=audio_format,
        speed_ratio=speed_ratio,
        project=project,
    )
    try:
        audio, meta = request_doubao_tts(request, timeout=settings.timeout_seconds or 120)
    except Exception as exc:
        return {"ok": False, "error": str(exc)}

    ext = "." + audio_format if audio_format else guess_audio_ext(meta.get("content_type", ""))
    target_dir = ASSET_DIR / "voice" / "generated" / project
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / f"doubao-{int(time.time())}{ext}"
    target.write_bytes(audio)
    return {
        "ok": True,
        "provider": "doubao_tts_v3",
        "file": {"name": target.name, "url": relative_url(target), "size": target.stat().st_size},
        "resource_id": resource_id,
        "voice_type": voice_type,
        "payload": meta.get("payload"),
    }


def submit_avatar_or_lipsync_video(payload: dict[str, Any]) -> dict[str, Any]:
    row = build_heygem_task_payload(
        {
            "titles": [payload.get("title") or payload.get("name") or "数字人口播视频"],
            "script": payload.get("script") or "",
            "rewritten_script": payload.get("script") or "",
            "background_url": (payload.get("background") or {}).get("url", ""),
            "avatar_asset_url": (payload.get("avatar") or {}).get("url", ""),
            "voice_asset_url": (payload.get("voice") or {}).get("url", ""),
            "aspect_ratio": payload.get("aspect_ratio") or "9:16",
            "task_type": "avatar_video",
            "clone_mode": payload.get("clone_mode") or "",
            "visual_notes": payload.get("visual_notes") or "",
        }
    )
    result = submit_heygem_task(row, payload.get("payload"))
    return {"ok": result.get("ok", False), "row": row, "result": result}


def ffmpeg_path() -> str | None:
    env_path = os.environ.get("FFMPEG_BINARY")
    if env_path and Path(env_path).exists():
        return env_path
    bundled = ROOT / "ffmpeg" / "bin" / "ffmpeg.exe"
    if bundled.exists():
        return str(bundled)
    return shutil.which("ffmpeg")


def make_srt(script: str, target: Path, duration_seconds: float = 18.0) -> Path:
    clean = re.sub(r"\s+", " ", script or "").strip()
    chunks = [item.strip() for item in re.split(r"(?<=[。！？!?])", clean) if item.strip()]
    if not chunks:
        chunks = [clean or "数字人口播视频"]
    per = max(2.0, duration_seconds / max(1, len(chunks)))

    def fmt(seconds: float) -> str:
        millis = int(seconds * 1000)
        hh, rem = divmod(millis, 3600_000)
        mm, rem = divmod(rem, 60_000)
        ss, ms = divmod(rem, 1000)
        return f"{hh:02}:{mm:02}:{ss:02},{ms:03}"

    lines = []
    for index, chunk in enumerate(chunks, start=1):
        start = (index - 1) * per
        end = start + per - 0.05
        lines.extend([str(index), f"{fmt(start)} --> {fmt(end)}", chunk, ""])
    target.write_text("\n".join(lines), encoding="utf-8")
    return target


def compose_with_ffmpeg(payload: dict[str, Any]) -> dict[str, Any]:
    binary = ffmpeg_path()
    if not binary:
        return {"ok": False, "error": "未找到 FFmpeg。请把 ffmpeg 加入 PATH，或放到 ffmpeg/bin/ffmpeg.exe"}

    name = safe_name(str(payload.get("name") or payload.get("title") or "digital-human-video"))
    background = local_path_from_url((payload.get("background") or {}).get("url") or payload.get("background_url"))
    avatar_video = local_path_from_url((payload.get("avatar_video") or {}).get("url") or payload.get("avatar_video_url"))
    audio = local_path_from_url((payload.get("voice") or {}).get("url") or payload.get("voice_url"))
    if not background or not background.exists():
        return {"ok": False, "error": "缺少可访问的本地背景素材"}
    if not avatar_video or not avatar_video.exists():
        return {"ok": False, "error": "缺少可访问的本地数字人口播/唇形视频"}
    if not audio or not audio.exists():
        return {"ok": False, "error": "缺少可访问的本地配音音频"}

    aspect_ratio = str(payload.get("aspect_ratio") or "9:16")
    width, height = {"16:9": (1920, 1080), "1:1": (1080, 1080)}.get(aspect_ratio, (1080, 1920))
    project_dir = OUTPUT_DIR / name
    project_dir.mkdir(parents=True, exist_ok=True)
    output = project_dir / f"{name}-{int(time.time())}.mp4"
    srt = make_srt(str(payload.get("script") or ""), project_dir / "subtitles.srt")
    is_image_bg = (mimetypes.guess_type(background.name)[0] or "").startswith("image/")

    inputs = [binary, "-y"]
    if is_image_bg:
        inputs.extend(["-loop", "1", "-framerate", "30", "-i", str(background)])
    else:
        inputs.extend(["-stream_loop", "-1", "-i", str(background)])
    inputs.extend(["-i", str(avatar_video), "-i", str(audio)])

    subtitle_path = str(srt).replace("\\", "/").replace(":", "\\:")
    filter_complex = (
        f"[0:v]scale={width}:{height}:force_original_aspect_ratio=increase,"
        f"crop={width}:{height},setsar=1[bg];"
        f"[1:v]scale={int(width * 0.52)}:-1:force_original_aspect_ratio=decrease[person];"
        f"[bg][person]overlay=(W-w)/2:H-h-110,"
        f"subtitles='{subtitle_path}':force_style='FontName=Microsoft YaHei,FontSize=38,"
        f"PrimaryColour=&H00FFFFFF,OutlineColour=&H8A000000,BorderStyle=1,Outline=2,Shadow=1'[v]"
    )
    command = [
        *inputs,
        "-filter_complex",
        filter_complex,
        "-map",
        "[v]",
        "-map",
        "2:a:0",
        "-shortest",
        "-r",
        "30",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        str(output),
    ]
    completed = subprocess.run(command, cwd=str(ROOT), capture_output=True, text=True, timeout=600)
    if completed.returncode != 0:
        return {"ok": False, "error": completed.stderr[-4000:], "command": command}
    return {
        "ok": True,
        "file": {"name": output.name, "url": relative_url(output), "size": output.stat().st_size},
        "subtitle": {"name": srt.name, "url": relative_url(srt), "size": srt.stat().st_size},
        "command": command,
    }
