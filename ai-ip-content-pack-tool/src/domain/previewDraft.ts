import type { Asset, WeeklyContentPack } from "./types";

export function createDraftInstructions(pack: WeeklyContentPack, assets: Asset[]): string[] {
  const readyItems = pack.items.filter((item) => item.status === "ready").slice(0, 3);

  return readyItems.map((item, index) => {
    const matchedAssets = assets
      .filter((asset) => asset.usableScenes.includes(item.type))
      .slice(0, 3)
      .map((asset) => asset.filePath);

    return [
      `Draft ${index + 1}: ${item.title}`,
      "目标：生成 HyperFrames 1080x1920 竖屏预览。",
      `镜头顺序：${item.storyboard.join(" -> ")}`,
      `素材：${matchedAssets.join("、") || "需要补充素材"}`,
      `剪辑指令：${item.editingInstructions}`
    ].join("\n");
  });
}
