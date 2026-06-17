import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDemoStore } from "./store";
import { loadStoreFromFile, saveStoreToFile } from "./store-persistence";

const tempDirs: string[] = [];

describe("store persistence", () => {
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("loads a saved live session and share attribution record from disk", () => {
    const dir = mkdtempSync(join(tmpdir(), "wechat-live-store-"));
    tempDirs.push(dir);
    const filePath = join(dir, "app-store.json");
    const store = createDemoStore();
    store.liveSessions.push({
      ...store.liveSessions[0],
      id: "persisted-live",
      title: "持久化测试直播",
      roomName: "private-persisted-live",
    });
    store.shareVisits.push({
      id: "share-persisted",
      liveId: "persisted-live",
      viewerId: "viewer-1",
      source: "wechat",
      sharedBy: "moderator-1",
      createdAt: "2026-06-15T00:00:00.000Z",
    });
    store.customerFollowUps.push({
      liveId: "persisted-live",
      customerId: "viewer-1",
      wecomStatus: "added",
      leadStage: "converted",
      followUpOwnerId: "moderator-1",
      followUpStatus: "pending",
      followUpNote: "直播后继续报价",
      updatedAt: "2026-06-15T00:10:00.000Z",
    });

    saveStoreToFile(store, filePath);
    const loaded = loadStoreFromFile(filePath);

    expect(loaded.liveSessions.some((item) => item.id === "persisted-live")).toBe(true);
    expect(loaded.shareVisits.some((item) => item.id === "share-persisted")).toBe(true);
    expect(loaded.customerFollowUps.some((item) => item.customerId === "viewer-1")).toBe(true);
  });
});
