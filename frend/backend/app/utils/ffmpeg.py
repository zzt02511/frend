"""FFmpeg 命令构建工具"""

import os
import shlex
from typing import Optional
from app.config import settings


def _detect_hwaccel() -> str:
    """检测可用的硬件加速编码器"""
    import subprocess
    try:
        result = subprocess.run(
            [settings.ffmpeg_path, "-encoders"],
            capture_output=True, text=True, timeout=5,
        )
        encoders = result.stdout + result.stderr
        if "h264_amf" in encoders:
            return "h264_amf"   # AMD GPU
        if "h264_nvenc" in encoders:
            return "h264_nvenc"  # NVIDIA GPU
        if "h264_qsv" in encoders:
            return "h264_qsv"    # Intel QuickSync
        if "h264_videotoolbox" in encoders:
            return "h264_videotoolbox"  # macOS
    except Exception:
        pass
    return ""  # 无硬件加速，回退到 libx264


# 启动时检测一次
_HWACCEL_ENCODER = _detect_hwaccel()


def _get_font_spec(font_path: str = "") -> str:
    """获取适用于 drawtext 的字体系列或文件路径参数

    在 Windows 上优先使用 fontfile= 绝对路径，避免 fontconfig 缺失问题。
    """
    if font_path and os.path.exists(font_path):
        # 使用绝对路径 + fontfile 参数
        escaped = _escape_ffmpeg_path(font_path)
        return f"fontfile='{escaped}'"
    # 尝试自动检测 Windows 字体
    win_fonts = [
        "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/simsun.ttc",
        "C:/Windows/Fonts/simhei.ttf",
        "C:/Windows/Fonts/yahei.ttf",
    ]
    for fp in win_fonts:
        if os.path.exists(fp):
            escaped = _escape_ffmpeg_path(fp)
            return f"fontfile='{escaped}'"
    # 最后尝试 fontconfig 名称
    return "font='SimSun'"


def build_scene_command(
    output_path: str,
    width: int = 1080,
    height: int = 1920,
    fps: int = 30,
    duration: float = 5.0,
    bg_color: str = "#1a1a2e",
    text_content: str = "",
    text_color: str = "#ffffff",
    text_size: int = 48,
    font_path: str = "",
    image_path: str = "",
    transition: str = "fade_in",
    scene_index: int = 0,
) -> list[str]:
    """构建单个场景渲染的 FFmpeg 命令"""
    cmd = [
        settings.ffmpeg_path,
        "-f", "lavfi",
        "-i", f"color=c={bg_color}:s={width}x{height}:d={duration}:r={fps}",
    ]

    # 启用硬件加速（如果有）
    hwaccel_opts = []
    if _HWACCEL_ENCODER == "h264_amf":
        hwaccel_opts = ["-hwaccel", "d3d11va"]
    elif _HWACCEL_ENCODER == "h264_nvenc":
        hwaccel_opts = ["-hwaccel", "cuda"]
    elif _HWACCEL_ENCODER == "h264_qsv":
        hwaccel_opts = ["-hwaccel", "qsv"]

    filter_parts = []

    # 文本叠加
    if text_content:
        escaped_text = _escape_ffmpeg_text(text_content)
        font_spec = _get_font_spec(font_path)
        drawtext = (
            f"drawtext=text='{escaped_text}'"
            f":{font_spec}"
            f":fontsize={text_size}"
            f":fontcolor={text_color}"
            f":x=(w-text_w)/2"
            f":y=(h-text_h)/2"
            f":enable='between(t,0,{duration})'"
        )
        filter_parts.append(drawtext)

    # 图像叠加
    if image_path and os.path.exists(image_path):
        cmd.extend(["-i", image_path])
        img_w = min(width // 2, 600)
        img_x = (width - img_w) // 2
        img_y = (height - img_w) // 2
        filter_parts = [f"overlay={img_x}:{img_y}:enable='between(t,0,{duration})'"]

    # 构建 filter_complex
    if filter_parts:
        filter_chain = ",".join(filter_parts)
        filter_complex = f"[0:v]{filter_chain}[out]"
        cmd.extend(["-filter_complex", filter_complex, "-map", "[out]"])
    else:
        cmd.extend(["-map", "0:v"])

    # 编码 - 使用硬件加速或 ultrafast 预设
    encoder = _HWACCEL_ENCODER or "libx264"
    preset_flag = []
    if _HWACCEL_ENCODER == "h264_amf":
        preset_flag = ["-quality", "speed"]
    elif _HWACCEL_ENCODER:
        preset_flag = ["-preset", "p1"]  # NVENC/QSV 最快预设
    else:
        preset_flag = ["-preset", "ultrafast", "-crf", "28"]

    cmd.extend(hwaccel_opts + [
        "-c:v", encoder,
        *preset_flag,
        "-pix_fmt", "yuv420p",
        "-y",
        output_path,
    ])

    return cmd


def build_concat_command(
    scene_files: list[str],
    output_path: str,
) -> list[str]:
    """构建场景拼接命令 - 使用 concat demuxer"""
    # 创建 concat list 文件
    list_path = output_path.replace(".mp4", "_list.txt")
    with open(list_path, "w", encoding="utf-8") as f:
        for sf in scene_files:
            abs_path = os.path.abspath(sf).replace("\\", "/")
            f.write(f"file '{abs_path}'\n")

    return [
        settings.ffmpeg_path,
        "-f", "concat",
        "-safe", "0",
        "-i", list_path,
        "-c", "copy",
        "-y",
        output_path,
    ]


def build_audio_mix_command(
    video_path: str,
    tts_paths: list[str],
    bgm_path: str,
    output_path: str,
    bgm_volume: float = 0.3,
) -> list[str]:
    """构建音频混合命令"""
    cmd = [settings.ffmpeg_path, "-i", video_path]

    # 如果有 TTS，先 concat TTS 文件
    tts_concat_path = None
    if tts_paths:
        tts_concat_path = output_path.replace(".mp4", "_tts_concat.mp3")
        tts_list_path = output_path.replace(".mp4", "_tts_list.txt")
        with open(tts_list_path, "w", encoding="utf-8") as f:
            for tp in tts_paths:
                if os.path.exists(tp):
                    abs_path = os.path.abspath(tp).replace("\\", "/")
                    f.write(f"file '{abs_path}'\n")

        cmd.extend(["-f", "concat", "-safe", "0", "-i", tts_list_path])

    # BGM
    if bgm_path and os.path.exists(bgm_path):
        cmd.extend(["-i", bgm_path])

    # 音频混合
    input_count = 1  # video
    filter_parts = []

    if tts_concat_path:
        # 直接用 concat 文件
        audio_sources = []
        if tts_paths:
            audio_sources.append(f"[1:a]volume=1.0[a0]")
        if bgm_path and os.path.exists(bgm_path):
            idx = 2 if tts_paths else 1
            audio_sources.append(f"[{idx}:a]volume={bgm_volume}[a1]")

        if len(audio_sources) >= 2:
            amix = f";{''.join(audio_sources)}; [a0][a1]amix=inputs=2:duration=first[a]"
            cmd.extend(["-filter_complex", amix[1:], "-map", "[a]"])
        elif len(audio_sources) == 1:
            pass  # 单音频源，直接 map
        else:
            cmd.extend(["-an"])

    # 输出
    cmd.extend(["-c:v", "copy", "-y", output_path])

    return cmd


def build_subtitle_command(
    video_path: str,
    srt_path: str,
    output_path: str,
) -> list[str]:
    """构建字幕烧录命令"""
    srt_abs = os.path.abspath(srt_path).replace("\\", "/")
    srt_escaped = _escape_filter_value(srt_abs)

    encoder = _HWACCEL_ENCODER or "libx264"
    if _HWACCEL_ENCODER == "h264_amf":
        preset_flag = ["-quality", "speed"]
    elif _HWACCEL_ENCODER:
        preset_flag = ["-preset", "p1"]
    else:
        preset_flag = ["-preset", "ultrafast", "-crf", "28"]

    return [
        settings.ffmpeg_path,
        "-i", video_path,
        "-vf", f"subtitles={srt_escaped}",
        "-c:a", "copy",
        "-c:v", encoder,
        *preset_flag,
        "-y",
        output_path,
    ]


def _escape_ffmpeg_text(text: str) -> str:
    """转义 FFmpeg drawtext 文本中的特殊字符"""
    replacements = {
        "'": "\\'",
        ":": "\\:",
        "\\": "\\\\",
        "/": "\\/",
        "[": "\\[",
        "]": "\\]",
        "(": "\\(",
        ")": "\\)",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return text


def _escape_filter_value(value: str) -> str:
    """转义 FFmpeg filter 参数中的特殊字符，防止冒号被解析为选项分隔符"""
    return value.replace(":", "\\:")


def _escape_ffmpeg_path(path: str) -> str:
    """转义 FFmpeg filter 中的文件路径（转义冒号，统一正斜杠）"""
    return path.replace("\\", "/").replace(":", "\\:")
