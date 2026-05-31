#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Custom home local lead-generation script agent.

This module is intentionally dependency-free so it can run before the full
KrLongAI resource package is restored. It turns non-standard custom home case
inputs into short-video scripts, titles, cover copy, comment prompts, and
private-message keywords.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Callable, Iterable


CONTENT_PILLARS = {
    "avoid_pitfalls": {
        "name": "装修避坑",
        "hook": "{city}{district}准备做{cabinet_type}的业主，先别急着交定金。",
        "angle": "把容易踩坑的地方讲清楚，降低业主决策焦虑。",
        "cta": "评论区打“避坑”，发你一份{cabinet_type}验收清单。",
    },
    "case_story": {
        "name": "案例讲解",
        "hook": "这套{community}{area}平的{style}案例，最值钱的不是柜子多。",
        "angle": "用真实户型和生活动线建立信任。",
        "cta": "私信“小区名”，帮你看同户型能不能这样做。",
    },
    "price_explainer": {
        "name": "价格解释",
        "hook": "为什么同样是{cabinet_type}，有的报价差出一大截？",
        "angle": "解释报价差异，不打低价战。",
        "cta": "评论区打“报价”，发你一份透明报价拆解表。",
    },
    "craft_showcase": {
        "name": "工艺展示",
        "hook": "看{cabinet_type}别只看效果图，真正决定耐不耐用的是这些细节。",
        "angle": "展示板材、五金、封边、安装和售后能力。",
        "cta": "私信“工艺”，预约到店看样板和安装细节。",
    },
    "local_trust": {
        "name": "本地信任",
        "hook": "如果你也在{city}{district}装修，建议先看完这个本地案例。",
        "angle": "强调同城服务、量尺流程和售后响应。",
        "cta": "评论区留“小区”，我们帮你匹配附近案例。",
    },
}

RISKY_CLAIMS = (
    "0甲醛",
    "零甲醛",
    "绝对环保",
    "100%环保",
    "最低价",
    "全网最低",
    "保证成交",
    "稳赚",
    "省一半",
    "省50%",
    "免费送",
    "虚假房源",
)


@dataclass
class CaseInput:
    city: str = "本地"
    district: str = ""
    store_name: str = "本地定制家居门店"
    community: str = "同城小区"
    room_type: str = "三室两厅"
    area: str = "100"
    budget: str = "按实际方案报价"
    cabinet_type: str = "全屋定制"
    board: str = "ENF级板材"
    hardware: str = "品牌五金"
    edge_banding: str = "PUR封边"
    style: str = "现代简约"
    pain_points: str = "收纳不够、动线不好、担心报价不透明"
    selling_points: str = "本地量尺、真实案例、透明报价、安装售后"
    promotion: str = "到店领取户型规划建议"
    address: str = "本地门店"
    contact: str = "私信预约"
    benchmark_copy: str = ""
    quantity: int = 10


@dataclass
class ScriptOutput:
    index: int
    pillar: str
    duration: str
    hook: str
    script: str
    titles: list[str]
    cover: str
    comment_prompt: str
    dm_keyword: str
    compliance_notes: list[str]


def _clean(value: str, fallback: str) -> str:
    text = str(value or "").strip()
    return text if text else fallback


def _split_points(value: str) -> list[str]:
    parts = []
    for chunk in value.replace("，", ",").replace("、", ",").replace("；", ",").split(","):
        item = chunk.strip()
        if item:
            parts.append(item)
    return parts or ["收纳不够", "报价不透明", "售后没保障"]


def _format(template: str, case: CaseInput) -> str:
    values = asdict(case)
    values["district"] = _clean(case.district, "")
    values["community"] = _clean(case.community, "同城小区")
    return template.format(**values)


def _safe_join(items: Iterable[str], limit: int = 3) -> str:
    return "、".join(list(items)[:limit])


def validate_copy(text: str) -> list[str]:
    notes = []
    for claim in RISKY_CLAIMS:
        if claim in text:
            notes.append(f"包含高风险表达：{claim}")
    if "最" in text and ("环保" in text or "便宜" in text or "好" in text):
        notes.append("避免使用绝对化最高级表达，建议改成可验证事实。")
    return notes


def generate_outputs(case: CaseInput) -> list[ScriptOutput]:
    pain_points = _split_points(case.pain_points)
    selling_points = _split_points(case.selling_points)
    pillars = list(CONTENT_PILLARS.items())
    outputs: list[ScriptOutput] = []

    for offset in range(max(1, case.quantity)):
        key, pillar = pillars[offset % len(pillars)]
        hook = _format(pillar["hook"], case)
        pain = pain_points[offset % len(pain_points)]
        point = selling_points[offset % len(selling_points)]
        duration = "15-25秒" if key in {"avoid_pitfalls", "price_explainer"} else "25-45秒"
        detail_line = _detail_line(key, case, pain, point)
        script = (
            f"{hook}\n"
            f"很多客户来店里第一句话就是：{pain}。\n"
            f"这个案例我们先看户型和生活习惯，再定{case.cabinet_type}方案，"
            f"不是一上来就堆柜子、压价格。\n"
            f"{detail_line}\n"
            f"如果你家也是{case.room_type}，预算是{case.budget}，建议先做一次方案拆解。"
            f"{_format(pillar['cta'], case)}"
        )
        titles = _titles(key, case, pain)
        cover = _cover_line(key, case, pain)
        comment_prompt = _format(pillar["cta"], case)
        dm_keyword = {
            "avoid_pitfalls": "避坑",
            "case_story": "小区名",
            "price_explainer": "报价",
            "craft_showcase": "工艺",
            "local_trust": "小区",
        }[key]
        notes = validate_copy("\n".join([script, *titles, cover, comment_prompt]))
        outputs.append(
            ScriptOutput(
                index=offset + 1,
                pillar=pillar["name"],
                duration=duration,
                hook=hook,
                script=script,
                titles=titles,
                cover=cover,
                comment_prompt=comment_prompt,
                dm_keyword=dm_keyword,
                compliance_notes=notes,
            )
        )
    return outputs


def _detail_line(key: str, case: CaseInput, pain: str, point: str) -> str:
    if key == "avoid_pitfalls":
        return (
            f"重点看三件事：{case.board}是否写进合同，{case.hardware}是否有型号，"
            f"{case.edge_banding}和安装收口有没有样板可看。"
        )
    if key == "case_story":
        return (
            f"这套{case.area}平的核心处理，是围绕{pain}重新分配柜体比例，"
            f"让{case.style}效果和日常收纳都能落地。"
        )
    if key == "price_explainer":
        return (
            f"报价差通常不只差在板材，还差在五金、封边、见光面、抽屉数量和售后标准。"
            f"我们会把{point}拆开给你看。"
        )
    if key == "craft_showcase":
        return (
            f"你到店不要只看展厅成品，要看切面、封边、铰链、抽屉轨道和安装现场，"
            f"这些才决定后面几年好不好用。"
        )
    return (
        f"{case.store_name}服务{case.city}{case.district}本地客户，量尺、复尺、安装、售后都能追踪，"
        f"不是外地团队做完就走。"
    )


def _titles(key: str, case: CaseInput, pain: str) -> list[str]:
    city = f"{case.city}{case.district}"
    if key == "avoid_pitfalls":
        return [
            f"{city}做{case.cabinet_type}，这3个坑先避开",
            f"{case.cabinet_type}别急着交定金，先看这些细节",
            f"业主最容易忽略的{case.cabinet_type}验收点",
        ]
    if key == "case_story":
        return [
            f"{case.community}{case.area}平{case.style}定制案例",
            f"{case.room_type}收纳不够？这个案例可以参考",
            f"同城业主的{case.cabinet_type}方案复盘",
        ]
    if key == "price_explainer":
        return [
            f"{case.cabinet_type}报价为什么差这么多？",
            f"别只比总价，定制柜报价要看这些项",
            f"{city}业主看报价前先懂这几个点",
        ]
    if key == "craft_showcase":
        return [
            f"{case.cabinet_type}耐不耐用，看这几个工艺",
            f"别只看效果图，定制柜细节更重要",
            f"{case.board}+{case.hardware}到底怎么选？",
        ]
    return [
        f"{city}装修，先找同小区案例",
        f"本地{case.cabinet_type}门店怎么选？",
        f"到店前先准备这份户型需求清单",
    ]


def _cover_line(key: str, case: CaseInput, pain: str) -> str:
    if key == "avoid_pitfalls":
        return f"{case.cabinet_type}避坑清单"
    if key == "case_story":
        return f"{case.community}真实案例"
    if key == "price_explainer":
        return "报价差在哪里？"
    if key == "craft_showcase":
        return "细节决定耐用"
    return f"{case.city}本地案例参考"


def outputs_to_markdown(outputs: list[ScriptOutput], case: CaseInput) -> str:
    lines = [
        f"# {case.city}{case.district}{case.cabinet_type}同城获客脚本",
        "",
        f"- 门店：{case.store_name}",
        f"- 案例：{case.community} / {case.room_type} / {case.area}平 / {case.style}",
        f"- 引导：{case.promotion} / {case.contact}",
        "",
    ]
    for item in outputs:
        notes = "；".join(item.compliance_notes) if item.compliance_notes else "未发现高风险表达"
        lines.extend(
            [
                f"## {item.index}. {item.pillar}（{item.duration}）",
                "",
                f"**口播脚本**",
                "",
                item.script,
                "",
                "**标题**",
                "",
                *(f"- {title}" for title in item.titles),
                "",
                f"**封面文案**：{item.cover}",
                "",
                f"**评论/私信引导**：{item.comment_prompt}",
                "",
                f"**私信关键词**：{item.dm_keyword}",
                "",
                f"**合规提示**：{notes}",
                "",
            ]
        )
    return "\n".join(lines)


def load_case(path: Path) -> CaseInput:
    data = json.loads(path.read_text(encoding="utf-8"))
    return CaseInput(**{key: value for key, value in data.items() if key in CaseInput.__dataclass_fields__})


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

    parser = argparse.ArgumentParser(description="Generate custom home local lead scripts.")
    parser.add_argument("--input", type=Path, help="JSON file with case fields.")
    parser.add_argument("--output", type=Path, help="Write markdown output to this file.")
    parser.add_argument("--json", action="store_true", help="Print JSON instead of markdown.")
    parser.add_argument("--quantity", type=int, help="Override script quantity.")
    args = parser.parse_args()

    case = load_case(args.input) if args.input else CaseInput()
    if args.quantity:
        case.quantity = args.quantity
    outputs = generate_outputs(case)

    if args.json:
        print(json.dumps([asdict(item) for item in outputs], ensure_ascii=False, indent=2))
        return

    markdown = outputs_to_markdown(outputs, case)
    if args.output:
        args.output.write_text(markdown, encoding="utf-8")
    else:
        print(markdown)


if __name__ == "__main__":
    main()
