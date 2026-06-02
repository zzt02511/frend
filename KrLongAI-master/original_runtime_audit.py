#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Audit the original KrLongAI runtime resources.

The custom-home MVP can run without these resources. This checker is for the
original digital-human chain started by combined_launcher.py / the batch file.
It intentionally does not create fake modules or model files.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import socket
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parent


@dataclass
class CheckResult:
    name: str
    ok: bool
    detail: str
    expected: str = ""


REQUIRED_PATHS = [
    ("Conda env python", ROOT / "miniconda3" / "envs" / "avatar" / "python.exe", "原始一键启动脚本使用的 Python 环境"),
    ("Conda activate.bat", ROOT / "miniconda3" / "Scripts" / "activate.bat", "一键启动脚本会调用它激活 avatar 环境"),
    ("FFmpeg", ROOT / "ffmpeg" / "bin" / "ffmpeg.exe", "视频合成、转码、抽帧"),
    ("FFprobe", ROOT / "ffmpeg" / "bin" / "ffprobe.exe", "视频信息探测"),
    ("ImageMagick", ROOT / "ImageMagick-7.1.1-Q16-HDRI" / "magick.exe", "封面/字幕/图片处理"),
    ("utils launcher", ROOT / "utils" / "launcher.py", "原始后端启动入口"),
    ("utils webserver", ROOT / "utils" / "launcher_webserver.py", "原始前端/网页服务入口"),
    ("utils loading window", ROOT / "utils" / "loading_window.py", "combined_launcher.py 启动时导入"),
    ("utils video_processor", ROOT / "utils" / "video_processor.py", "app.py 导入"),
    ("utils key_manager", ROOT / "utils" / "key_manager.py", "app.py 导入"),
    ("utils voice_processor", ROOT / "utils" / "voice_processor.py", "app.py 导入"),
    ("utils update_handler", ROOT / "utils" / "update_handler.py", "app.py 导入"),
    ("utils service_launcher", ROOT / "utils" / "service_launcher.py", "app.py 导入"),
    ("utils video_cover_image", ROOT / "utils" / "video_cover_image.py", "app.py 导入"),
    ("AI text_rewriter", ROOT / "ai_processing" / "text_rewriter.py", "文案改写模块"),
    ("Video generator", ROOT / "video_tools" / "generate_video.py", "TuiliONNX 数字人生成入口"),
    ("Subtitle utils", ROOT / "video_tools" / "subtitle_utils.py", "字幕合成入口"),
    ("Publisher", ROOT / "video_tools" / "publisher.py", "多平台发布入口"),
    ("CosyVoice API", ROOT / "cosyvoice" / "api.cp312-win_amd64.pyd", "CosyVoice 本地 API 编译模块"),
    ("CosyVoice account", ROOT / "cosyvoice" / "account.txt", "CosyVoice 账号/配置文件"),
    ("CosyVoice launcher", ROOT / "cosyvoice" / "启动接口.bat", "CosyVoice 手动启动脚本"),
]


MODEL_HINTS = [
    ROOT / "tuilionnx",
    ROOT / "digital_human",
    ROOT / "avatar",
    ROOT / "models",
    ROOT / "checkpoints",
]


def path_check(name: str, path: Path, expected: str) -> CheckResult:
    return CheckResult(name=name, ok=path.exists(), detail=str(path), expected=expected)


def command_check(name: str, command: str, args: list[str]) -> CheckResult:
    found = shutil.which(command)
    if not found:
        return CheckResult(name=name, ok=False, detail="PATH 中未找到", expected=command)
    try:
        result = subprocess.run([found, *args], capture_output=True, text=True, timeout=8)
        output = (result.stdout or result.stderr or "").strip().splitlines()
        detail = output[0] if output else found
        return CheckResult(name=name, ok=result.returncode == 0, detail=detail, expected=found)
    except Exception as exc:
        return CheckResult(name=name, ok=False, detail=str(exc), expected=found)


def port_check(name: str, host: str, port: int) -> CheckResult:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(1.0)
        ok = sock.connect_ex((host, port)) == 0
    return CheckResult(name=name, ok=ok, detail=f"{host}:{port}", expected="运行中" if ok else "未监听")


def model_check() -> CheckResult:
    existing = [path.name for path in MODEL_HINTS if path.exists()]
    if existing:
        return CheckResult("数字人模型目录", True, "、".join(existing), "至少存在一个模型目录")
    return CheckResult("数字人模型目录", False, "未发现 tuilionnx/digital_human/avatar/models/checkpoints", "需要从完整资源包恢复")


def run_audit() -> list[CheckResult]:
    results = [path_check(name, path, expected) for name, path, expected in REQUIRED_PATHS]
    results.extend(
        [
            model_check(),
            command_check("系统 ffmpeg", "ffmpeg", ["-version"]),
            command_check("系统 conda", "conda", ["--version"]),
            command_check("系统 ImageMagick", "magick", ["-version"]),
            port_check("主 UI 端口", "127.0.0.1", 8000),
            port_check("CosyVoice 端口", "127.0.0.1", 9880),
            port_check("Chrome 调试端口", "127.0.0.1", 9222),
        ]
    )
    return results


def print_report(results: list[CheckResult]) -> None:
    ok_count = sum(1 for item in results if item.ok)
    print(f"原始数字人链路检查：{ok_count}/{len(results)} 项通过")
    print("=" * 72)
    for item in results:
        mark = "OK" if item.ok else "MISS"
        print(f"[{mark}] {item.name}")
        print(f"      {item.detail}")
        if not item.ok and item.expected:
            print(f"      需要：{item.expected}")
    print("=" * 72)
    if ok_count != len(results):
        print("结论：当前仍不能完整启动原始 KrLongAI 数字人链路。")
        print("下一步：从完整资源包恢复缺失目录，或安装对应外部运行时后再次执行本脚本。")


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit original KrLongAI runtime resources.")
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON.")
    args = parser.parse_args()

    results = run_audit()
    if args.json:
        print(json.dumps([asdict(item) for item in results], ensure_ascii=False, indent=2))
    else:
        print_report(results)


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass
    main()
