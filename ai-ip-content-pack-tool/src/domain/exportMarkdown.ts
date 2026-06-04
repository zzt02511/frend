import type { ClientProfile, WeeklyContentPack } from "./types";

export function exportWeeklyPackToMarkdown(
  client: ClientProfile,
  pack: WeeklyContentPack
): string {
  const sections = pack.items.map((item, index) => {
    const warnings =
      item.warnings.length > 0 ? `\n**注意：** ${item.warnings.join("；")}\n` : "";

    return [
      `## ${index + 1}. ${item.title}`,
      "",
      `**内容类型：** ${item.templateName}`,
      "",
      `**成交意图：** ${item.conversionIntent}`,
      "",
      `**封面文案：** ${item.coverCopy}`,
      "",
      "### 口播稿",
      item.script,
      "",
      "### 镜头清单",
      ...item.storyboard.map((shot) => `- ${shot}`),
      "",
      "### 素材需求",
      ...item.assetNeeds.map((need) => `- ${need}`),
      "",
      "### 剪辑指令",
      item.editingInstructions,
      warnings
    ].join("\n");
  });

  return [
    `# ${client.brandName} 一周内容包`,
    "",
    `**目标客户：** ${client.targetAudience}`,
    "",
    `**成交目标：** ${client.conversionGoal}`,
    "",
    `**账号语气：** ${client.accountTone}`,
    "",
    ...sections
  ].join("\n");
}
