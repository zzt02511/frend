import json
import re
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


FILLER_WORD_RE = re.compile(r"\b(?:um|uh|erm|ah)\b[,，、]?\s*|(?:嗯|啊|呃|这个|那个|然后呢|就是说)[,，、]?", re.IGNORECASE)


def _cleanup_settings(plan: dict[str, Any]) -> dict[str, Any]:
    return plan.get("cleanup") if isinstance(plan.get("cleanup"), dict) else {}


def _clean_caption_text(text: str, plan: dict[str, Any]) -> str:
    if not _cleanup_settings(plan).get("removeFillerWords"):
        return str(text or "")
    cleaned = FILLER_WORD_RE.sub("", str(text or ""))
    cleaned = re.sub(r"\s*[,，、]\s+", " ", cleaned)
    cleaned = re.sub(r"\s+([.!?。！？])", r"\1", cleaned)
    cleaned = re.sub(r"\s{2,}", " ", cleaned)
    return cleaned.strip()


def write_srt(plan: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    blocks = []
    for index, segment in enumerate(plan.get("segments", []), start=1):
        start = _format_srt_time(float(segment.get("start", 0.0)))
        end = _format_srt_time(float(segment.get("end", 0.0)))
        text = _clean_caption_text(str(segment.get("text", "")), plan)
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


def _source_path(plan: dict[str, Any], project_dir: Path) -> Path:
    return resolve_project_path(plan.get("sourceTalkingVideo"), project_dir, "uploads/talking.mp4")


def _preprocessed_source_path(project_dir: Path) -> Path:
    return project_dir / "processed" / "talking_trimmed.mp4"


def _effective_source_path(plan: dict[str, Any], project_dir: Path) -> Path:
    if _cleanup_settings(plan).get("trimSilence"):
        return _preprocessed_source_path(project_dir)
    return _source_path(plan, project_dir)


def parse_silence_intervals(log_text: str) -> list[tuple[float, float]]:
    starts: list[float] = []
    intervals: list[tuple[float, float]] = []
    for line in str(log_text or "").splitlines():
        start_match = re.search(r"silence_start:\s*([0-9.]+)", line)
        if start_match:
            starts.append(float(start_match.group(1)))
            continue
        end_match = re.search(r"silence_end:\s*([0-9.]+)", line)
        if end_match and starts:
            start = starts.pop(0)
            end = float(end_match.group(1))
            if end > start:
                intervals.append((start, end))
    return intervals


def _duration_target(plan: dict[str, Any]) -> float | None:
    try:
        value = float(plan.get("durationTarget") or 0)
    except (TypeError, ValueError):
        value = 0
    if value > 0:
        return value
    segments = plan.get("segments") or []
    if segments:
        try:
            return float(segments[-1].get("end") or 0)
        except (TypeError, ValueError):
            return None
    return None


def build_silence_detect_command(plan: dict[str, Any], project_dir: Path, ffmpeg_path: str = "ffmpeg") -> list[str]:
    cleanup = _cleanup_settings(plan)
    threshold = str(cleanup.get("silenceThreshold") or "-35dB")
    minimum = float(cleanup.get("minimumSilence") or 0.35)
    source_path = _source_path(plan, project_dir)
    return [
        ffmpeg_path,
        "-y",
        "-i",
        source_path.as_posix(),
        "-af",
        f"silencedetect=n={threshold}:d={minimum:.2f}",
        "-f",
        "null",
        "-",
    ]


def build_silence_trim_command(
    plan: dict[str, Any],
    project_dir: Path,
    ffmpeg_path: str = "ffmpeg",
    silence_intervals: list[tuple[float, float]] | None = None,
) -> list[str]:
    source_path = _source_path(plan, project_dir)
    output_path = _preprocessed_source_path(project_dir)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    intervals = sorted(silence_intervals or [])
    if not intervals:
        return [
            ffmpeg_path,
            "-y",
            "-i",
            source_path.as_posix(),
            "-c",
            "copy",
            output_path.as_posix(),
        ]

    keep_ranges: list[tuple[float, float | None]] = []
    cursor = 0.0
    for start, end in intervals:
        if start > cursor + 0.03:
            keep_ranges.append((cursor, start))
        cursor = max(cursor, end)
    duration = _duration_target(plan)
    if duration and cursor < duration - 0.03:
        keep_ranges.append((cursor, duration))
    elif duration is None:
        keep_ranges.append((cursor, None))
    if not keep_ranges:
        keep_ranges.append((0.0, duration))

    chains: list[str] = []
    concat_inputs: list[str] = []
    for index, (start, end) in enumerate(keep_ranges):
        end_part = f":end={end:.2f}" if end is not None else ""
        chains.append(f"[0:v]trim=start={start:.2f}{end_part},setpts=PTS-STARTPTS[v{index}]")
        chains.append(f"[0:a]atrim=start={start:.2f}{end_part},asetpts=PTS-STARTPTS[a{index}]")
        concat_inputs.append(f"[v{index}][a{index}]")
    chains.append(f"{''.join(concat_inputs)}concat=n={len(keep_ranges)}:v=1:a=1[vout][aout]")
    return [
        ffmpeg_path,
        "-y",
        "-i",
        source_path.as_posix(),
        "-filter_complex",
        ";".join(chains),
        "-map",
        "[vout]",
        "-map",
        "[aout]",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-c:a",
        "aac",
        output_path.as_posix(),
    ]


def _asset_by_id(plan: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {str(item.get("id")): item for item in plan.get("materials") or [] if item.get("id")}


def _escape_drawtext(value: str) -> str:
    return str(value or "").replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'").replace("%", "\\%")


def _collect_broll_inputs(plan: dict[str, Any], project_dir: Path) -> list[tuple[str, Path, float, float]]:
    assets = _asset_by_id(plan)
    collected: list[tuple[str, Path, float, float]] = []
    for segment in plan.get("segments") or []:
        segment_start = float(segment.get("start") or 0)
        for slot in segment.get("brollSlots") or []:
            asset = assets.get(str(slot.get("assetId")))
            if not asset:
                continue
            source = asset.get("url") or asset.get("path") or ""
            if not source:
                continue
            start = segment_start + float(slot.get("startOffset") or 0)
            duration = float(slot.get("duration") or 2.5)
            collected.append(
                (
                    str(asset.get("id")),
                    resolve_project_path(str(source), project_dir, ""),
                    start,
                    duration,
                )
            )
    return collected


def _subtitle_filter_path(path: Path) -> str:
    return path.as_posix().replace(":", "\\:").replace("'", "\\'")


def _plan_duration(plan: dict[str, Any]) -> float:
    try:
        duration = float(plan.get("durationTarget") or 0)
    except (TypeError, ValueError):
        duration = 0.0
    if duration > 0:
        return duration
    segment_ends = []
    for segment in plan.get("segments") or []:
        try:
            segment_ends.append(float(segment.get("end") or 0))
        except (TypeError, ValueError):
            continue
    return max(segment_ends, default=1.0)


def _progress_bar_filters(plan: dict[str, Any], width: int, steps: int = 12) -> list[str]:
    duration = max(_plan_duration(plan), 1.0)
    filters = []
    for step in range(1, steps + 1):
        start = duration * (step - 1) / steps
        bar_width = max(1, round(width * step / steps))
        filters.append(
            f"drawbox=x=0:y=h-10:w={bar_width}:h=10:color=#67d391@0.85:t=fill:enable='gte(t,{start:.2f})'"
        )
    return filters


def _base_video_filter(plan: dict[str, Any], captions_path: Path) -> str:
    width, height = _target_size(str(plan.get("aspectRatio") or "9:16"))
    subtitles_path = _subtitle_filter_path(captions_path)
    overlays = plan.get("overlays") if isinstance(plan.get("overlays"), dict) else {}
    title = _escape_drawtext(overlays.get("title") or "")
    cta = _escape_drawtext(overlays.get("cta") or "")
    filters = [
        f"scale={width}:{height}:force_original_aspect_ratio=increase",
        f"crop={width}:{height}",
        "setsar=1",
        (
            f"subtitles='{subtitles_path}':force_style='"
            "FontName=Microsoft YaHei,"
            "FontSize=54,"
            "PrimaryColour=&H00FFFFFF&,"
            "OutlineColour=&H00000000&,"
            "Outline=2,"
            "Shadow=1,"
            "Alignment=2,"
            "MarginV=90'"
        ),
    ]
    if title:
        filters.append(
            f"drawtext=text='{title}':x=(w-text_w)/2:y=90:fontsize=52:fontcolor=white:borderw=3:bordercolor=black@0.55"
        )
    if cta:
        filters.append(
            f"drawtext=text='{cta}':x=(w-text_w)/2:y=h-190:fontsize=34:fontcolor=white:borderw=3:bordercolor=black@0.55"
        )
    if overlays.get("progressBar", False):
        filters.extend(_progress_bar_filters(plan, width))
    return ",".join(filters)


def _build_filter_complex(
    plan: dict[str, Any],
    captions_path: Path,
    brolls: list[tuple[str, Path, float, float]],
    has_bgm: bool,
) -> tuple[str, str, str]:
    width, height = _target_size(str(plan.get("aspectRatio") or "9:16"))
    base = _base_video_filter(plan, captions_path)
    base_label = "progress" if (plan.get("overlays") or {}).get("progressBar", False) else "vbase"
    chains = [f"[0:v]{base}[{base_label}]"]
    current = base_label
    for index, (_, _, start, duration) in enumerate(brolls, start=1):
        broll_input = index
        broll_label = f"broll{index}"
        out_label = f"vout{index}"
        end = start + duration
        chains.append(
            f"[{broll_input}:v]trim=duration={duration:.2f},setpts=PTS-STARTPTS+{start:.2f}/TB,"
            f"scale={width}:{height}:force_original_aspect_ratio=increase,"
            f"crop={width}:{height},setsar=1,format=rgba,colorchannelmixer=aa=0.96[{broll_label}]"
        )
        chains.append(
            f"[{current}][{broll_label}]overlay=0:0:enable='between(t,{start:.2f},{end:.2f})'[{out_label}]"
        )
        current = out_label
    if has_bgm:
        bgm_input = 1 + len(brolls)
        chains.append(f"[{bgm_input}:a]volume=0.18[bgm]")
        chains.append("[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]")
    return ";".join(chains), current, "aout" if has_bgm else "0:a?"


def build_ffmpeg_command(
    plan: dict[str, Any],
    project_dir: Path,
    ffmpeg_path: str = "ffmpeg",
) -> list[str]:
    project_dir = Path(project_dir)

    source_path = _effective_source_path(plan, project_dir)

    captions_path = _captions_path(project_dir)
    captions_path.parent.mkdir(parents=True, exist_ok=True)

    output_path = _output_path(plan, project_dir)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    brolls = _collect_broll_inputs(plan, project_dir)
    audio_settings = plan.get("audio") if isinstance(plan.get("audio"), dict) else {}
    bgm_path = audio_settings.get("bgmPath")
    has_bgm = bool(bgm_path)
    filter_complex, video_label, audio_label = _build_filter_complex(plan, captions_path, brolls, has_bgm)

    command = [
        ffmpeg_path,
        "-y",
        "-i",
        source_path.as_posix(),
    ]
    for _, path, _, _ in brolls:
        command.extend(["-i", path.as_posix()])
    if has_bgm:
        command.extend(["-i", resolve_project_path(str(bgm_path), project_dir, "").as_posix()])

    command.extend(
        [
            "-filter_complex",
            filter_complex,
            "-map",
            f"[{video_label}]",
            "-map",
            f"[{audio_label}]" if has_bgm else audio_label,
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-c:a",
            "aac",
            "-shortest",
            "-movflags",
            "+faststart",
            output_path.as_posix(),
        ]
    )
    return command


def build_cover_command(
    plan: dict[str, Any],
    project_dir: Path,
    ffmpeg_path: str = "ffmpeg",
) -> list[str]:
    project_dir = Path(project_dir)
    source_path = _effective_source_path(plan, project_dir)
    cover_settings = plan.get("cover") if isinstance(plan.get("cover"), dict) else {}
    frame_at = str(cover_settings.get("frameAt") or 1.2)
    output_path = project_dir / "renders" / "cover.jpg"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    width, height = _target_size(str(plan.get("aspectRatio") or "9:16"))
    cover_text = _escape_drawtext(cover_settings.get("text") or (plan.get("overlays") or {}).get("title") or "")
    video_filter = (
        f"scale={width}:{height}:force_original_aspect_ratio=increase,"
        f"crop={width}:{height},"
        f"drawtext=text='{cover_text}':x=(w-text_w)/2:y=h*0.16:"
        "fontsize=62:fontcolor=white:borderw=4:bordercolor=black@0.6"
    )
    return [
        ffmpeg_path,
        "-y",
        "-ss",
        frame_at,
        "-i",
        source_path.as_posix(),
        "-frames:v",
        "1",
        "-vf",
        video_filter,
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
    preprocess_command: list[str] = []
    preprocess_detect_command: list[str] = []
    try:
        output_path = _output_path(plan, project_dir)
        if _cleanup_settings(plan).get("trimSilence"):
            preprocess_detect_command = build_silence_detect_command(plan, project_dir, ffmpeg_path)
            preprocess_command = preprocess_detect_command
        command = build_ffmpeg_command(plan, project_dir, ffmpeg_path)
    except ValueError as error:
        output_path = project_dir / "renders" / "final.mp4"
        status = _failed_render_status(command, log_path, output_path, captions_path, str(error))
        log_path.write_text(json.dumps(status, ensure_ascii=False, indent=2), encoding="utf-8")
        return status

    if not execute:
        result = {"ok": True, "status": "command_ready", "command": command}
        if preprocess_detect_command:
            result["preprocessCommand"] = preprocess_detect_command
            result["preprocessedSource"] = _preprocessed_source_path(project_dir).as_posix()
        return result

    if not ffmpeg_available(ffmpeg_path):
        status = render_status_when_ffmpeg_missing(command)
        if preprocess_command:
            status["preprocessCommand"] = preprocess_command
        log_path.write_text(json.dumps(status, ensure_ascii=False, indent=2), encoding="utf-8")
        return status

    preprocess_log = ""
    if preprocess_detect_command:
        try:
            detected = subprocess.run(
                preprocess_detect_command,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                check=False,
            )
        except OSError as error:
            status = _failed_render_status(preprocess_detect_command, log_path, output_path, captions_path, str(error))
            status["preprocessCommand"] = preprocess_detect_command
            log_path.write_text(json.dumps(status, ensure_ascii=False, indent=2), encoding="utf-8")
            return status
        detect_text = (detected.stdout or "") + (detected.stderr or "")
        preprocess_log = "# silence detect\n" + detect_text
        if detected.returncode != 0:
            status = _failed_render_status(
                preprocess_detect_command,
                log_path,
                output_path,
                captions_path,
                "FFmpeg silence detection failed",
                detected.returncode,
            )
            status["preprocessCommand"] = preprocess_detect_command
            log_path.write_text(preprocess_log, encoding="utf-8")
            return status

        preprocess_command = build_silence_trim_command(plan, project_dir, ffmpeg_path, parse_silence_intervals(detect_text))
        try:
            preprocessed = subprocess.run(
                preprocess_command,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                check=False,
            )
        except OSError as error:
            status = _failed_render_status(preprocess_command, log_path, output_path, captions_path, str(error))
            status["preprocessDetectCommand"] = preprocess_detect_command
            status["preprocessCommand"] = preprocess_command
            log_path.write_text(json.dumps(status, ensure_ascii=False, indent=2), encoding="utf-8")
            return status
        preprocess_log += "\n# preprocess\n" + (preprocessed.stdout or "") + (preprocessed.stderr or "")
        if preprocessed.returncode != 0:
            status = _failed_render_status(
                preprocess_command,
                log_path,
                output_path,
                captions_path,
                "FFmpeg silence trim preprocessing failed",
                preprocessed.returncode,
            )
            status["preprocessDetectCommand"] = preprocess_detect_command
            status["preprocessCommand"] = preprocess_command
            log_path.write_text(preprocess_log, encoding="utf-8")
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

    log_text = preprocess_log + (("\n# render\n") if preprocess_log else "") + (completed.stdout or "") + (completed.stderr or "")
    log_path.write_text(log_text, encoding="utf-8")

    if completed.returncode != 0:
        return {
            "ok": False,
            "status": "failed",
            "returncode": completed.returncode,
            "command": command,
            "preprocessDetectCommand": preprocess_detect_command or None,
            "preprocessCommand": preprocess_command or None,
            "log": log_path.as_posix(),
            "output": output_path.as_posix(),
            "captions": captions_path.as_posix(),
        }

    cover_command = build_cover_command(plan, project_dir, ffmpeg_path)
    try:
        cover_result = subprocess.run(
            cover_command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
    except OSError as error:
        with log_path.open("a", encoding="utf-8") as handle:
            handle.write("\n\n# cover\n")
            handle.write(str(error))
        status = _failed_render_status(command, log_path, output_path, captions_path, str(error), None)
        status["coverCommand"] = cover_command
        status["coverReturncode"] = None
        status["cover"] = (project_dir / "renders" / "cover.jpg").as_posix()
        return status

    with log_path.open("a", encoding="utf-8") as handle:
        handle.write("\n\n# cover\n")
        handle.write((cover_result.stdout or "") + (cover_result.stderr or ""))

    cover_path = project_dir / "renders" / "cover.jpg"
    cover_ok = cover_result.returncode == 0
    result = {
        "ok": cover_ok,
        "status": "done" if cover_ok else "failed",
        "returncode": completed.returncode,
        "command": command,
        "preprocessDetectCommand": preprocess_detect_command or None,
        "preprocessCommand": preprocess_command or None,
        "coverCommand": cover_command,
        "coverReturncode": cover_result.returncode,
        "log": log_path.as_posix(),
        "output": output_path.as_posix(),
        "captions": captions_path.as_posix(),
        "cover": cover_path.as_posix(),
    }
    return result
