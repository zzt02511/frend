import json
import shutil
import subprocess
from pathlib import Path
from typing import Any


def ffmpeg_available(ffmpeg_path: str = "ffmpeg") -> bool:
    return Path(ffmpeg_path).exists() or shutil.which(ffmpeg_path) is not None


def _format_srt_time(seconds: float) -> str:
    total_milliseconds = max(0, int(round(float(seconds) * 1000)))
    hours, remainder = divmod(total_milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    whole_seconds, milliseconds = divmod(remainder, 1000)
    return f"{hours:02}:{minutes:02}:{whole_seconds:02},{milliseconds:03}"


def write_srt(plan: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    blocks = []
    for index, segment in enumerate(plan.get("segments", []), start=1):
        start = _format_srt_time(float(segment.get("start", 0.0)))
        end = _format_srt_time(float(segment.get("end", 0.0)))
        text = str(segment.get("text", ""))
        blocks.append(f"{index}\n{start} --> {end}\n{text}")

    path.write_text("\n\n".join(blocks) + ("\n" if blocks else ""), encoding="utf-8")


def _target_size(aspect_ratio: str) -> tuple[int, int]:
    sizes = {
        "16:9": (1920, 1080),
        "1:1": (1080, 1080),
        "3:4": (1080, 1440),
        "9:16": (1080, 1920),
    }
    return sizes.get(str(aspect_ratio).strip(), sizes["9:16"])


def build_ffmpeg_command(
    plan: dict[str, Any],
    project_dir: Path,
    ffmpeg_path: str = "ffmpeg",
) -> list[str]:
    project_dir = Path(project_dir)

    source_value = plan.get("sourceTalkingVideo") or "uploads/talking.mp4"
    source_path = Path(source_value)
    if not source_path.is_absolute():
        source_path = project_dir / source_path

    captions_path = project_dir / "captions" / "captions.srt"
    captions_path.parent.mkdir(parents=True, exist_ok=True)

    render_settings = plan.get("render") if isinstance(plan.get("render"), dict) else {}
    output_value = render_settings.get("output") or "renders/final.mp4"
    output_path = Path(output_value)
    if not output_path.is_absolute():
        output_path = project_dir / output_path
    output_path.parent.mkdir(parents=True, exist_ok=True)

    width, height = _target_size(plan.get("aspectRatio", "9:16"))
    subtitles_path = captions_path.as_posix().replace(":", "\\:").replace("'", "\\'")
    video_filter = (
        f"scale={width}:{height}:force_original_aspect_ratio=increase,"
        f"crop={width}:{height},setsar=1,"
        f"subtitles='{subtitles_path}':force_style='"
        "FontName=Microsoft YaHei,"
        "FontSize=54,"
        "PrimaryColour=&H00FFFFFF&,"
        "OutlineColour=&H00000000&,"
        "Outline=2,"
        "Shadow=1,"
        "Alignment=2,"
        "MarginV=90'"
    )

    return [
        ffmpeg_path,
        "-y",
        "-i",
        source_path.as_posix(),
        "-vf",
        video_filter,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        output_path.as_posix(),
    ]


def render_status_when_ffmpeg_missing(command: list[str]) -> dict[str, Any]:
    return {
        "ok": False,
        "status": "missing_ffmpeg",
        "message": "未找到 FFmpeg，请先安装 FFmpeg 或配置 ffmpeg_path。",
        "command": command,
    }


def render_edit_plan(
    plan: dict[str, Any],
    project_dir: Path,
    ffmpeg_path: str = "ffmpeg",
    execute: bool = True,
) -> dict[str, Any]:
    project_dir = Path(project_dir)
    captions_path = project_dir / "captions" / "captions.srt"
    write_srt(plan, captions_path)
    command = build_ffmpeg_command(plan, project_dir, ffmpeg_path)

    logs_dir = project_dir / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    log_path = logs_dir / "ffmpeg.log"

    render_settings = plan.get("render") if isinstance(plan.get("render"), dict) else {}
    output_value = render_settings.get("output") or "renders/final.mp4"
    output_path = Path(output_value)
    if not output_path.is_absolute():
        output_path = project_dir / output_path

    if not ffmpeg_available(ffmpeg_path):
        status = render_status_when_ffmpeg_missing(command)
        log_path.write_text(json.dumps(status, ensure_ascii=False, indent=2), encoding="utf-8")
        return status

    if not execute:
        return {"ok": True, "status": "command_ready", "command": command}

    completed = subprocess.run(
        command,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    log_text = (completed.stdout or "") + (completed.stderr or "")
    log_path.write_text(log_text, encoding="utf-8")

    result = {
        "ok": completed.returncode == 0,
        "status": "done" if completed.returncode == 0 else "failed",
        "returncode": completed.returncode,
        "command": command,
        "log": log_path.as_posix(),
        "output": output_path.as_posix(),
        "captions": captions_path.as_posix(),
    }
    return result
