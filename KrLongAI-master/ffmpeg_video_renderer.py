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


def resolve_project_path(value: str | None, project_dir: Path, default: str) -> Path:
    """Resolve edit-plan media paths against the project folder.

    A leading slash is treated as project-relative because browser-facing paths
    commonly arrive as "/uploads/..." and Windows would otherwise resolve them
    at the drive root.
    """
    raw_value = str(value or default).strip() or default
    if "://" in raw_value:
        raise ValueError(f"Unsupported URL media path: {raw_value}")

    path = Path(raw_value)
    if path.is_absolute():
        return path

    if raw_value.startswith(("/", "\\")) and not path.drive:
        return project_dir / raw_value.lstrip("/\\")

    return project_dir / raw_value


def _captions_path(project_dir: Path) -> Path:
    return project_dir / "captions" / "captions.srt"


def _output_path(plan: dict[str, Any], project_dir: Path) -> Path:
    render_settings = plan.get("render") if isinstance(plan.get("render"), dict) else {}
    return resolve_project_path(render_settings.get("output"), project_dir, "renders/final.mp4")


def build_ffmpeg_command(
    plan: dict[str, Any],
    project_dir: Path,
    ffmpeg_path: str = "ffmpeg",
) -> list[str]:
    project_dir = Path(project_dir)

    source_path = resolve_project_path(plan.get("sourceTalkingVideo"), project_dir, "uploads/talking.mp4")

    captions_path = _captions_path(project_dir)
    captions_path.parent.mkdir(parents=True, exist_ok=True)

    output_path = _output_path(plan, project_dir)
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


def _failed_render_status(
    command: list[str],
    log_path: Path,
    output_path: Path,
    captions_path: Path,
    message: str,
    returncode: int | None = None,
) -> dict[str, Any]:
    return {
        "ok": False,
        "status": "failed",
        "message": message,
        "returncode": returncode,
        "command": command,
        "log": log_path.as_posix(),
        "output": output_path.as_posix(),
        "captions": captions_path.as_posix(),
    }


def render_edit_plan(
    plan: dict[str, Any],
    project_dir: Path,
    ffmpeg_path: str = "ffmpeg",
    execute: bool = True,
) -> dict[str, Any]:
    project_dir = Path(project_dir)
    captions_path = _captions_path(project_dir)
    write_srt(plan, captions_path)

    logs_dir = project_dir / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    log_path = logs_dir / "ffmpeg.log"

    command: list[str] = []
    try:
        output_path = _output_path(plan, project_dir)
        command = build_ffmpeg_command(plan, project_dir, ffmpeg_path)
    except ValueError as error:
        output_path = project_dir / "renders" / "final.mp4"
        status = _failed_render_status(command, log_path, output_path, captions_path, str(error))
        log_path.write_text(json.dumps(status, ensure_ascii=False, indent=2), encoding="utf-8")
        return status

    if not execute:
        return {"ok": True, "status": "command_ready", "command": command}

    if not ffmpeg_available(ffmpeg_path):
        status = render_status_when_ffmpeg_missing(command)
        log_path.write_text(json.dumps(status, ensure_ascii=False, indent=2), encoding="utf-8")
        return status

    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
    except OSError as error:
        status = _failed_render_status(command, log_path, output_path, captions_path, str(error))
        log_path.write_text(json.dumps(status, ensure_ascii=False, indent=2), encoding="utf-8")
        return status

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
