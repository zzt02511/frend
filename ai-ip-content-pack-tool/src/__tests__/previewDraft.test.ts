import { createDraftInstructions } from "../domain/previewDraft";
import { generateWeeklyContentPack } from "../domain/generator";
import { sampleAssets, sampleClient } from "../domain/sampleData";
import { contentTemplates } from "../domain/templates";

describe("createDraftInstructions", () => {
  it("creates preview instructions for the first three ready items", () => {
    const pack = generateWeeklyContentPack(sampleClient, sampleAssets, contentTemplates);
    const drafts = createDraftInstructions(pack, sampleAssets);

    expect(drafts).toHaveLength(3);
    expect(drafts[0]).toContain("HyperFrames");
    expect(drafts[0]).toContain("1080x1920");
    expect(drafts[0]).toContain("镜头顺序");
  });
});
