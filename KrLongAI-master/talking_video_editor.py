from __future__ import annotations

from dataclasses import asdict, dataclass
import json
from pathlib import Path
import re
from typing import Any
from urllib.parse import urlparse


WINDOWS_UNSAFE_RE = re.compile(r'[<>:"/\\|?*]+')
SENTENCE_SPLIT_RE = re.compile(r"[^。！？!?；;.\n\r]+[。！？!?；;.]*")
TEXT_SPLIT_RE = re.compile(r"[，。！？；：、,.!?;:\s]+")

KEYWORD_GROUPS: dict[str, list[str]] = {
    "产品": ["产品", "入户门", "门套", "锁具", "细节", "实物", "材质", "配置", "卖点"],
    "工厂": ["工厂", "生产线", "生产", "质检", "车间", "制造", "实力"],
    "案例": ["案例", "安装", "客户", "效果", "实拍", "交付", "背书"],
    "门店": ["门店", "到店", "展厅", "看样", "样品", "预约"],
    "价格": ["价格", "报价", "预算", "优惠", "便宜", "贵", "性价比", "成本"],
}


@dataclass
class MaterialAsset:
    id: str
    name: str
    url: str
    type: str
    tags: list[str]
    notes: str = ""


def safe_project_id(value: str) -> str:
    text = WINDOWS_UNSAFE_RE.sub("-", str(value or ""))
    text = re.sub(r"\s+", "-", text)
    text = re.sub(r"-{2,}", "-", text)
    text = text.strip(" .-")
    text = text[:80].strip(" .-")
    return text or "talking-video"


def infer_material_type(name: str, url: str = "") -> str:
    for source in (name, url):
        suffix = Path(urlparse(str(source or "")).path).suffix.lower()
        if suffix in {".mp4", ".mov", ".avi", ".mkv", ".webm"}:
            return "video"
        if suffix in {".jpg", ".jpeg", ".png", ".webp", ".bmp"}:
            return "image"
    return "unknown"


def _append_unique(values: list[str], value: str) -> None:
    clean = value.strip()
    if clean and clean not in values:
        values.append(clean)


def _tokenize_text(text: str) -> list[str]:
    source = str(text or "")
    tokens: list[str] = []

    for canonical, words in KEYWORD_GROUPS.items():
        matched = False
        for word in words:
            if word in source:
                matched = True
                _append_unique(tokens, word)
        if matched:
            _append_unique(tokens, canonical)

    for fragment in TEXT_SPLIT_RE.split(source):
        fragment = fragment.strip(" .-_()（）[]【】")
        if 1 < len(fragment) <= 12:
            _append_unique(tokens, fragment)

    return tokens


def normalize_materials(items: list[dict[str, Any]]) -> list[MaterialAsset]:
    assets: list[MaterialAsset] = []
    used_ids: set[str] = set()

    for index, item in enumerate(items or [], start=1):
        if isinstance(item, MaterialAsset):
            asset = MaterialAsset(
                id=item.id,
                name=item.name,
                url=item.url,
                type=item.type,
                tags=list(item.tags),
                notes=item.notes,
            )
        else:
            url = str(item.get("url") or item.get("path") or "")
            name = str(item.get("name") or Path(urlparse(url).path).name or f"material-{index:03d}")
            notes = str(item.get("notes") or "")
            material_type = str(item.get("type") or infer_material_type(name, url))

            raw_tags = item.get("tags") or []
            if isinstance(raw_tags, str):
                raw_tags = [raw_tags]

            tags: list[str] = []
            for tag in raw_tags:
                _append_unique(tags, str(tag))
            for token in _tokenize_text(" ".join([name, notes, " ".join(map(str, raw_tags))])):
                _append_unique(tags, token)

            raw_id = str(item.get("id") or f"asset-{safe_project_id(Path(name).stem or str(index))}")
            asset = MaterialAsset(
                id=raw_id,
                name=name,
                url=url,
                type=material_type,
                tags=tags,
                notes=notes,
            )

        base_id = safe_project_id(asset.id)
        candidate = base_id
        counter = 2
        while candidate in used_ids:
            candidate = f"{base_id}-{counter}"
            counter += 1
        used_ids.add(candidate)
        asset.id = candidate
        assets.append(asset)

    return assets


def _split_script_sentences(script: str) -> list[str]:
    parts = [part.strip() for part in SENTENCE_SPLIT_RE.findall(str(script or ""))]
    return [part for part in parts if part]


def segment_script(script: str, duration: float | None = None) -> list[dict[str, Any]]:
    sentences = _split_script_sentences(script)
    if not sentences:
        return []

    total_duration = float(duration) if duration and duration > 0 else float(len(sentences) * 6)
    segment_duration = total_duration / len(sentences)
    segments: list[dict[str, Any]] = []

    for index, sentence in enumerate(sentences):
        start = round(index * segment_duration, 2)
        end = round(total_duration if index == len(sentences) - 1 else (index + 1) * segment_duration, 2)
        segments.append(
            {
                "id": f"seg-{index + 1:03d}",
                "start": start,
                "end": end,
                "text": sentence,
                "intent": infer_segment_intent(sentence, index),
                "keywords": _tokenize_text(sentence),
                "brollSlots": [],
            }
        )

    return segments


def infer_segment_intent(text: str, index: int) -> str:
    source = str(text or "")
    if index == 0 and any(word in source for word in ["不要", "只看", "坑", "问题", "担心"]):
        return "开场痛点"
    if any(word in source for word in KEYWORD_GROUPS["价格"]):
        return "价格解释"
    if any(word in source for word in KEYWORD_GROUPS["工厂"]):
        return "工厂实力"
    if any(word in source for word in KEYWORD_GROUPS["案例"]):
        return "案例背书"
    if any(word in source for word in KEYWORD_GROUPS["门店"]):
        return "转化引导"
    return "卖点讲解"


def match_materials_for_segment(segment: dict[str, Any], materials: list[MaterialAsset]) -> list[dict[str, Any]]:
    if not materials:
        return []

    segment_keywords = [str(keyword) for keyword in segment.get("keywords", [])]
    for token in _tokenize_text(str(segment.get("text", ""))):
        _append_unique(segment_keywords, token)

    best_asset: MaterialAsset | None = None
    best_matches: list[str] = []
    best_score = 0

    for asset in materials:
        asset_keywords = list(asset.tags)
        for token in _tokenize_text(" ".join([asset.name, asset.notes])):
            _append_unique(asset_keywords, token)

        matches = [keyword for keyword in segment_keywords if keyword in set(asset_keywords)]
        score = len(matches) * 2
        if asset.type == "video":
            score += 1

        if matches and score > best_score:
            best_asset = asset
            best_matches = matches
            best_score = score

    if not best_asset:
        return []

    start_offset = 1.0
    segment_length = round(float(segment.get("end", 0)) - float(segment.get("start", 0)), 2)
    max_slot_duration = round(segment_length - start_offset, 2)
    if max_slot_duration < 1.0:
        return []

    duration = round(min(2.0, max_slot_duration), 2)
    reason_keywords = "、".join(best_matches[:3])
    return [
        {
            "startOffset": start_offset,
            "duration": duration,
            "assetId": best_asset.id,
            "reason": f"匹配关键词：{reason_keywords}",
        }
    ]


def infer_title(script: str) -> str:
    source = str(script or "")
    if any(word in source for word in KEYWORD_GROUPS["价格"]):
        return "选门价格避坑指南"
    if any(word in source for word in KEYWORD_GROUPS["工厂"]):
        return "工厂实力看得见"
    if any(word in source for word in KEYWORD_GROUPS["案例"]):
        return "真实案例教你选门"
    if any(word in source for word in KEYWORD_GROUPS["门店"]):
        return "到店看门更放心"
    if any(word in source for word in KEYWORD_GROUPS["产品"]):
        return "入户门细节怎么选"

    first_sentence = _split_script_sentences(source)
    if first_sentence:
        return first_sentence[0].strip("。！？!?；;.")[:16]
    return "口播剪辑方案"


def _duration_target_value(value: float) -> int | float:
    number = float(value)
    return int(number) if number.is_integer() else number


def build_edit_plan(
    project_id: str = "",
    talking_video: str = "",
    script: str = "",
    materials: list[MaterialAsset | dict[str, Any]] | None = None,
    duration: float | None = None,
    aspect_ratio: str = "9:16",
    title: str | None = None,
    cta: str | None = None,
) -> dict[str, Any]:
    warnings: list[str] = []
    script_text = str(script or "").strip()
    duration_target: int | float = 0
    if duration:
        duration_number = float(duration)
        if duration_number > 0:
            duration_target = _duration_target_value(duration_number)

    assets = normalize_materials(list(materials or []))
    if not assets:
        warnings.append("缺少可用素材，B-roll 插入位将保持为空。")

    if script_text:
        segments = segment_script(script_text, float(duration_target) if duration_target else None)
        if not duration_target and segments:
            duration_target = _duration_target_value(float(segments[-1]["end"]))
        script_source = "user-script"
    else:
        warnings.append("缺少口播脚本，已生成占位剪辑方案。")
        duration_target = duration_target or 15
        segments = [
            {
                "id": "seg-001",
                "start": 0.0,
                "end": float(duration_target),
                "text": "补充口播脚本后重新生成剪辑方案。",
                "intent": "转化引导",
                "keywords": ["脚本"],
                "brollSlots": [],
            }
        ]
        script_source = "missing"

    used_asset_ids: set[str] = set()
    if assets and script_text:
        for segment in segments:
            slots = match_materials_for_segment(segment, assets)
            segment["brollSlots"] = slots
            used_asset_ids.update(slot["assetId"] for slot in slots)

        unmatched = [asset.name for asset in assets if asset.id not in used_asset_ids]
        if unmatched:
            warnings.append(f"以下素材未匹配到脚本关键词：{'、'.join(unmatched)}")

    plan_title = str(title or "").strip() or infer_title(script_text)
    return {
        "projectId": safe_project_id(project_id),
        "sourceTalkingVideo": talking_video,
        "aspectRatio": aspect_ratio,
        "durationTarget": duration_target,
        "scriptSource": script_source,
        "materials": [asdict(asset) for asset in assets],
        "segments": segments,
        "captions": {"style": "bold-bottom", "highlightKeywords": True},
        "overlays": {"title": plan_title, "cta": cta or "预约到店看样", "progressBar": True},
        "audio": {"bgm": "light-commercial", "ducking": True, "soundEffects": ["whoosh-soft"]},
        "cover": {"text": plan_title, "frameAt": 1.2},
        "render": {"output": "renders/final.mp4", "status": "draft"},
        "warnings": warnings,
    }


def save_edit_plan(plan: dict[str, Any], path: Path) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
