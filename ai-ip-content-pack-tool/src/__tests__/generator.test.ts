import { sampleAssets, sampleClient } from "../domain/sampleData";
import { generateWeeklyContentPack } from "../domain/generator";
import { contentTemplates } from "../domain/templates";
import type { Asset } from "../domain/types";

describe("domain fixtures", () => {
  it("loads a door-industry client profile", () => {
    expect(sampleClient.brandName).toBe("龙居门业");
    expect(sampleClient.conversionGoal).toBe("代运营交付");
    expect(sampleClient.productLines).toContain("入户门");
  });

  it("defines the five approved content templates", () => {
    expect(contentTemplates.map((template) => template.type)).toEqual([
      "product-intro",
      "buying-guide",
      "founder-trust",
      "installation-case",
      "factory-strength"
    ]);
  });

  it("includes enough sample assets to generate a weekly pack", () => {
    expect(sampleAssets.length).toBeGreaterThanOrEqual(10);
    expect(sampleAssets.some((asset) => asset.type === "product-image")).toBe(true);
    expect(sampleAssets.some((asset) => asset.type === "factory")).toBe(true);
  });
});

describe("generateWeeklyContentPack", () => {
  it("generates seven content items with the approved template mix", () => {
    const pack = generateWeeklyContentPack(sampleClient, sampleAssets, contentTemplates);

    expect(pack.items).toHaveLength(7);
    expect(pack.items.map((item) => item.type)).toEqual([
      "product-intro",
      "product-intro",
      "buying-guide",
      "buying-guide",
      "founder-trust",
      "installation-case",
      "factory-strength"
    ]);
    expect(pack.status).toBe("generated");
  });

  it("does not fabricate installation content when installation assets are missing", () => {
    const assetsWithoutCases: Asset[] = sampleAssets.filter(
      (asset) => asset.type !== "installation-case"
    );

    const pack = generateWeeklyContentPack(sampleClient, assetsWithoutCases, contentTemplates);
    const installationItem = pack.items.find((item) => item.type === "installation-case");

    expect(installationItem).toBeDefined();
    expect(installationItem?.status).toBe("needs-assets");
    expect(installationItem?.warnings).toContain("缺少安装案例素材，不能生成真实客户案例。");
    expect(installationItem?.script).not.toContain("真实客户已经安装");
  });

  it("marks parameter-dependent scripts when product parameters are missing", () => {
    const assetsWithoutParams: Asset[] = sampleAssets.filter(
      (asset) => asset.type !== "product-parameter"
    );

    const pack = generateWeeklyContentPack(sampleClient, assetsWithoutParams, contentTemplates);
    const productItems = pack.items.filter((item) => item.type === "product-intro");

    expect(productItems[0].warnings).toContain("缺少产品参数，脚本只使用视觉特征，不编造门厚、材质或锁具参数。");
  });
});
