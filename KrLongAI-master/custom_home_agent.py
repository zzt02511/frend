#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Custom home local lead-generation script agent.

This module stays dependency-free so the MVP can run even when the full
KrLongAI digital-human resource package has not been restored.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable


CONTENT_PILLARS = {
    "avoid_pitfalls": {
        "name": "装修避坑",
        "hook": "{city}{district}准备做{cabinet_type}的业主，先别急着交定金。",
        "cta": "评论区打“避坑”，发你一份{cabinet_type}验收清单。",
    },
    "case_story": {
        "name": "案例讲解",
        "hook": "这套{community}{area}平的{style}案例，最值钱的不是柜子多。",
        "cta": "私信“小区名”，帮你看同户型能不能这样做。",
    },
    "price_explainer": {
        "name": "价格解释",
        "hook": "为什么同样是{cabinet_type}，有的报价会差出一大截？",
        "cta": "评论区打“报价”，发你一份透明报价拆解表。",
    },
    "craft_showcase": {
        "name": "工艺展示",
        "hook": "看{cabinet_type}别只看效果图，真正决定耐不耐用的是这些细节。",
        "cta": "私信“工艺”，预约到店看样板和安装细节。",
    },
    "local_trust": {
        "name": "本地信任",
        "hook": "如果你也在{city}{district}装修，建议先看完这个本地案例。",
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
    selling_points: str = "本地量尺、真实案例、透明报价、安装售后可追踪"
    promotion: str = "到店领取户型规划建议"
    address: str = "本地门店"
    contact: str = "私信预约"
    benchmark_copy: str = ""
    material_notes: str = ""
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
    storyboard: list[str]
    llm_prompt: str
    score: int
    rewritten_script: str
    xiaohongshu_note: str
    xiaohongshu_video_plan: list[str]


def _clean(value: str, fallback: str) -> str:
    text = str(value or "").strip()
    return text if text else fallback


def _split_points(value: str) -> list[str]:
    normalized = str(value or "").replace("；", "、").replace("，", "、").replace(",", "、")
    parts = [item.strip() for item in normalized.split("、") if item.strip()]
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
        notes.append("避免使用绝对化或最高级表达，建议改成可验证事实。")
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
            f"很多客户到店第一句话就是：{pain}。\n"
            f"这个案例我们先看户型和生活习惯，再定{case.cabinet_type}方案，"
            f"不是一上来就堆柜子、压价格。\n"
            f"{detail_line}\n"
            f"如果你家也是{case.room_type}，预算表达是{case.budget}，"
            f"建议先做一次方案拆解。{_format(pillar['cta'], case)}"
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
        storyboard = build_storyboard(key, case, pain)
        llm_prompt = build_llm_prompt(case, pillar["name"], script, titles, cover)
        score = score_output(script, titles, comment_prompt, notes)
        rewritten_script = rewrite_script(script, case, pillar["name"])
        xiaohongshu_note = build_xiaohongshu_note(case, pillar["name"], script, titles, cover, comment_prompt)
        xiaohongshu_video_plan = build_xiaohongshu_video_plan(key, case, pain)
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
                storyboard=storyboard,
                llm_prompt=llm_prompt,
                score=score,
                rewritten_script=rewritten_script,
                xiaohongshu_note=xiaohongshu_note,
                xiaohongshu_video_plan=xiaohongshu_video_plan,
            )
        )
    return outputs


def rewrite_script(script: str, case: CaseInput, pillar: str) -> str:
    text = script.strip()
    replacements = {
        "很多客户到店第一句话就是：": "我们最近接待同城业主时，听到最多的问题是：",
        "这个案例我们先看户型和生活习惯": "这类非标定制不能先套模板，要先看户型、动线和一家人的生活习惯",
        "不是一上来就堆柜子、压价格": "柜子不是越多越好，价格也不能只看一个总数",
        "建议先做一次方案拆解": "建议先做一次免费的需求和报价拆解",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)

    intro = f"我是{case.store_name}的定制顾问，今天用一个{case.city}{case.district}的真实场景讲清楚。"
    if not text.startswith("我是"):
        text = f"{intro}\n{text}"

    if pillar == "价格解释":
        text += "\n记住一句话：定制柜不要只比总价，要把板材、五金、封边、抽屉和售后逐项看明白。"
    elif pillar == "工艺展示":
        text += "\n到店看样板时，别只看颜色和造型，一定要让门店把切面、封边和五金型号拿出来看。"
    elif pillar == "本地信任":
        text += "\n同城门店最大的价值，是量尺、复尺、安装和售后都能找到具体负责人。"

    return text


def build_storyboard(key: str, case: CaseInput, pain: str) -> list[str]:
    opening = f"0-3秒：门店实拍或顾问口播开场，屏幕大字“{case.city}{case.district}{case.cabinet_type}”。"
    if key == "avoid_pitfalls":
        middle = "3-15秒：切板材、五金、封边、安装收口特写，字幕标出“合同写清楚 / 型号看得见 / 样板可验证”。"
    elif key == "case_story":
        middle = f"3-25秒：展示{case.community}户型图、完工图、柜体打开细节，突出“{pain}”的解决前后对比。"
    elif key == "price_explainer":
        middle = "3-18秒：用报价单局部、板材样块、抽屉五金和见光面细节解释价格差异。"
    elif key == "craft_showcase":
        middle = "3-28秒：连续展示切面、封边、铰链、轨道、安装现场和售后回访画面。"
    else:
        middle = "3-25秒：插入同城小区外景、门店门头、量尺现场、安装现场，强化本地可信度。"
    ending = f"最后5秒：显示门店名“{case.store_name}”、引导语“{case.contact}”，保留评论关键词。"
    return [opening, middle, ending]


def build_llm_prompt(case: CaseInput, pillar: str, script: str, titles: list[str], cover: str) -> str:
    context_lines = [
        "行业：非标定制家居",
        f"城市区域：{case.city}{case.district}",
        f"门店：{case.store_name}",
        f"案例：{case.community}，{case.room_type}，{case.area}平，{case.style}",
        f"柜类：{case.cabinet_type}",
        f"板材/五金/工艺：{case.board}，{case.hardware}，{case.edge_banding}",
    ]
    optional_fields = [
        ("业主痛点", case.pain_points),
        ("门店卖点", case.selling_points),
        ("预算/报价表达", case.budget),
        ("活动引导", case.promotion),
        ("门店地址", case.address),
        ("联系方式", case.contact),
        ("真实素材", case.material_notes),
        ("对标参考文案", case.benchmark_copy),
    ]
    for label, value in optional_fields:
        if str(value or "").strip():
            context_lines.append(f"{label}：{str(value).strip()}")

    return (
        "你是非标定制家居短视频编导。请在不虚构案例、不夸大环保和价格承诺的前提下，"
        "把下面内容改写成更像本地门店老板/设计师口吻的短视频脚本。\n\n"
        f"{chr(10).join(context_lines)}\n"
        f"内容栏目：{pillar}\n"
        f"原脚本：{script}\n"
        f"标题候选：{' / '.join(titles)}\n"
        f"封面文案：{cover}\n\n"
        "输出 JSON，字段为 script、titles、cover、comment_prompt、dm_keyword、risk_notes。"
    )


def build_xiaohongshu_note(
    case: CaseInput,
    pillar: str,
    script: str,
    titles: list[str],
    cover: str,
    comment_prompt: str,
) -> str:
    materials = _clean(case.material_notes, "完工图、柜体细节、板材/五金特写、门店量尺或安装现场")
    tags = _safe_join(dict.fromkeys([f"#{case.city}装修", f"#{case.cabinet_type}", "#全屋定制", "#装修避坑", "#小红书家居"]).keys(), 8)
    return (
        f"标题：{titles[0]}\n\n"
        f"封面字：{cover}\n\n"
        f"正文：\n"
        f"{case.city}{case.district}准备做{case.cabinet_type}的朋友，可以先收藏这条。\n"
        f"这条内容来自{case.store_name}的一个{case.community}{case.area}平案例，重点想讲清楚：{pillar}。\n\n"
        f"真实素材建议：{materials}。\n\n"
        f"口播/配文重点：\n{script}\n\n"
        f"互动引导：{comment_prompt}\n\n"
        f"话题：{tags.replace('、', ' ')}"
    )


def build_xiaohongshu_video_plan(key: str, case: CaseInput, pain: str) -> list[str]:
    materials = _clean(case.material_notes, "真实完工图、施工视频、柜体开合细节、门店/工厂素材")
    opening = f"封面/前2秒：用真实素材中最清楚的一张图或视频帧，叠字“{case.community}{case.cabinet_type}”。"
    if key == "avoid_pitfalls":
        middle = f"中段：依次穿插{materials}，每个镜头只讲一个避坑点，字幕突出合同、型号、封边、安装。"
    elif key == "case_story":
        middle = f"中段：先放户型或空间全景，再放柜体打开细节，用素材证明如何解决“{pain}”。"
    elif key == "price_explainer":
        middle = f"中段：用报价单局部、板材样块、五金特写和现场视频解释价格差，不展示客户隐私。"
    elif key == "craft_showcase":
        middle = f"中段：多用近景和慢镜头展示{case.board}、{case.hardware}、{case.edge_banding}，少用空泛效果图。"
    else:
        middle = f"中段：穿插小区外景、门店门头、量尺/安装视频，证明这是{case.city}{case.district}本地服务。"
    ending = f"结尾3秒：放门店名“{case.store_name}”和引导“{case.contact}”，保留私信关键词。"
    return [opening, middle, ending]


def score_output(script: str, titles: list[str], comment_prompt: str, notes: list[str]) -> int:
    score = 60
    if any(word in script for word in ("本地", "同城", "小区", "量尺")):
        score += 10
    if any(word in script for word in ("避坑", "报价", "工艺", "收纳", "安装", "售后")):
        score += 10
    if comment_prompt and any(word in comment_prompt for word in ("评论区", "私信", "预约")):
        score += 10
    if len(titles) >= 3:
        score += 5
    score -= min(25, len(notes) * 8)
    return max(0, min(100, score))


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
            "报价差通常不只差在板材，还差在五金、封边、见光面、抽屉数量和售后标准。"
            f"我们会把{point}拆开给你看。"
        )
    if key == "craft_showcase":
        return (
            "到店不要只看展厅成品，要看切面、封边、铰链、抽屉轨道和安装现场，"
            "这些才决定后面几年好不好用。"
        )
    return (
        f"{case.store_name}服务{case.city}{case.district}本地客户，量尺、复尺、安装、售后都能追踪，"
        "不是外地团队做完就走。"
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
            "别只比总价，定制柜报价要看这些项",
            f"{city}业主看报价前先懂这几点",
        ]
    if key == "craft_showcase":
        return [
            f"{case.cabinet_type}耐不耐用，看这几个工艺",
            "别只看效果图，定制柜细节更重要",
            f"{case.board}+{case.hardware}到底怎么选？",
        ]
    return [
        f"{city}装修，先找同小区案例",
        f"本地{case.cabinet_type}门店怎么选？",
        "到店前先准备这份户型需求清单",
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
                "**口播脚本**",
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
                "**剪辑分镜**",
                "",
                *(f"- {shot}" for shot in item.storyboard),
                "",
                f"**内容评分**：{item.score}/100",
                "",
                "**一键改写稿**",
                "",
                item.rewritten_script,
                "",
                "**LLM二次改写提示词**",
                "",
                "```text",
                item.llm_prompt,
                "```",
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
