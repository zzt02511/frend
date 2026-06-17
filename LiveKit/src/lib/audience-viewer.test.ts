import { describe, expect, it } from "vitest";
import { createAudienceViewerId, getOrCreateAudienceViewerId } from "./audience-viewer";

function createMemoryStorage(initial?: Record<string, string>) {
  const data = new Map(Object.entries(initial ?? {}));

  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

describe("audience viewer identity", () => {
  it("creates a non-default viewer id for a new phone browser", () => {
    const viewerId = createAudienceViewerId(() => 0.123456789, () => 1700000000000);

    expect(viewerId).toBe("wxv-loyw3v28-4fzzzxjy");
  });

  it("reuses the same generated viewer id from browser storage", () => {
    const storage = createMemoryStorage();

    const firstViewerId = getOrCreateAudienceViewerId(storage);
    const secondViewerId = getOrCreateAudienceViewerId(storage);

    expect(firstViewerId).toMatch(/^wxv-/);
    expect(secondViewerId).toBe(firstViewerId);
    expect(secondViewerId).not.toBe("audience-1");
  });

  it("does not reuse the demo audience id from shared links", () => {
    const storage = createMemoryStorage({ "wechat-live-viewer-id": "audience-1" });

    const viewerId = getOrCreateAudienceViewerId(storage, "audience-1");

    expect(viewerId).toMatch(/^wxv-/);
    expect(viewerId).not.toBe("audience-1");
  });
});
