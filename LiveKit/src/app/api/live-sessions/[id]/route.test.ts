import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppStore } from "@/lib/domain";
import { createDemoStore } from "@/lib/store";
import { setStoreRepository, type StoreRepository } from "@/lib/store-repository";
import { DELETE, PATCH } from "./route";

const { requireAuthMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
}));

vi.mock("@/lib/auth-helpers", () => ({
  requireAuth: requireAuthMock,
}));

function useInMemoryStore(store: AppStore) {
  const repository: StoreRepository = {
    load: () => store,
    save: vi.fn(),
    mutate: (mutator) => mutator(store),
  };
  (globalThis as typeof globalThis & { __wechatLiveStore?: AppStore }).__wechatLiveStore = store;
  setStoreRepository(repository);
}

describe("live session API", () => {
  afterEach(() => {
    delete (globalThis as typeof globalThis & { __wechatLiveStore?: AppStore }).__wechatLiveStore;
    setStoreRepository(undefined);
    requireAuthMock.mockReset();
  });

  it("updates only editable live session fields", async () => {
    requireAuthMock.mockResolvedValue({ userId: "moderator-1", role: "moderator", userName: "直播场控" });
    const store = createDemoStore();
    useInMemoryStore(store);
    const before = { ...store.liveSessions[0] };

    const response = await PATCH(
      new Request("http://local.test/api/live-sessions/demo-live", {
        method: "PATCH",
        body: JSON.stringify({
          id: "hijacked-live",
          roomName: "hijacked-room",
          status: "ended",
          hostUserId: "audience-1",
          moderatorIds: [],
          title: "Updated title",
          enableComment: false,
        }),
      }),
      { params: Promise.resolve({ id: "demo-live" }) },
    );
    const payload = await response.json();
    const live = store.liveSessions[0];

    expect(payload.ok).toBe(true);
    expect(live.title).toBe("Updated title");
    expect(live.enableComment).toBe(false);
    expect(live.id).toBe(before.id);
    expect(live.roomName).toBe(before.roomName);
    expect(live.status).toBe(before.status);
    expect(live.hostUserId).toBe(before.hostUserId);
    expect(live.moderatorIds).toEqual(before.moderatorIds);
  });

  it("rejects unauthenticated live updates without mutating the room", async () => {
    const store = createDemoStore();
    useInMemoryStore(store);
    requireAuthMock.mockRejectedValue(new Error("AUTH_REQUIRED"));

    const response = await PATCH(
      new Request("http://local.test/api/live-sessions/demo-live", {
        method: "PATCH",
        body: JSON.stringify({ title: "Unauthorized title", accessPassword: "leaked" }),
      }),
      { params: Promise.resolve({ id: "demo-live" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ ok: false, error: "AUTH_REQUIRED" });
    expect(store.liveSessions[0].title).not.toBe("Unauthorized title");
    expect(store.liveSessions[0].accessPassword).toBeUndefined();
  });

  it("deletes a live session and its related room data", async () => {
    requireAuthMock.mockResolvedValue({ userId: "moderator-1", role: "moderator", userName: "直播场控" });
    const store = createDemoStore();
    store.comments.push({
      id: "comment-delete-live",
      liveId: "demo-live",
      userId: "audience-1",
      content: "delete with room",
      status: "approved",
      isPinned: false,
      isHighValueQuestion: false,
      visibleToSender: true,
      hitSensitiveWords: [],
      createdAt: "2026-06-15T00:00:00.000Z",
    });
    store.micRequests.push({
      id: "mic-delete-live",
      liveId: "demo-live",
      userId: "audience-1",
      status: "applied",
      reason: "delete with room",
      createdAt: "2026-06-15T00:00:00.000Z",
    });
    store.participants.push({
      id: "participant-delete-live",
      liveId: "demo-live",
      userId: "audience-1",
      livekitIdentity: "private-demo-live-audience-1",
      role: "audience",
      joinTime: "2026-06-15T00:00:00.000Z",
      watchDuration: 0,
      isMuted: false,
      isBanned: false,
      canPublish: false,
    });
    useInMemoryStore(store);

    const response = await DELETE(new Request("http://local.test/api/live-sessions/demo-live", { method: "DELETE" }), {
      params: Promise.resolve({ id: "demo-live" }),
    });
    const payload = await response.json();

    expect(payload.ok).toBe(true);
    expect(store.liveSessions.some((item) => item.id === "demo-live")).toBe(false);
    expect(store.comments.some((item) => item.liveId === "demo-live")).toBe(false);
    expect(store.micRequests.some((item) => item.liveId === "demo-live")).toBe(false);
    expect(store.participants.some((item) => item.liveId === "demo-live")).toBe(false);
    expect(store.stats.some((item) => item.liveId === "demo-live")).toBe(false);
    expect(store.shareVisits.some((item) => item.liveId === "demo-live")).toBe(false);
  });

  it("does not delete a live session while it is live", async () => {
    requireAuthMock.mockResolvedValue({ userId: "moderator-1", role: "moderator", userName: "直播场控" });
    const store = createDemoStore();
    store.liveSessions[0].status = "live";
    useInMemoryStore(store);

    const response = await DELETE(new Request("http://local.test/api/live-sessions/demo-live", { method: "DELETE" }), {
      params: Promise.resolve({ id: "demo-live" }),
    });
    const payload = await response.json();

    expect(payload.ok).toBe(false);
    expect(payload.error).toBe("LIVE_SESSION_ACTIVE");
    expect(store.liveSessions.some((item) => item.id === "demo-live")).toBe(true);
  });
});
