"""媒体文件工具 - ffprobe 封装"""

import json
import subprocess
from dataclasses import dataclass
from typing import Optional

from app.config import settings


@dataclass
class MediaInfo:
    """媒体文件信息"""
    width: int = 0
    height: int = 0
    duration_s: float = 0.0
    fps: float = 0.0
    codec: str = ""
    bitrate_kbps: int = 0
    file_size_bytes: int = 0
    has_audio: bool = False
    has_video: bool = False


def probe_file(filepath: str) -> Optional[MediaInfo]:
    """使用 ffprobe 获取媒体文件信息"""
    try:
        result = subprocess.run(
            [
                settings.ffprobe_path,
                "-v", "quiet",
                "-print_format", "json",
                "-show_format",
                "-show_streams",
                filepath,
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode != 0:
            return None

        data = json.loads(result.stdout)
        info = MediaInfo()

        # Format info
        fmt = data.get("format", {})
        info.duration_s = float(fmt.get("duration", 0))
        info.file_size_bytes = int(fmt.get("size", 0))
        info.bitrate_kbps = int(fmt.get("bit_rate", 0)) // 1000

        # Streams
        for stream in data.get("streams", []):
            codec_type = stream.get("codec_type", "")
            if codec_type == "video":
                info.has_video = True
                info.width = stream.get("width", 0)
                info.height = stream.get("height", 0)
                info.codec = stream.get("codec_name", "")
                # FPS
                r_frame_rate = stream.get("r_frame_rate", "0/1")
                if "/" in r_frame_rate:
                    num, den = r_frame_rate.split("/")
                    try:
                        info.fps = float(num) / float(den)
                    except (ValueError, ZeroDivisionError):
                        info.fps = 0
            elif codec_type == "audio":
                info.has_audio = True

        return info
    except Exception:
        return None


def check_ffmpeg_available() -> bool:
    """检查 FFmpeg 是否可用"""
    try:
        result = subprocess.run(
            [settings.ffmpeg_path, "-version"],
            capture_output=True,
            timeout=5,
        )
        return result.returncode == 0
    except Exception:
        return False


def get_supported_codecs() -> list[str]:
    """获取 FFmpeg 支持的编码器列表"""
    try:
        result = subprocess.run(
            [settings.ffmpeg_path, "-encoders"],
            capture_output=True, text=True, timeout=5,
        )
        lines = result.stdout.split("\n")
        codecs = []
        for line in lines:
            parts = line.strip().split()
            if len(parts) >= 2 and parts[0].startswith("V"):
                codecs.append(parts[1])
        return codecs
    except Exception:
        return []
