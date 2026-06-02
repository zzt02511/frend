#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Export content-production pipeline tasks from a custom-home case or project.

This script is the glue layer between the current content MVP and the planned
open-source runtime stack: FFmpeg, ImageMagick, CosyVoice, HeyGem/Duix, and
social-auto-upload. It can run before those tools are installed by producing a
clean task package that later adapters can consume.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Any

from custom_home_agent import CaseInput, ScriptOutput, generate_outputs, load_case


ROOT = Path(__file__).resolve().parent
DEFAULT_EXPORT_DIR = ROOT / "content_pipeline_exports"


def _safe_name(value: str) -> str:
    keep = []
    for ch in str(value or "").strip():
        if ch in '<>:"/\\|?*\x00':
            keep.append("-")
        else:
            keep.append(ch)
    name = "".join(keep).strip(" .")
    return name[:80] or "未命名内容项目"


def _read_project(path: Path) -> tuple[CaseInput, list[dict[str, Any]], dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    form = data.get("form") or {}
    case = CaseInput(**{key: value for key, value in form.items() if key in CaseInput.__dataclass_fields__})
    rows = data.get("rows") or [asdict(item) for item in generate_outputs(case)]
    return case, rows, data


def _script_outputs_to_rows(outputs: list[ScriptOutput]) -> list[dict[str, Any]]:
    return [asdict(item) for item in outputs]


def _write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def _write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _collect_materials(case: CaseInput, project_data: dict[str, Any]) -> list[dict[str, Any]]:
    explicit = project_data.get("materials") or []
    materials = []
    for item in explicit:
        if isinstance(item, dict):
            materials.append(item)
    project_name = project_data.get("name") or case.community
    material_dir = ROOT / "custom_home_materials" / _safe_name(project_name)
    if material_dir.exists():
        for path in sorted(material_dir.iterdir()):
            if path.is_file():
                materials.append(
                    {
                        "name": path.name,
                        "path": str(path),
                        "type": "video" if path.suffix.lower() in {".mp4", ".mov", ".avi", ".mkv"} else "image",
                    }
                )
    return materials


def _copy_materials(materials: list[dict[str, Any]], export_dir: Path) -> list[dict[str, Any]]:
    copied = []
    target_dir = export_dir / "materials"
    target_dir.mkdir(parents=True, exist_ok=True)
    for item in materials:
        source = item.get("path") or item.get("url") or ""
        source_path = Path(source)
        if source_path.exists() and source_path.is_file():
            target = target_dir / source_path.name
            if source_path.resolve() != target.resolve():
                shutil.copy2(source_path, target)
            copied.append({**item, "export_path": str(target)})
        else:
            copied.append(item)
    return copied


def build_pipeline_package(case: CaseInput, rows: list[dict[str, Any]], project_data: dict[str, Any], export_dir: Path) -> None:
    project_name = _safe_name(project_data.get("name") or f"{case.community}{case.area}平内容项目")
    package_dir = export_dir / project_name
    package_dir.mkdir(parents=True, exist_ok=True)

    materials = _copy_materials(_collect_materials(case, project_data), package_dir)
    pipeline = {
        "project": project_name,
        "case": asdict(case),
        "materials": materials,
        "stages": [
            {"id": "copywriting", "tool": "custom_home_agent.py", "status": "ready"},
            {"id": "xhs_note", "tool": "custom_home_agent.py", "status": "ready"},
            {"id": "tts", "tool": "CosyVoice or Duix voice service", "status": "waiting_runtime"},
            {"id": "avatar", "tool": "HeyGem / Duix.Avatar", "status": "waiting_runtime"},
            {"id": "editing", "tool": "FFmpeg + ImageMagick", "status": "waiting_runtime"},
            {"id": "publish_package", "tool": "manual first, social-auto-upload later", "status": "ready"},
        ],
    }
    _write_json(package_dir / "pipeline.json", pipeline)
    _write_json(package_dir / "case.json", asdict(case))
    _write_json(package_dir / "rows.json", rows)

    note_index = []
    heygem_tasks = []
    ffmpeg_tasks = []
    publish_rows = []

    for row in rows:
        index = int(row.get("index") or len(note_index) + 1)
        prefix = f"{index:02d}-{_safe_name(row.get('pillar') or 'content')}"
        note_path = package_dir / "xiaohongshu_notes" / f"{prefix}.md"
        script_path = package_dir / "scripts" / f"{prefix}.txt"
        heygem_task_path = package_dir / "heygem_tasks" / f"{prefix}.json"
        ffmpeg_task_path = package_dir / "ffmpeg_tasks" / f"{prefix}.json"

        xhs_note = row.get("xiaohongshu_note") or ""
        rewritten = row.get("rewritten_script") or row.get("script") or ""
        _write_text(note_path, xhs_note)
        _write_text(script_path, rewritten)

        heygem_task = {
            "task_name": f"{project_name}-{index:02d}",
            "title": (row.get("titles") or [""])[0],
            "script": rewritten,
            "preferred_avatar": "",
            "preferred_voice": "",
            "runtime": {
                "service": "HeyGem / Duix.Avatar",
                "video_endpoint_hint": "http://127.0.0.1:8383/easy/submit",
                "voice_endpoint_hint": "http://127.0.0.1:18180/v1/invoke",
                "status": "fill_payload_after_runtime_verified",
            },
            "output_expected": f"avatar_videos/{prefix}.mp4",
        }
        _write_json(heygem_task_path, heygem_task)
        heygem_tasks.append(str(heygem_task_path))

        ffmpeg_task = {
            "task_name": f"{project_name}-{index:02d}",
            "inputs": {
                "avatar_video": f"avatar_videos/{prefix}.mp4",
                "real_materials": [item.get("export_path") or item.get("path") or item.get("url") for item in materials],
                "cover_text": row.get("cover") or "",
                "subtitles": rewritten,
            },
            "plan": row.get("xiaohongshu_video_plan") or row.get("storyboard") or [],
            "output_expected": f"final_videos/{prefix}.mp4",
            "runtime": {
                "ffmpeg": "ffmpeg/bin/ffmpeg.exe",
                "imagemagick": "ImageMagick-7.1.1-Q16-HDRI/magick.exe",
                "status": "waiting_runtime",
            },
        }
        _write_json(ffmpeg_task_path, ffmpeg_task)
        ffmpeg_tasks.append(str(ffmpeg_task_path))

        note_index.append(f"- [{prefix}]({note_path.as_posix()})")
        publish_rows.append(
            {
                "index": index,
                "title": (row.get("titles") or [""])[0],
                "cover": row.get("cover") or "",
                "note_file": str(note_path),
                "script_file": str(script_path),
                "video_expected": str(package_dir / "final_videos" / f"{prefix}.mp4"),
                "dm_keyword": row.get("dm_keyword") or "",
            }
        )

    _write_text(
        package_dir / "README.md",
        "\n".join(
            [
                f"# {project_name} 内容生产流水线包",
                "",
                "## 小红书图文",
                *note_index,
                "",
                "## 下一步",
                "",
                "1. 确认真实素材已放入 `materials/`。",
                "2. 启动 HeyGem / Duix.Avatar，补全 `heygem_tasks/*.json` 里的 avatar/voice/payload。",
                "3. 生成数字人口播视频到 `avatar_videos/`。",
                "4. 用 FFmpeg/ImageMagick 执行 `ffmpeg_tasks/*.json` 对应剪辑合成。",
                "5. 先人工发布，等账号稳定后再接 social-auto-upload。",
                "",
            ]
        ),
    )
    _write_json(package_dir / "publish_manifest.json", publish_rows)
    _write_json(package_dir / "heygem_task_index.json", heygem_tasks)
    _write_json(package_dir / "ffmpeg_task_index.json", ffmpeg_tasks)


def main() -> None:
    parser = argparse.ArgumentParser(description="Export a content-production pipeline package.")
    parser.add_argument("--case", type=Path, help="Case JSON file, e.g. custom_home_case.sample.json")
    parser.add_argument("--project", type=Path, help="Saved project JSON from custom_home_projects")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_EXPORT_DIR)
    args = parser.parse_args()

    if not args.case and not args.project:
        parser.error("Provide --case or --project")

    if args.project:
        case, rows, project_data = _read_project(args.project)
    else:
        case = load_case(args.case)
        rows = _script_outputs_to_rows(generate_outputs(case))
        project_data = {"name": f"{case.community}{case.area}平内容项目", "form": asdict(case), "rows": rows}

    build_pipeline_package(case, rows, project_data, args.output_dir)
    project_name = _safe_name(project_data.get("name") or f"{case.community}{case.area}平内容项目")
    print(f"已导出内容生产流水线包：{args.output_dir / project_name}")


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass
    main()
