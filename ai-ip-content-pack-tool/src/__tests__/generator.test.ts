import { sampleAssets, sampleClient } from "../domain/sampleData";
import { contentTemplates } from "../domain/templates";

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
