import { exportWeeklyPackToMarkdown } from "../domain/exportMarkdown";
import { generateWeeklyContentPack } from "../domain/generator";
import { sampleAssets, sampleClient } from "../domain/sampleData";
import { contentTemplates } from "../domain/templates";

describe("exportWeeklyPackToMarkdown", () => {
  it("exports a customer-readable weekly content pack", () => {
    const pack = generateWeeklyContentPack(sampleClient, sampleAssets, contentTemplates);
    const markdown = exportWeeklyPackToMarkdown(sampleClient, pack);

    expect(markdown).toContain("# 龙居门业 一周内容包");
    expect(markdown).toContain("## 1.");
    expect(markdown).toContain("成交意图");
    expect(markdown).toContain("剪辑指令");
  });
});
