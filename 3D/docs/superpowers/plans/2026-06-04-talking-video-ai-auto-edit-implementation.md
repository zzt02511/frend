# Talking Video AI Auto Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local `KrLongAI-master` module that turns a user-uploaded talking-head video plus tagged real materials into an editable AI edit plan and an FFmpeg-renderable short-video draft.

**Architecture:** Add a focused Python planning module (`talking_video_editor.py`) that creates stable `edit_plan.json` data, a focused FFmpeg renderer module (`ffmpeg_video_renderer.py`) that can write subtitles and build/render commands, and thin `custom_home_server.py` API endpoints plus an HTML workbench. Keep video/user assets in ignored runtime folders and keep all tests dependency-light.

**Tech Stack:** Python 3.12 standard library, `unittest`, local HTTP server in `custom_home_server.py`, FFmpeg via subprocess when available, plain HTML/CSS/JS for the workbench.

---

## Scope Check

The approved spec is one coherent subsystem: local talking-video auto-editing in `KrLongAI-master`. It touches planning, rendering, local persistence, and UI, but every part supports one testable workflow:

`talking video + optional script/transcript + tagged materials -> edit_plan.json -> user confirmation -> FFmpeg MP4 draft`.

This plan intentionally excludes cloud queues, auto publishing, full browser timeline editing, JianYing draft export, digital-human generation, and hard dependency on large AI/ASR models.

## File Structure

Create or modify these files inside `KrLongAI-master/`:

```text
KrLongAI-master/
  talking_video_editor.py
  ffmpeg_video_renderer.py
  talking_video_editor.html
  custom_home_server.py
  content_pipeline.py
  .gitignore
  test_talking_video_editor.py
  test_ffmpeg_video_renderer.py
  test_custom_home_server_talking_video.py
```

Responsibilities:

- `talking_video_editor.py`: Pure-ish planning layer. Defines data classes, safe names, material normalization, script segmentation, keyword extraction, B-roll matching, fallback warnings, and `build_edit_plan`.
- `ffmpeg_video_renderer.py`: Rendering layer. Defines FFmpeg discovery, SRT writing, command construction, optional command execution, and render-status payloads.
- `talking_video_editor.html`: Local workbench page. Upload video/materials, paste script, edit plan JSON/key fields, and trigger render.
- `custom_home_server.py`: Thin API and persistence layer. Saves uploads under `talking_video_projects/`, serves plan/render endpoints, and returns JSON.
- `content_pipeline.py`: Adds talking-video task-package metadata only after the standalone plan/render path is stable.
- `.gitignore`: Excludes talking-video runtime folders and output media.
- Tests: Cover planning, matching, degradation, command generation, and server API behavior.

Runtime folder:

```text
KrLongAI-master/talking_video_projects/<project_id>/
  project.json
  edit_plan.json
  uploads/
    talking.mp4
    assets/
  captions/
  renders/
    final.mp4
    cover.jpg
  logs/
    ffmpeg.log
```

## Task 1: Add Talking Video Planning Domain

**Files:**
- Create: `KrLongAI-master/talking_video_editor.py`
- Test: `KrLongAI-master/test_talking_video_editor.py`

- [ ] **Step 1: Write failing tests for safe names, script segmentation, material normalization, and edit-plan shape**

Create `KrLongAI-master/test_talking_video_editor.py`:

```python
import json
import tempfile
import unittest
from pathlib import Path

from talking_video_editor import (
    MaterialAsset,
    build_edit_plan,
    normalize_materials,
    safe_project_id,
    segment_script,
)


class TalkingVideoEditorTests(unittest.TestCase):
    def test_safe_project_id_removes_windows_unsafe_characters(self):
        self.assertEqual(safe_project_id(" 苏州/门店:口播*测试 "), "苏州-门店-口播-测试")
        self.assertEqual(safe_project_id(""), "talking-video")

    def test_segment_script_splits_chinese_sentences_into_timed_segments(self):
        segments = segment_script(
            "装修选门不要只看价格。先看门套和锁具，再看安装案例！最后到店看实物。",
            duration=30.0,
        )

        self.assertEqual(len(segments), 3)
        self.assertEqual(segments[0]["start"], 0.0)
        self.assertAlmostEqual(segments[-1]["end"], 30.0)
        self.assertIn("装修选门", segments[0]["text"])

    def test_normalize_materials_infers_type_and_tags(self):
        materials = normalize_materials(
            [
                {
                    "name": "工厂质检.mp4",
                    "url": "/custom_home_materials/demo/工厂质检.mp4",
                    "notes": "生产线 质检 工厂实力",
                },
                {
                    "name": "入户门细节.jpg",
                    "url": "/custom_home_materials/demo/入户门细节.jpg",
                    "tags": ["产品", "细节"],
                },
            ]
        )

        self.assertEqual(materials[0].type, "video")
        self.assertIn("工厂", materials[0].tags)
        self.assertEqual(materials[1].type, "image")
        self.assertIn("产品", materials[1].tags)

    def test_build_edit_plan_matches_broll_and_adds_required_sections(self):
        plan = build_edit_plan(
            project_id="demo",
            talking_video="uploads/talking.mp4",
            script="装修选门不要只看价格。工厂质检和安装案例都要看。",
            materials=[
                MaterialAsset(
                    id="asset-product",
                    name="入户门细节.jpg",
                    url="uploads/assets/入户门细节.jpg",
                    type="image",
                    tags=["产品", "入户门", "细节"],
                    notes="",
                ),
                MaterialAsset(
                    id="asset-factory",
                    name="工厂质检.mp4",
                    url="uploads/assets/工厂质检.mp4",
                    type="video",
                    tags=["工厂", "质检"],
                    notes="",
                ),
            ],
            duration=24.0,
            aspect_ratio="9:16",
        )

        self.assertEqual(plan["projectId"], "demo")
        self.assertEqual(plan["sourceTalkingVideo"], "uploads/talking.mp4")
        self.assertEqual(plan["aspectRatio"], "9:16")
        self.assertGreaterEqual(len(plan["segments"]), 2)
        self.assertTrue(plan["captions"]["highlightKeywords"])
        self.assertTrue(plan["overlays"]["progressBar"])
        self.assertIn("cta", plan["overlays"])
        self.assertIn("cover", plan)
        self.assertTrue(any(slot["assetId"] for seg in plan["segments"] for slot in seg["brollSlots"]))

    def test_build_edit_plan_degrades_when_materials_are_missing(self):
        plan = build_edit_plan(
            project_id="demo",
            talking_video="uploads/talking.mp4",
            script="装修选门不要只看价格。安装案例要真实。",
            materials=[],
            duration=20.0,
        )

        self.assertEqual(plan["render"]["status"], "draft")
        self.assertTrue(plan["warnings"])
        self.assertTrue(all(not seg["brollSlots"] for seg in plan["segments"]))

    def test_edit_plan_is_json_serializable(self):
        plan = build_edit_plan(
            project_id="demo",
            talking_video="uploads/talking.mp4",
            script="门店真实案例讲解。",
            materials=[],
            duration=12.0,
        )

        encoded = json.dumps(plan, ensure_ascii=False)
        self.assertIn("门店真实案例讲解", encoded)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bat
cd /d D:\AI\3D\.worktrees\ai-content-pack-tool\KrLongAI-master
D:\Python312\python.exe -m unittest test_talking_video_editor.py
```

Expected: FAIL with `ModuleNotFoundError: No module named 'talking_video_editor'`.

- [ ] **Step 3: Create `talking_video_editor.py` with the planning implementation**

Create `KrLongAI-master/talking_video_editor.py`:

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build editable AI edit plans for talking-head short videos."""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any


DEFAULT_KEYWORDS = {
    "产品": {"产品", "门", "入户门", "门套", "锁具", "五金", "板材", "细节", "颜色"},
    "工厂": {"工厂", "生产", "质检", "设备", "车间", "产线", "实力"},
    "案例": {"案例", "安装", "落地", "交付", "客户", "实景", "小区"},
    "门店": {"门店", "展厅", "到店", "同城", "地址", "预约"},
    "价格": {"价格", "预算", "报价", "费用", "套餐"},
}


@dataclass
class MaterialAsset:
    id: str
    name: str
    url: str
    type: str
    tags: list[str] = field(default_factory=list)
    notes: str = ""


def safe_project_id(value: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', "-", str(value or "").strip())
    cleaned = re.sub(r"\s+", "-", cleaned).strip(" .-")
    return cleaned[:80] or "talking-video"


def infer_material_type(name: str, url: str = "") -> str:
    suffix = Path(name or url).suffix.lower()
    if suffix in {".mp4", ".mov", ".avi", ".mkv", ".webm"}:
        return "video"
    if suffix in {".jpg", ".jpeg", ".png", ".webp", ".bmp"}:
        return "image"
    return "unknown"


def _tokenize_text(text: str) -> list[str]:
    tokens: list[str] = []
    source = str(text or "")
    for group, words in DEFAULT_KEYWORDS.items():
        for word in words:
            if word and word in source:
                tokens.append(word)
        if group in source:
            tokens.append(group)
    for part in re.split(r"[\s,，。！？；;、]+", source):
        part = part.strip()
        if len(part) >= 2:
            tokens.append(part[:12])
    return list(dict.fromkeys(tokens))


def normalize_materials(items: list[dict[str, Any]]) -> list[MaterialAsset]:
    assets: list[MaterialAsset] = []
    for index, item in enumerate(items, start=1):
        name = str(item.get("name") or item.get("filename") or f"asset-{index}")
        url = str(item.get("url") or item.get("path") or "")
        notes = str(item.get("notes") or item.get("description") or "")
        tags = [str(tag).strip() for tag in item.get("tags") or [] if str(tag).strip()]
        inferred = _tokenize_text(f"{name} {notes}")
        merged_tags = list(dict.fromkeys(tags + inferred))
        asset_type = str(item.get("type") or infer_material_type(name, url))
        assets.append(
            MaterialAsset(
                id=str(item.get("id") or f"asset-{index:03d}"),
                name=name,
                url=url,
                type=asset_type,
                tags=merged_tags,
                notes=notes,
            )
        )
    return assets


def segment_script(script: str, duration: float | None = None) -> list[dict[str, Any]]:
    text = str(script or "").strip()
    if not text:
        return []
    parts = [part.strip() for part in re.split(r"(?<=[。！？!?；;])", text) if part.strip()]
    if not parts:
        parts = [text]
    total_duration = max(float(duration or len(parts) * 6), float(len(parts)))
    slot = total_duration / len(parts)
    segments = []
    for index, part in enumerate(parts):
        start = round(index * slot, 2)
        end = round(total_duration if index == len(parts) - 1 else (index + 1) * slot, 2)
        segments.append(
            {
                "id": f"seg-{index + 1:03d}",
                "start": start,
                "end": end,
                "text": part,
                "intent": infer_segment_intent(part, index),
                "keywords": _tokenize_text(part)[:6],
                "brollSlots": [],
            }
        )
    return segments


def infer_segment_intent(text: str, index: int) -> str:
    if index == 0:
        return "开场痛点"
    if any(word in text for word in ("价格", "报价", "预算")):
        return "价格解释"
    if any(word in text for word in ("工厂", "生产", "质检")):
        return "工厂实力"
    if any(word in text for word in ("案例", "安装", "实景")):
        return "案例背书"
    if any(word in text for word in ("到店", "评论", "私信", "预约")):
        return "转化引导"
    return "卖点讲解"


def match_materials_for_segment(segment: dict[str, Any], materials: list[MaterialAsset]) -> list[dict[str, Any]]:
    keywords = set(segment.get("keywords") or [])
    text = str(segment.get("text") or "")
    scored: list[tuple[int, MaterialAsset, list[str]]] = []
    for asset in materials:
        tags = set(asset.tags)
        matched = sorted((keywords & tags) or {tag for tag in tags if tag and tag in text})
        score = len(matched)
        if score:
            scored.append((score, asset, matched))
    scored.sort(key=lambda item: (-item[0], item[1].id))
    slots = []
    for _, asset, matched in scored[:1]:
        duration = max(2.0, min(4.0, float(segment["end"]) - float(segment["start"]) - 1.0))
        slots.append(
            {
                "startOffset": 1.0,
                "duration": round(duration, 2),
                "assetId": asset.id,
                "reason": f"匹配关键词：{'、'.join(matched[:3])}",
            }
        )
    return slots


def build_edit_plan(
    project_id: str,
    talking_video: str,
    script: str,
    materials: list[MaterialAsset] | list[dict[str, Any]],
    duration: float | None = None,
    aspect_ratio: str = "9:16",
    title: str | None = None,
    cta: str | None = None,
) -> dict[str, Any]:
    normalized = materials if all(isinstance(item, MaterialAsset) for item in materials) else normalize_materials(materials)  # type: ignore[arg-type]
    material_assets = list(normalized)  # type: ignore[arg-type]
    segments = segment_script(script, duration)
    warnings: list[str] = []

    if not segments:
        warnings.append("缺少脚本或转写文本，无法生成精确分段。")
        segments = segment_script("请补充口播脚本后重新生成剪辑方案。", duration or 8.0)

    for segment in segments:
        segment["brollSlots"] = match_materials_for_segment(segment, material_assets)

    if not material_assets:
        warnings.append("未提供真实素材，第一版将保留口播主画面并跳过素材穿插。")
    elif not any(segment["brollSlots"] for segment in segments):
        warnings.append("已有素材未匹配到口播关键词，建议补充素材标签或备注。")

    headline = title or infer_title(script)
    plan = {
        "projectId": safe_project_id(project_id),
        "sourceTalkingVideo": talking_video,
        "aspectRatio": aspect_ratio,
        "durationTarget": int(duration or max((segment["end"] for segment in segments), default=60)),
        "scriptSource": "user-script" if script.strip() else "missing",
        "materials": [asdict(asset) for asset in material_assets],
        "segments": segments,
        "captions": {
            "style": "bold-bottom",
            "highlightKeywords": True,
        },
        "overlays": {
            "title": headline,
            "cta": cta or "评论区回复户型，发你一份避坑清单",
            "progressBar": True,
        },
        "audio": {
            "bgm": "light-commercial",
            "ducking": True,
            "soundEffects": ["whoosh-soft"],
        },
        "cover": {
            "text": headline[:18],
            "frameAt": 1.2,
        },
        "render": {
            "output": "renders/final.mp4",
            "status": "draft",
        },
        "warnings": warnings,
    }
    return plan


def infer_title(script: str) -> str:
    if "价格" in script or "报价" in script:
        return "装修报价别只看总价"
    if "选门" in script or "入户门" in script:
        return "装修选门别只看价格"
    if "工厂" in script or "质检" in script:
        return "看工厂实力再下单"
    if "案例" in script or "安装" in script:
        return "真实案例看落地效果"
    return "同城装修避坑建议"


def save_edit_plan(plan: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
```

- [ ] **Step 4: Run the planning tests**

Run:

```bat
cd /d D:\AI\3D\.worktrees\ai-content-pack-tool\KrLongAI-master
D:\Python312\python.exe -m unittest test_talking_video_editor.py
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bat
cd /d D:\AI\3D\.worktrees\ai-content-pack-tool
git -c safe.directory=D:/AI/3D/.worktrees/ai-content-pack-tool add KrLongAI-master/talking_video_editor.py KrLongAI-master/test_talking_video_editor.py
git -c safe.directory=D:/AI/3D/.worktrees/ai-content-pack-tool commit -m "feat: add talking video edit planning"
```

## Task 2: Add FFmpeg Renderer Command Generation

**Files:**
- Create: `KrLongAI-master/ffmpeg_video_renderer.py`
- Test: `KrLongAI-master/test_ffmpeg_video_renderer.py`

- [ ] **Step 1: Write failing renderer tests**

Create `KrLongAI-master/test_ffmpeg_video_renderer.py`:

```python
import tempfile
import unittest
from pathlib import Path

from ffmpeg_video_renderer import (
    build_ffmpeg_command,
    ffmpeg_available,
    render_status_when_ffmpeg_missing,
    write_srt,
)


class FFmpegVideoRendererTests(unittest.TestCase):
    def sample_plan(self):
        return {
            "projectId": "demo",
            "sourceTalkingVideo": "uploads/talking.mp4",
            "aspectRatio": "9:16",
            "segments": [
                {
                    "id": "seg-001",
                    "start": 0.0,
                    "end": 3.2,
                    "text": "装修选门别只看价格。",
                    "keywords": ["装修", "选门"],
                    "brollSlots": [],
                },
                {
                    "id": "seg-002",
                    "start": 3.2,
                    "end": 6.4,
                    "text": "还要看安装案例。",
                    "keywords": ["安装", "案例"],
                    "brollSlots": [],
                },
            ],
            "overlays": {"title": "装修选门别只看价格", "cta": "评论区回复户型", "progressBar": True},
            "render": {"output": "renders/final.mp4", "status": "draft"},
        }

    def test_write_srt_uses_segment_times_and_text(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "captions.srt"
            write_srt(self.sample_plan(), path)
            text = path.read_text(encoding="utf-8")

        self.assertIn("00:00:00,000 --> 00:00:03,200", text)
        self.assertIn("装修选门别只看价格。", text)
        self.assertIn("还要看安装案例。", text)

    def test_build_ffmpeg_command_contains_input_subtitle_and_output(self):
        plan = self.sample_plan()
        command = build_ffmpeg_command(
            plan,
            project_dir=Path("talking_video_projects/demo"),
            ffmpeg_path="ffmpeg",
        )

        joined = " ".join(command)
        self.assertEqual(command[0], "ffmpeg")
        self.assertIn("uploads/talking.mp4", joined)
        self.assertIn("captions/captions.srt", joined)
        self.assertIn("renders/final.mp4", joined)
        self.assertIn("scale=1080:1920", joined)

    def test_ffmpeg_missing_status_is_explicit(self):
        status = render_status_when_ffmpeg_missing(["ffmpeg", "-i", "in.mp4", "out.mp4"])

        self.assertFalse(status["ok"])
        self.assertEqual(status["status"], "missing_ffmpeg")
        self.assertIn("command", status)

    def test_ffmpeg_available_returns_boolean(self):
        self.assertIsInstance(ffmpeg_available("definitely-not-existing-ffmpeg"), bool)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run renderer tests to verify failure**

Run:

```bat
cd /d D:\AI\3D\.worktrees\ai-content-pack-tool\KrLongAI-master
D:\Python312\python.exe -m unittest test_ffmpeg_video_renderer.py
```

Expected: FAIL with `ModuleNotFoundError: No module named 'ffmpeg_video_renderer'`.

- [ ] **Step 3: Create renderer module**

Create `KrLongAI-master/ffmpeg_video_renderer.py`:

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Render talking-video edit plans through FFmpeg when available."""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import Any


def ffmpeg_available(ffmpeg_path: str = "ffmpeg") -> bool:
    if Path(ffmpeg_path).exists():
        return True
    return shutil.which(ffmpeg_path) is not None


def _format_srt_time(seconds: float) -> str:
    total_ms = int(round(float(seconds) * 1000))
    hours, rem = divmod(total_ms, 3600_000)
    minutes, rem = divmod(rem, 60_000)
    secs, millis = divmod(rem, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def write_srt(plan: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    blocks = []
    for index, segment in enumerate(plan.get("segments") or [], start=1):
        start = _format_srt_time(float(segment.get("start") or 0))
        end = _format_srt_time(float(segment.get("end") or 0))
        text = str(segment.get("text") or "").strip()
        blocks.append(f"{index}\n{start} --> {end}\n{text}\n")
    path.write_text("\n".join(blocks), encoding="utf-8")


def _target_size(aspect_ratio: str) -> tuple[int, int]:
    if aspect_ratio == "16:9":
        return 1920, 1080
    if aspect_ratio == "1:1":
        return 1080, 1080
    if aspect_ratio == "3:4":
        return 1080, 1440
    return 1080, 1920


def build_ffmpeg_command(
    plan: dict[str, Any],
    project_dir: Path,
    ffmpeg_path: str = "ffmpeg",
) -> list[str]:
    project_dir = Path(project_dir)
    source = project_dir / str(plan.get("sourceTalkingVideo") or "uploads/talking.mp4")
    captions_path = project_dir / "captions" / "captions.srt"
    output = project_dir / str((plan.get("render") or {}).get("output") or "renders/final.mp4")
    output.parent.mkdir(parents=True, exist_ok=True)
    captions_path.parent.mkdir(parents=True, exist_ok=True)

    width, height = _target_size(str(plan.get("aspectRatio") or "9:16"))
    subtitle_path = captions_path.as_posix().replace(":", "\\:")
    video_filter = (
        f"scale={width}:{height}:force_original_aspect_ratio=increase,"
        f"crop={width}:{height},"
        f"subtitles='{subtitle_path}':force_style='FontName=Microsoft YaHei,FontSize=18,Outline=2,Shadow=1'"
    )

    return [
        ffmpeg_path,
        "-y",
        "-i",
        str(source),
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
        str(output),
    ]


def render_status_when_ffmpeg_missing(command: list[str]) -> dict[str, Any]:
    return {
        "ok": False,
        "status": "missing_ffmpeg",
        "message": "FFmpeg 不可用，已保留剪辑方案和可复制命令。",
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
    log_path = project_dir / "logs" / "ffmpeg.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)

    if not ffmpeg_available(ffmpeg_path):
        status = render_status_when_ffmpeg_missing(command)
        log_path.write_text(json.dumps(status, ensure_ascii=False, indent=2), encoding="utf-8")
        return status

    if not execute:
        return {"ok": True, "status": "command_ready", "command": command}

    result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace")
    log_path.write_text((result.stdout or "") + "\n" + (result.stderr or ""), encoding="utf-8")
    if result.returncode != 0:
        return {"ok": False, "status": "failed", "command": command, "log": str(log_path)}
    return {
        "ok": True,
        "status": "done",
        "command": command,
        "output": str(project_dir / str((plan.get("render") or {}).get("output") or "renders/final.mp4")),
        "captions": str(captions_path),
        "log": str(log_path),
    }
```

- [ ] **Step 4: Run renderer tests**

Run:

```bat
cd /d D:\AI\3D\.worktrees\ai-content-pack-tool\KrLongAI-master
D:\Python312\python.exe -m unittest test_ffmpeg_video_renderer.py
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bat
cd /d D:\AI\3D\.worktrees\ai-content-pack-tool
git -c safe.directory=D:/AI/3D/.worktrees/ai-content-pack-tool add KrLongAI-master/ffmpeg_video_renderer.py KrLongAI-master/test_ffmpeg_video_renderer.py
git -c safe.directory=D:/AI/3D/.worktrees/ai-content-pack-tool commit -m "feat: add ffmpeg render command generation"
```

## Task 3: Add Precision Render Layers To FFmpeg Planning

**Files:**
- Modify: `KrLongAI-master/ffmpeg_video_renderer.py`
- Modify: `KrLongAI-master/test_ffmpeg_video_renderer.py`

- [ ] **Step 1: Add failing tests for B-roll inputs, title/CTA overlays, progress bar, and BGM command planning**

Append to `KrLongAI-master/test_ffmpeg_video_renderer.py` inside `FFmpegVideoRendererTests`:

```python
    def test_build_ffmpeg_command_includes_precision_layers_when_plan_has_assets(self):
        plan = self.sample_plan()
        plan["materials"] = [
            {
                "id": "asset-factory",
                "name": "工厂质检.mp4",
                "url": "uploads/assets/工厂质检.mp4",
                "type": "video",
                "tags": ["工厂"],
                "notes": "",
            }
        ]
        plan["segments"][1]["brollSlots"] = [
            {"startOffset": 0.4, "duration": 2.0, "assetId": "asset-factory", "reason": "匹配关键词：工厂"}
        ]
        plan["audio"]["bgmPath"] = "uploads/bgm/light.mp3"

        command = build_ffmpeg_command(
            plan,
            project_dir=Path("talking_video_projects/demo"),
            ffmpeg_path="ffmpeg",
        )
        joined = " ".join(command)

        self.assertIn("uploads/assets/工厂质检.mp4", joined)
        self.assertIn("uploads/bgm/light.mp3", joined)
        self.assertIn("-filter_complex", command)
        self.assertIn("drawtext", joined)
        self.assertIn("overlay", joined)
        self.assertIn("volume=0.18", joined)
        self.assertIn("progress", joined)

    def test_build_cover_command_exports_cover_frame(self):
        from ffmpeg_video_renderer import build_cover_command

        command = build_cover_command(
            self.sample_plan(),
            project_dir=Path("talking_video_projects/demo"),
            ffmpeg_path="ffmpeg",
        )
        joined = " ".join(command)

        self.assertEqual(command[0], "ffmpeg")
        self.assertIn("-ss", command)
        self.assertIn("renders/cover.jpg", joined)
        self.assertIn("uploads/talking.mp4", joined)
```

- [ ] **Step 2: Run the new tests to verify failure**

Run:

```bat
cd /d D:\AI\3D\.worktrees\ai-content-pack-tool\KrLongAI-master
D:\Python312\python.exe -m unittest test_ffmpeg_video_renderer.py
```

Expected: FAIL because `build_ffmpeg_command` does not yet add precision layers and `build_cover_command` does not exist.

- [ ] **Step 3: Replace `build_ffmpeg_command` and add precision helpers**

Modify `KrLongAI-master/ffmpeg_video_renderer.py` by replacing the existing `build_ffmpeg_command` with this version and adding the helper functions above it:

```python
def _asset_by_id(plan: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {str(item.get("id")): item for item in plan.get("materials") or []}


def _escape_drawtext(value: str) -> str:
    return str(value or "").replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")


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
            collected.append((str(asset.get("id")), project_dir / source, start, duration))
    return collected


def _base_video_filter(plan: dict[str, Any], captions_path: Path) -> str:
    width, height = _target_size(str(plan.get("aspectRatio") or "9:16"))
    subtitle_path = captions_path.as_posix().replace(":", "\\:")
    title = _escape_drawtext((plan.get("overlays") or {}).get("title") or "")
    cta = _escape_drawtext((plan.get("overlays") or {}).get("cta") or "")
    filters = [
        f"scale={width}:{height}:force_original_aspect_ratio=increase",
        f"crop={width}:{height}",
        f"subtitles='{subtitle_path}':force_style='FontName=Microsoft YaHei,FontSize=18,Outline=2,Shadow=1'",
    ]
    if title:
        filters.append(
            f"drawtext=text='{title}':x=(w-text_w)/2:y=90:fontsize=52:fontcolor=white:borderw=3:bordercolor=black@0.55"
        )
    if cta:
        filters.append(
            f"drawtext=text='{cta}':x=(w-text_w)/2:y=h-190:fontsize=34:fontcolor=white:borderw=3:bordercolor=black@0.55"
        )
    if (plan.get("overlays") or {}).get("progressBar", False):
        filters.append("drawbox=x=0:y=h-10:w='w*t/duration':h=10:color=#67d391@0.85:t=fill")
    return ",".join(filters)


def _build_filter_complex(plan: dict[str, Any], project_dir: Path, captions_path: Path, brolls: list[tuple[str, Path, float, float]], has_bgm: bool) -> list[str]:
    base = _base_video_filter(plan, captions_path)
    chains = [f"[0:v]{base}[vbase]"]
    current = "vbase"
    for index, (_, _, start, duration) in enumerate(brolls, start=1):
        width, height = _target_size(str(plan.get("aspectRatio") or "9:16"))
        broll_input = index
        broll_label = f"broll{index}"
        out_label = f"vout{index}"
        end = start + duration
        chains.append(
            f"[{broll_input}:v]scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},format=rgba,colorchannelmixer=aa=0.96[{broll_label}]"
        )
        chains.append(
            f"[{current}][{broll_label}]overlay=0:0:enable='between(t,{start:.2f},{end:.2f})'[{out_label}]"
        )
        current = out_label
    if has_bgm:
        bgm_input = 1 + len(brolls)
        chains.append(f"[{bgm_input}:a]volume=0.18[bgm]")
        chains.append("[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]")
    return [";".join(chains), current, "aout" if has_bgm else "0:a"]


def build_ffmpeg_command(
    plan: dict[str, Any],
    project_dir: Path,
    ffmpeg_path: str = "ffmpeg",
) -> list[str]:
    project_dir = Path(project_dir)
    source = project_dir / str(plan.get("sourceTalkingVideo") or "uploads/talking.mp4")
    captions_path = project_dir / "captions" / "captions.srt"
    output = project_dir / str((plan.get("render") or {}).get("output") or "renders/final.mp4")
    output.parent.mkdir(parents=True, exist_ok=True)
    captions_path.parent.mkdir(parents=True, exist_ok=True)

    brolls = _collect_broll_inputs(plan, project_dir)
    bgm_path = (plan.get("audio") or {}).get("bgmPath")
    has_bgm = bool(bgm_path)
    command = [ffmpeg_path, "-y", "-i", str(source)]
    for _, path, _, _ in brolls:
        command.extend(["-i", str(path)])
    if has_bgm:
        command.extend(["-i", str(project_dir / str(bgm_path))])

    filter_complex, video_label, audio_label = _build_filter_complex(plan, project_dir, captions_path, brolls, has_bgm)
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
            str(output),
        ]
    )
    return command
```

- [ ] **Step 4: Add cover command generation**

Add this function to `KrLongAI-master/ffmpeg_video_renderer.py` below `build_ffmpeg_command`:

```python
def build_cover_command(
    plan: dict[str, Any],
    project_dir: Path,
    ffmpeg_path: str = "ffmpeg",
) -> list[str]:
    project_dir = Path(project_dir)
    source = project_dir / str(plan.get("sourceTalkingVideo") or "uploads/talking.mp4")
    frame_at = str((plan.get("cover") or {}).get("frameAt") or 1.2)
    output = project_dir / "renders" / "cover.jpg"
    output.parent.mkdir(parents=True, exist_ok=True)
    width, height = _target_size(str(plan.get("aspectRatio") or "9:16"))
    cover_text = _escape_drawtext((plan.get("cover") or {}).get("text") or (plan.get("overlays") or {}).get("title") or "")
    vf = (
        f"scale={width}:{height}:force_original_aspect_ratio=increase,"
        f"crop={width}:{height},"
        f"drawtext=text='{cover_text}':x=(w-text_w)/2:y=h*0.16:fontsize=62:fontcolor=white:borderw=4:bordercolor=black@0.6"
    )
    return [ffmpeg_path, "-y", "-ss", frame_at, "-i", str(source), "-frames:v", "1", "-vf", vf, str(output)]
```

- [ ] **Step 5: Update `render_edit_plan` to write cover output after successful render**

Modify the success branch in `render_edit_plan`:

```python
    cover_command = build_cover_command(plan, project_dir, ffmpeg_path)
    cover_result = subprocess.run(cover_command, capture_output=True, text=True, encoding="utf-8", errors="replace")
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write("\n\n# cover\n")
        handle.write((cover_result.stdout or "") + "\n" + (cover_result.stderr or ""))
    return {
        "ok": True,
        "status": "done",
        "command": command,
        "coverCommand": cover_command,
        "output": str(project_dir / str((plan.get("render") or {}).get("output") or "renders/final.mp4")),
        "captions": str(captions_path),
        "cover": str(project_dir / "renders" / "cover.jpg"),
        "log": str(log_path),
    }
```

- [ ] **Step 6: Run renderer tests**

Run:

```bat
cd /d D:\AI\3D\.worktrees\ai-content-pack-tool\KrLongAI-master
D:\Python312\python.exe -m unittest test_ffmpeg_video_renderer.py
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bat
cd /d D:\AI\3D\.worktrees\ai-content-pack-tool
git -c safe.directory=D:/AI/3D/.worktrees/ai-content-pack-tool add KrLongAI-master/ffmpeg_video_renderer.py KrLongAI-master/test_ffmpeg_video_renderer.py
git -c safe.directory=D:/AI/3D/.worktrees/ai-content-pack-tool commit -m "feat: plan precision ffmpeg render layers"
```

## Task 4: Add Server Persistence And API Endpoints

**Files:**
- Modify: `KrLongAI-master/custom_home_server.py`
- Test: `KrLongAI-master/test_custom_home_server_talking_video.py`

- [ ] **Step 1: Write failing server API tests**

Create `KrLongAI-master/test_custom_home_server_talking_video.py`:

```python
import json
import tempfile
import threading
import unittest
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path

import custom_home_server as server_module
from custom_home_server import CustomHomeHandler


class TalkingVideoServerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.old_talking_dir = getattr(server_module, "TALKING_VIDEO_DIR", None)
        server_module.TALKING_VIDEO_DIR = Path(self.tmp.name) / "talking_video_projects"
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), CustomHomeHandler)
        self.port = self.httpd.server_address[1]
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.httpd.shutdown()
        self.thread.join(timeout=2)
        if self.old_talking_dir is not None:
            server_module.TALKING_VIDEO_DIR = self.old_talking_dir
        self.tmp.cleanup()

    def request_json(self, method, path, payload=None):
        conn = HTTPConnection("127.0.0.1", self.port, timeout=5)
        body = json.dumps(payload or {}, ensure_ascii=False).encode("utf-8")
        conn.request(method, path, body=body, headers={"Content-Type": "application/json; charset=utf-8"})
        response = conn.getresponse()
        data = json.loads(response.read().decode("utf-8"))
        conn.close()
        return response.status, data

    def test_create_list_and_load_talking_video_project(self):
        status, created = self.request_json("POST", "/api/talking-video/projects", {"name": "测试 项目"})
        self.assertEqual(status, 200)
        self.assertTrue(created["ok"])
        project_id = created["project"]["id"]

        status, projects = self.request_json("GET", "/api/talking-video/projects")
        self.assertEqual(status, 200)
        self.assertEqual(projects[0]["id"], project_id)

        status, loaded = self.request_json("GET", f"/api/talking-video/projects/{project_id}")
        self.assertEqual(status, 200)
        self.assertEqual(loaded["id"], project_id)

    def test_generate_plan_endpoint_saves_edit_plan(self):
        _, created = self.request_json("POST", "/api/talking-video/projects", {"name": "demo"})
        project_id = created["project"]["id"]
        status, result = self.request_json(
            "POST",
            "/api/talking-video/plan",
            {
                "projectId": project_id,
                "talkingVideo": "uploads/talking.mp4",
                "script": "装修选门别只看价格。还要看工厂质检。",
                "duration": 18,
                "materials": [{"name": "工厂质检.mp4", "url": "uploads/assets/工厂质检.mp4"}],
            },
        )

        self.assertEqual(status, 200)
        self.assertTrue(result["ok"])
        self.assertEqual(result["plan"]["projectId"], project_id)
        self.assertTrue((server_module.TALKING_VIDEO_DIR / project_id / "edit_plan.json").exists())

    def test_render_endpoint_returns_missing_ffmpeg_when_configured_path_is_missing(self):
        _, created = self.request_json("POST", "/api/talking-video/projects", {"name": "demo"})
        project_id = created["project"]["id"]
        self.request_json(
            "POST",
            "/api/talking-video/plan",
            {
                "projectId": project_id,
                "talkingVideo": "uploads/talking.mp4",
                "script": "装修选门别只看价格。",
                "duration": 8,
                "materials": [],
            },
        )

        status, result = self.request_json(
            "POST",
            "/api/talking-video/render",
            {"projectId": project_id, "ffmpegPath": "definitely-not-existing-ffmpeg"},
        )

        self.assertEqual(status, 200)
        self.assertFalse(result["ok"])
        self.assertEqual(result["status"], "missing_ffmpeg")
        self.assertIn("command", result)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run server tests to verify failure**

Run:

```bat
cd /d D:\AI\3D\.worktrees\ai-content-pack-tool\KrLongAI-master
D:\Python312\python.exe -m unittest test_custom_home_server_talking_video.py
```

Expected: FAIL because `TALKING_VIDEO_DIR` and `/api/talking-video/*` endpoints do not exist.

- [ ] **Step 3: Add imports and runtime directory constant**

Modify `KrLongAI-master/custom_home_server.py` near the existing imports and constants:

```python
from ffmpeg_video_renderer import render_edit_plan
from talking_video_editor import build_edit_plan, normalize_materials, safe_project_id, save_edit_plan
```

Add near `PACKAGE_DIR`:

```python
TALKING_VIDEO_DIR = ROOT / "talking_video_projects"
```

- [ ] **Step 4: Add talking-video GET routes**

Modify `do_GET` in `CustomHomeHandler` after the existing `/api/digital-human/packages` route:

```python
        if parsed.path == "/api/talking-video/projects":
            return self._send_json(self._list_talking_video_projects())
        if parsed.path.startswith("/api/talking-video/projects/"):
            project_id = safe_project_id(unquote(parsed.path.removeprefix("/api/talking-video/projects/")))
            path = TALKING_VIDEO_DIR / project_id / "project.json"
            if not path.exists():
                return self._send_error(HTTPStatus.NOT_FOUND, "口播剪辑项目不存在")
            return self._send_json(json.loads(path.read_text(encoding="utf-8")))
```

- [ ] **Step 5: Add talking-video POST routes**

Modify `do_POST` after the existing `/api/materials` route:

```python
        if parsed.path == "/api/talking-video/projects":
            return self._save_talking_video_project(self._read_json())
        if parsed.path == "/api/talking-video/assets":
            return self._handle_talking_video_asset_upload()
        if parsed.path == "/api/talking-video/plan":
            return self._generate_talking_video_plan(self._read_json())
        if parsed.path == "/api/talking-video/render":
            return self._render_talking_video(self._read_json())
```

- [ ] **Step 6: Add talking-video DELETE route**

Modify `do_DELETE` before the final not-found return:

```python
        if parsed.path.startswith("/api/talking-video/projects/"):
            project_id = safe_project_id(unquote(parsed.path.removeprefix("/api/talking-video/projects/")))
            path = TALKING_VIDEO_DIR / project_id
            if path.exists():
                import shutil

                shutil.rmtree(path)
            return self._send_json({"ok": True, "projects": self._list_talking_video_projects()})
```

- [ ] **Step 7: Add helper methods to `CustomHomeHandler`**

Add these methods before `_send_json`:

```python
    def _talking_project_dir(self, project_id: str) -> Path:
        return TALKING_VIDEO_DIR / safe_project_id(project_id)

    def _list_talking_video_projects(self) -> list[dict]:
        TALKING_VIDEO_DIR.mkdir(exist_ok=True)
        projects = []
        for path in sorted(TALKING_VIDEO_DIR.glob("*/project.json"), key=lambda item: item.stat().st_mtime, reverse=True):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                continue
            projects.append(
                {
                    "id": data.get("id") or path.parent.name,
                    "name": data.get("name") or path.parent.name,
                    "savedAt": data.get("savedAt") or "",
                    "hasPlan": (path.parent / "edit_plan.json").exists(),
                    "hasRender": (path.parent / "renders" / "final.mp4").exists(),
                }
            )
        return projects

    def _save_talking_video_project(self, payload: dict) -> None:
        import datetime

        name = str(payload.get("name") or "口播剪辑项目")
        project_id = safe_project_id(payload.get("id") or name)
        project_dir = self._talking_project_dir(project_id)
        project_dir.mkdir(parents=True, exist_ok=True)
        data = {
            **payload,
            "id": project_id,
            "name": name,
            "savedAt": datetime.datetime.now().isoformat(timespec="seconds"),
        }
        (project_dir / "project.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        self._send_json({"ok": True, "project": data, "projects": self._list_talking_video_projects()})

    def _handle_talking_video_asset_upload(self) -> None:
        form = self._read_multipart()
        project = safe_project_id(form.getfirst("project", "talking-video"))
        role = safe_project_id(form.getfirst("role", "assets"))
        base = self._talking_project_dir(project) / "uploads" / role
        saved = self._save_uploaded_files(form, base, "")
        for item in saved:
            if item.get("url", "").startswith("/"):
                item["url"] = item["url"].replace("/talking_video_projects/", "talking_video_projects/", 1)
        self._send_json({"ok": True, "project": project, "role": role, "files": saved})

    def _generate_talking_video_plan(self, payload: dict) -> None:
        project_id = safe_project_id(payload.get("projectId") or payload.get("name") or "talking-video")
        project_dir = self._talking_project_dir(project_id)
        project_dir.mkdir(parents=True, exist_ok=True)
        materials = normalize_materials(payload.get("materials") or [])
        plan = build_edit_plan(
            project_id=project_id,
            talking_video=payload.get("talkingVideo") or "uploads/talking.mp4",
            script=payload.get("script") or payload.get("transcript") or "",
            materials=materials,
            duration=payload.get("duration"),
            aspect_ratio=payload.get("aspectRatio") or "9:16",
            title=payload.get("title"),
            cta=payload.get("cta"),
        )
        save_edit_plan(plan, project_dir / "edit_plan.json")
        self._send_json({"ok": True, "projectId": project_id, "plan": plan})

    def _render_talking_video(self, payload: dict) -> None:
        project_id = safe_project_id(payload.get("projectId") or "")
        if not project_id:
            return self._send_error(HTTPStatus.BAD_REQUEST, "缺少 projectId")
        project_dir = self._talking_project_dir(project_id)
        plan_path = project_dir / "edit_plan.json"
        if not plan_path.exists():
            return self._send_error(HTTPStatus.NOT_FOUND, "剪辑方案不存在")
        plan = json.loads(plan_path.read_text(encoding="utf-8"))
        result = render_edit_plan(
            plan,
            project_dir,
            ffmpeg_path=payload.get("ffmpegPath") or "ffmpeg",
            execute=bool(payload.get("execute", True)),
        )
        self._send_json(result)
```

- [ ] **Step 8: Run server tests**

Run:

```bat
cd /d D:\AI\3D\.worktrees\ai-content-pack-tool\KrLongAI-master
D:\Python312\python.exe -m unittest test_custom_home_server_talking_video.py
```

Expected: PASS.

- [ ] **Step 9: Run existing tests to catch route regressions**

Run:

```bat
cd /d D:\AI\3D\.worktrees\ai-content-pack-tool\KrLongAI-master
D:\Python312\python.exe -m unittest test_custom_home_agent.py test_cloud_runtime_client.py test_custom_home_server_talking_video.py
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bat
cd /d D:\AI\3D\.worktrees\ai-content-pack-tool
git -c safe.directory=D:/AI/3D/.worktrees/ai-content-pack-tool add KrLongAI-master/custom_home_server.py KrLongAI-master/test_custom_home_server_talking_video.py
git -c safe.directory=D:/AI/3D/.worktrees/ai-content-pack-tool commit -m "feat: add talking video server api"
```

## Task 5: Add The Local Talking Video Workbench Page

**Files:**
- Create: `KrLongAI-master/talking_video_editor.html`
- Modify: `KrLongAI-master/custom_home_server.py`
- Test: inline script syntax check command

- [ ] **Step 1: Create a syntax-check script command for the new HTML**

Run this command before the page exists to verify the check fails with file not found:

```powershell
cd D:\AI\3D\.worktrees\ai-content-pack-tool\KrLongAI-master
node -e "const fs=require('fs'); const html=fs.readFileSync('talking_video_editor.html','utf8'); const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]); const vm=require('vm'); scripts.forEach((s,i)=>new vm.Script(s,{filename:'talking_video_editor.html#'+i})); console.log('talking_video_editor.html inline script OK')"
```

Expected: FAIL because `talking_video_editor.html` does not exist.

- [ ] **Step 2: Create `talking_video_editor.html`**

Create `KrLongAI-master/talking_video_editor.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>口播视频 AI 自动精剪</title>
    <style>
      :root {
        color: #1d211f;
        background: #f5f7f4;
        font-family: "Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        min-height: 100vh;
        background: #f5f7f4;
      }
      button,
      input,
      textarea,
      select {
        font: inherit;
      }
      .shell {
        max-width: 1220px;
        margin: 0 auto;
        padding: 24px;
      }
      .topbar {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: flex-start;
        margin-bottom: 18px;
      }
      h1 {
        margin: 0 0 6px;
        font-size: 30px;
      }
      .subtitle {
        margin: 0;
        color: #66736b;
        line-height: 1.6;
      }
      .grid {
        display: grid;
        grid-template-columns: 360px minmax(0, 1fr);
        gap: 16px;
      }
      .panel {
        border: 1px solid #d9dfd8;
        border-radius: 8px;
        background: #fff;
        padding: 16px;
      }
      .panel h2 {
        margin: 0 0 12px;
        font-size: 18px;
      }
      label {
        display: block;
        margin: 12px 0 6px;
        color: #4b574f;
        font-size: 13px;
      }
      input,
      textarea,
      select {
        width: 100%;
        border: 1px solid #d4dcd3;
        border-radius: 8px;
        padding: 10px;
      }
      textarea {
        min-height: 140px;
        resize: vertical;
      }
      .actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-top: 14px;
      }
      .primary {
        border: 0;
        border-radius: 8px;
        background: #26352d;
        color: #fff;
        padding: 10px 14px;
        cursor: pointer;
      }
      .secondary {
        border: 1px solid #cfd8cf;
        border-radius: 8px;
        background: #fff;
        color: #26352d;
        padding: 10px 14px;
        cursor: pointer;
      }
      .status {
        margin-top: 12px;
        color: #66736b;
        line-height: 1.6;
        white-space: pre-wrap;
      }
      .segment {
        border: 1px solid #e2e8e0;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 10px;
        background: #fbfcfa;
      }
      .segment strong {
        display: block;
        margin-bottom: 6px;
      }
      .segment small {
        color: #66736b;
      }
      .json-box {
        min-height: 320px;
        font-family: Consolas, "SFMono-Regular", monospace;
        font-size: 13px;
      }
      @media (max-width: 900px) {
        .grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <header class="topbar">
        <div>
          <h1>口播视频 AI 自动精剪</h1>
          <p class="subtitle">上传口播视频和真实素材，先生成可编辑剪辑方案，再用 FFmpeg 渲染 MP4 草稿。</p>
        </div>
        <a class="secondary" href="/">返回内容工作台</a>
      </header>

      <div class="grid">
        <section class="panel">
          <h2>项目输入</h2>
          <label>项目名称</label>
          <input id="projectName" value="同城门店口播精剪" />

          <label>口播视频路径或上传后地址</label>
          <input id="talkingVideo" value="uploads/talking.mp4" />

          <label>视频时长（秒）</label>
          <input id="duration" type="number" value="60" min="5" max="300" />

          <label>输出比例</label>
          <select id="aspectRatio">
            <option value="9:16">9:16 竖屏</option>
            <option value="3:4">3:4</option>
            <option value="1:1">1:1</option>
            <option value="16:9">16:9 横屏</option>
          </select>

          <label>口播脚本</label>
          <textarea id="script">装修选门不要只看价格。先看门套和锁具，再看工厂质检。最后一定要看真实安装案例。</textarea>

          <label>素材 JSON（第一版可先粘贴上传后的素材列表）</label>
          <textarea id="materials">[
  {"name":"入户门细节.jpg","url":"uploads/assets/入户门细节.jpg","tags":["产品","入户门","细节"]},
  {"name":"工厂质检.mp4","url":"uploads/assets/工厂质检.mp4","tags":["工厂","质检"]},
  {"name":"安装案例.mp4","url":"uploads/assets/安装案例.mp4","tags":["安装","案例"]}
]</textarea>

          <div class="actions">
            <button class="primary" type="button" onclick="createProjectAndPlan()">生成剪辑方案</button>
            <button class="secondary" type="button" onclick="renderPlan()">渲染 MP4</button>
          </div>
          <div id="status" class="status">等待操作。</div>
        </section>

        <section class="panel">
          <h2>剪辑方案</h2>
          <div id="segments"></div>
          <label>edit_plan.json</label>
          <textarea id="planJson" class="json-box"></textarea>
        </section>
      </div>
    </main>

    <script>
      let currentProjectId = "";

      function setStatus(text) {
        document.getElementById("status").textContent = text;
      }

      function readMaterials() {
        const raw = document.getElementById("materials").value.trim();
        if (!raw) return [];
        return JSON.parse(raw);
      }

      function renderSegments(plan) {
        const box = document.getElementById("segments");
        box.innerHTML = "";
        (plan.segments || []).forEach((segment) => {
          const div = document.createElement("div");
          div.className = "segment";
          const broll = (segment.brollSlots || []).map((slot) => slot.assetId).join("、") || "无素材穿插";
          div.innerHTML = `<strong>${segment.id} ${segment.intent || ""}</strong><div>${segment.text || ""}</div><small>${segment.start}s - ${segment.end}s｜${broll}</small>`;
          box.appendChild(div);
        });
      }

      async function createProjectAndPlan() {
        try {
          setStatus("正在创建项目...");
          const name = document.getElementById("projectName").value.trim() || "口播剪辑项目";
          const created = await fetch("/api/talking-video/projects", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({name})
          }).then((response) => response.json());
          currentProjectId = created.project.id;

          setStatus("正在生成剪辑方案...");
          const payload = {
            projectId: currentProjectId,
            talkingVideo: document.getElementById("talkingVideo").value.trim(),
            script: document.getElementById("script").value,
            duration: Number(document.getElementById("duration").value || 60),
            aspectRatio: document.getElementById("aspectRatio").value,
            materials: readMaterials()
          };
          const result = await fetch("/api/talking-video/plan", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload)
          }).then((response) => response.json());

          document.getElementById("planJson").value = JSON.stringify(result.plan, null, 2);
          renderSegments(result.plan);
          setStatus(`剪辑方案已生成：${currentProjectId}`);
        } catch (error) {
          setStatus(`生成失败：${error.message}`);
        }
      }

      async function renderPlan() {
        try {
          if (!currentProjectId) {
            setStatus("请先生成剪辑方案。");
            return;
          }
          setStatus("正在请求渲染...");
          const result = await fetch("/api/talking-video/render", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({projectId: currentProjectId})
          }).then((response) => response.json());
          setStatus(JSON.stringify(result, null, 2));
        } catch (error) {
          setStatus(`渲染失败：${error.message}`);
        }
      }
    </script>
  </body>
</html>
```

- [ ] **Step 3: Add server startup log for the new page**

Modify `main()` in `custom_home_server.py`:

```python
    print(f"Talking video editor: http://{args.host}:{args.port}/talking_video_editor.html")
```

Place it after the existing digital-human studio print.

- [ ] **Step 4: Run inline script syntax check**

Run:

```powershell
cd D:\AI\3D\.worktrees\ai-content-pack-tool\KrLongAI-master
node -e "const fs=require('fs'); const html=fs.readFileSync('talking_video_editor.html','utf8'); const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]); const vm=require('vm'); scripts.forEach((s,i)=>new vm.Script(s,{filename:'talking_video_editor.html#'+i})); console.log('talking_video_editor.html inline script OK')"
```

Expected: prints `talking_video_editor.html inline script OK`.

- [ ] **Step 5: Run server API tests again**

Run:

```bat
cd /d D:\AI\3D\.worktrees\ai-content-pack-tool\KrLongAI-master
D:\Python312\python.exe -m unittest test_custom_home_server_talking_video.py
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bat
cd /d D:\AI\3D\.worktrees\ai-content-pack-tool
git -c safe.directory=D:/AI/3D/.worktrees/ai-content-pack-tool add KrLongAI-master/talking_video_editor.html KrLongAI-master/custom_home_server.py
git -c safe.directory=D:/AI/3D/.worktrees/ai-content-pack-tool commit -m "feat: add talking video edit workbench"
```

## Task 6: Add Runtime Ignores And Pipeline Package Metadata

**Files:**
- Modify: `KrLongAI-master/.gitignore`
- Modify: `KrLongAI-master/content_pipeline.py`
- Test: `KrLongAI-master/test_talking_video_editor.py`

- [ ] **Step 1: Add a failing ignore assertion**

Append this test to `KrLongAI-master/test_talking_video_editor.py`:

```python
    def test_gitignore_excludes_talking_video_runtime_outputs(self):
        ignore = Path(".gitignore").read_text(encoding="utf-8")

        self.assertIn("talking_video_projects/", ignore)
        self.assertIn("talking_video_exports/", ignore)
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bat
cd /d D:\AI\3D\.worktrees\ai-content-pack-tool\KrLongAI-master
D:\Python312\python.exe -m unittest test_talking_video_editor.TalkingVideoEditorTests.test_gitignore_excludes_talking_video_runtime_outputs
```

Expected: FAIL because `.gitignore` does not yet include these folders.

- [ ] **Step 3: Update `.gitignore`**

Append to `KrLongAI-master/.gitignore`:

```gitignore
talking_video_projects/
talking_video_exports/
```

- [ ] **Step 4: Add talking-video stage metadata to `content_pipeline.py`**

Modify the `stages` list in `build_pipeline_package` to include the talking-video stage after the current `editing` stage:

```python
            {"id": "talking_video_auto_edit", "tool": "talking_video_editor.py + ffmpeg_video_renderer.py", "status": "optional_local_runtime"},
```

Modify the generated README next-step list to include the talking-video editor before manual publishing:

```python
                "5. 如果已有真人口播视频，打开 `talking_video_editor.html` 生成 `edit_plan.json` 并渲染 MP4 草稿。",
                "6. 先人工发布，等账号稳定后再接 social-auto-upload。",
```

Keep the numbering coherent by replacing the old items 5 and later in that README block.

- [ ] **Step 5: Run tests**

Run:

```bat
cd /d D:\AI\3D\.worktrees\ai-content-pack-tool\KrLongAI-master
D:\Python312\python.exe -m unittest test_talking_video_editor.py
D:\Python312\python.exe -m py_compile content_pipeline.py
```

Expected: PASS and `py_compile` exits with code 0.

- [ ] **Step 6: Commit**

```bat
cd /d D:\AI\3D\.worktrees\ai-content-pack-tool
git -c safe.directory=D:/AI/3D/.worktrees/ai-content-pack-tool add KrLongAI-master/.gitignore KrLongAI-master/content_pipeline.py KrLongAI-master/test_talking_video_editor.py
git -c safe.directory=D:/AI/3D/.worktrees/ai-content-pack-tool commit -m "chore: track talking video runtime boundaries"
```

## Task 7: Full Verification And Browser Smoke Test

**Files:**
- Modify only if verification reveals issues.

- [ ] **Step 1: Run the full Python test suite**

Run:

```bat
cd /d D:\AI\3D\.worktrees\ai-content-pack-tool\KrLongAI-master
D:\Python312\python.exe -m unittest test_custom_home_agent.py test_cloud_runtime_client.py test_talking_video_editor.py test_ffmpeg_video_renderer.py test_custom_home_server_talking_video.py
```

Expected: all tests PASS.

- [ ] **Step 2: Run Python compile checks**

Run:

```bat
cd /d D:\AI\3D\.worktrees\ai-content-pack-tool\KrLongAI-master
D:\Python312\python.exe -m py_compile custom_home_server.py custom_home_agent.py cloud_runtime_client.py content_pipeline.py talking_video_editor.py ffmpeg_video_renderer.py
```

Expected: exits with code 0.

- [ ] **Step 3: Check HTML inline scripts**

Run:

```powershell
cd D:\AI\3D\.worktrees\ai-content-pack-tool\KrLongAI-master
node -e "const fs=require('fs'),vm=require('vm'); for (const file of ['custom_home_agent.html','custom_home_settings.html','digital_human_studio.html','talking_video_editor.html']) { const html=fs.readFileSync(file,'utf8'); const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]); scripts.forEach((s,i)=>new vm.Script(s,{filename:file+'#'+i})); console.log(file+' inline script OK'); }"
```

Expected: every listed HTML file prints `inline script OK`.

- [ ] **Step 4: Start the local server**

Run:

```bat
cd /d D:\AI\3D\.worktrees\ai-content-pack-tool\KrLongAI-master
D:\Python312\python.exe custom_home_server.py --port 8765
```

Expected output includes:

```text
Custom home workbench: http://127.0.0.1:8765/
Digital human studio: http://127.0.0.1:8765/digital_human_studio.html
Talking video editor: http://127.0.0.1:8765/talking_video_editor.html
```

- [ ] **Step 5: Browser smoke test**

Open:

```text
http://127.0.0.1:8765/talking_video_editor.html
```

Verify:

- Page loads with title `口播视频 AI 自动精剪`.
- Clicking `生成剪辑方案` creates a project and fills `edit_plan.json`.
- The segment list appears.
- Clicking `渲染 MP4` returns either `missing_ffmpeg` with a command or `done` if FFmpeg is installed and the sample video path exists.
- The page does not overlap text on a narrow viewport.

- [ ] **Step 6: Final status check**

Run:

```bat
cd /d D:\AI\3D\.worktrees\ai-content-pack-tool
git -c safe.directory=D:/AI/3D/.worktrees/ai-content-pack-tool status --short
```

Expected: no unrelated changes. Runtime folders such as `talking_video_projects/` must not appear because `.gitignore` excludes them.

- [ ] **Step 7: Commit any verification-only fixes**

If verification required fixes, commit them:

```bat
cd /d D:\AI\3D\.worktrees\ai-content-pack-tool
git -c safe.directory=D:/AI/3D/.worktrees/ai-content-pack-tool add KrLongAI-master
git -c safe.directory=D:/AI/3D/.worktrees/ai-content-pack-tool commit -m "chore: verify talking video auto edit workflow"
```

Skip this commit if no files changed.

## Self-Review

Spec coverage:

- User-uploaded talking video: Task 4 adds project/assets API and Task 5 adds workbench fields.
- Optional script and transcript fallback: Task 1 supports script-first planning and missing-script warnings; real ASR remains out of MVP as specified.
- Tagged real materials: Task 1 normalizes tags and matches B-roll; Task 5 exposes material JSON entry; Task 4 supports upload endpoint.
- Editable edit plan: Task 5 displays `edit_plan.json` and segments; deeper per-field editing can build on the same page after MVP validation.
- FFmpeg MP4 render path: Task 2 builds base render commands and missing-FFmpeg degradation; Task 3 adds B-roll/title/CTA/progress/BGM/cover command planning; Task 4 exposes render endpoint.
- Precision edit effects: Task 1 stores the effect plan and Task 3 turns B-roll, title, CTA, progress bar, BGM ducking, and cover export into concrete FFmpeg command layers. Simple sound effects remain represented in `edit_plan.json`; actual sound-effect mixing is deferred unless local sound files are provided.
- Degradation: Task 1 covers missing materials/script; Task 2 covers missing FFmpeg; Task 3 returns explicit JSON errors.
- Runtime privacy: Task 5 updates `.gitignore`.
- Verification: Task 6 covers unit tests, compile checks, HTML script checks, server, and browser smoke test.

Placeholder scan:

- No placeholder markers or vague "add tests" steps are present.
- Each task includes concrete files, commands, and expected outcomes.

Type consistency:

- `projectId`, `sourceTalkingVideo`, `aspectRatio`, `segments`, `brollSlots`, `captions`, `overlays`, `audio`, `cover`, `render`, and `warnings` are introduced in Task 1 and reused consistently later.
- Server endpoints use `/api/talking-video/*` consistently.
- Runtime folder name is consistently `talking_video_projects/`.
