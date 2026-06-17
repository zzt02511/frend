import { describe, expect, it } from "vitest";
import { createDemoStore } from "./store";
import { buildLiveShareUrl, getShareRanking, recordShareVisit } from "./share-service";

describe("share service", () => {
  it("builds a shareable audience live room URL", () => {
    const url = buildLiveShareUrl({
      origin: "http://127.0.0.1:4017",
      liveId: "demo-live",
    });

    expect(url).toBe("http://127.0.0.1:4017/live/demo-live");
  });

  it("adds a WeChat channel source when provided", () => {
    const url = buildLiveShareUrl({
      origin: "https://live.example.com",
      liveId: "demo-live",
      source: "wechat",
    });

    expect(url).toBe("https://live.example.com/live/demo-live?source=wechat");
  });

  it("adds the sharing user identity when provided", () => {
    const url = buildLiveShareUrl({
      origin: "https://live.example.com",
      liveId: "demo-live",
      source: "wechat",
      sharedBy: "moderator-1",
    });

    expect(url).toBe("https://live.example.com/live/demo-live?source=wechat&sharedBy=moderator-1");
  });

  it("ranks viewers brought by each sharing user", () => {
    const store = createDemoStore();
    store.shareVisits = [];

    recordShareVisit(store, {
      liveId: "demo-live",
      viewerId: "customer-a",
      source: "wechat",
      sharedBy: "moderator-1",
    });
    recordShareVisit(store, {
      liveId: "demo-live",
      viewerId: "customer-b",
      source: "wechat",
      sharedBy: "moderator-1",
    });
    recordShareVisit(store, {
      liveId: "demo-live",
      viewerId: "customer-c",
      source: "wechat",
      sharedBy: "director-1",
    });

    expect(getShareRanking(store, "demo-live")).toEqual([
      { sharedBy: "moderator-1", source: "wechat", visits: 2, uniqueViewers: 2 },
      { sharedBy: "director-1", source: "wechat", visits: 1, uniqueViewers: 1 },
    ]);
  });

  it("generates an anonymous viewer id when the first visit has no viewer id", () => {
    const store = createDemoStore();
    store.shareVisits = [];

    const visit = recordShareVisit(store, {
      liveId: "demo-live",
      source: "wechat",
      sharedBy: "moderator-1",
    });

    expect(visit.viewerId).toMatch(/^anonymous-viewer-/);
    expect(visit.viewerId).not.toBe("audience-1");
  });
});
