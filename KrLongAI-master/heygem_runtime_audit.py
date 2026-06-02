#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Audit local HeyGem / Duix.Avatar runtime availability."""

from __future__ import annotations

import argparse
import json
import shutil
import socket
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path


DEFAULT_DATA_DIRS = [
    Path(r"D:\heygem_data"),
    Path(r"D:\duix_data"),
    Path(r"D:\Duix.Avatar"),
]


@dataclass
class CheckResult:
    name: str
    ok: bool
    detail: str
    expected: str = ""


def command_check(name: str, command: str, args: list[str]) -> CheckResult:
    found = shutil.which(command)
    if not found:
        return CheckResult(name, False, "PATH 中未找到", command)
    try:
        result = subprocess.run([found, *args], capture_output=True, text=True, timeout=10)
        detail = (result.stdout or result.stderr or found).strip().splitlines()[0]
        return CheckResult(name, result.returncode == 0, detail, found)
    except Exception as exc:
        return CheckResult(name, False, str(exc), found)


def port_check(name: str, port: int) -> CheckResult:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(1.0)
        ok = sock.connect_ex(("127.0.0.1", port)) == 0
    return CheckResult(name, ok, f"127.0.0.1:{port}", "服务监听中")


def dir_check(name: str, paths: list[Path]) -> CheckResult:
    existing = [str(path) for path in paths if path.exists()]
    if existing:
        return CheckResult(name, True, "；".join(existing), "至少存在一个数据目录")
    return CheckResult(name, False, "未发现常见 HeyGem/Duix 数据目录", "D:\\heygem_data 或 Duix 安装目录")


def docker_images_check() -> list[CheckResult]:
    docker = shutil.which("docker")
    if not docker:
        return [
            CheckResult("Docker images: guiji2025/fun-asr", False, "未安装或 PATH 中未找到 docker", "docker"),
            CheckResult("Docker images: guiji2025/fish-speech-ziming", False, "未安装或 PATH 中未找到 docker", "docker"),
            CheckResult("Docker images: guiji2025/duix.avatar", False, "未安装或 PATH 中未找到 docker", "docker"),
        ]
    try:
        result = subprocess.run([docker, "images", "--format", "{{.Repository}}:{{.Tag}}"], capture_output=True, text=True, timeout=20)
        images = result.stdout
    except Exception as exc:
        return [CheckResult("Docker images", False, str(exc), "docker images")]

    checks = []
    for image in ["guiji2025/fun-asr", "guiji2025/fish-speech-ziming", "guiji2025/duix.avatar"]:
        checks.append(CheckResult(f"Docker image: {image}", image in images, "已找到" if image in images else "未找到", image))
    return checks


def run_audit() -> list[CheckResult]:
    results = [
        command_check("Docker", "docker", ["--version"]),
        command_check("Node.js", "node", ["--version"]),
        port_check("Duix/HeyGem 视频生成服务", 8383),
        port_check("Duix/HeyGem 语音/模型服务", 18180),
        dir_check("HeyGem/Duix 数据目录", DEFAULT_DATA_DIRS),
    ]
    results.extend(docker_images_check())
    return results


def print_report(results: list[CheckResult]) -> None:
    ok_count = sum(1 for item in results if item.ok)
    print(f"HeyGem / Duix.Avatar 运行时检查：{ok_count}/{len(results)} 项通过")
    print("=" * 72)
    for item in results:
        mark = "OK" if item.ok else "MISS"
        print(f"[{mark}] {item.name}")
        print(f"      {item.detail}")
        if not item.ok and item.expected:
            print(f"      需要：{item.expected}")
    print("=" * 72)
    if ok_count != len(results):
        print("结论：HeyGem/Duix 还没有完整可用。请先安装 Docker、拉取镜像并启动服务。")
    else:
        print("结论：HeyGem/Duix 基础运行时已就绪，可以开始做 API 适配。")


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit HeyGem / Duix.Avatar runtime.")
    parser.add_argument("--json", action="store_true")
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
