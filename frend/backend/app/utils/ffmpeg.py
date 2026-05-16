"""FFmpeg 命令构建工具"""

import os
import shlex
from typing import Optional
from app.config import settings


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

    filter_parts = []

    # 文本叠加
    if text_content:
        escaped_text = _escape_ffmpeg_text(text_content)
        font_name = font_path or _find_chinese_font()
        drawtext = (
            f"drawtext=text='{escaped_text}'"
            f":font='{font_name}'"
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
        overlay = f"[0:v]{''.join(filter_parts) if filter_parts else 'null'}[bg];[bg][1:v]overlay={img_x}:{img_y}:enable='between(t,0,{duration})'[out]"
        # 简化，用更直接的方式
        filter_parts = [f"overlay={img_x}:{img_y}:enable='between(t,0,{duration})'"]

    # 构建 filter_complex
    if filter_parts:
        filter_chain = ",".join(filter_parts)
        filter_complex = f"[0:v]{filter_chain}[out]"
        cmd.extend(["-filter_complex", filter_complex, "-map", "[out]"])
    else:
        cmd.extend(["-map", "0:v"])

    # 编码
    cmd.extend([
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "23",
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

    return [
        settings.ffmpeg_path,
        "-i", video_path,
        "-vf", f"subtitles={srt_escaped}",
        "-c:a", "copy",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "23",
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


def _find_chinese_font() -> str:
    """查找系统中可用的中文字体名 (fontconfig)"""
    # 使用 fontconfig 字体名（通过 --enable-fontconfig 支持）
    possible_names = [
        "SimSun",           # 宋体
        "Microsoft YaHei",  # 微软雅黑
        "SimHei",           # 黑体
        "FangSong",         # 仿宋
        "KaiTi",            # 楷体
    ]
    # 检查 fontconfig 是否可用（通过检测字体文件是否存在来决定默认值）
    # 如果 fontconfig 不可用，回退到文件路径方式
    font_paths = [
        "C:/Windows/Fonts/simsun.ttc",
        "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/simhei.ttf",
    ]
    for fp in font_paths:
        if os.path.exists(fp):
            return possible_names[0]  # 优先使用 fontconfig 名称
    return "SimSun"
