import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppStore } from "@/lib/domain";
import { createDemoStore } from "@/lib/store";
import { setStoreRepository, type StoreRepository } from "@/lib/store-repository";
import { POST } from "./route";

const requireAuthMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-helpers", () => ({ requireAuth: requireAuthMock }));

function useInMemoryStore(store: AppStore) {
  const repository: StoreRepository = {
    load: () => store,
    save: vi.fn(),
    mutate: (mutator) => mutator(store),
  };
  (globalThis as typeof globalThis & { __wechatLiveStore?: AppStore }).__wechatLiveStore = store;
  setStoreRepository(repository);
}

describe("live token room access", () => {
  afterEach(() => {
    delete (globalThis as typeof globalThis & { __wechatLiveStore?: AppStore }).__wechatLiveStore;
    setStoreRepository(undefined);
  });

  it("rejects a password room when the viewer has no room cookie", async () => {
    const store = createDemoStore();
    store.liveSessions[0].accessPassword = "sale-2026";
    useInMemoryStore(store);

    const response = await POST(
      new Request("http://local.test/api/live-sessions/demo-live/token", {
        method: "POST",
        body: JSON.stringify({ userId: "viewer-1", role: "audience" }),
      }),
      { params: Promise.resolve({ id: "demo-live" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "ROOM_ACCESS_REQUIRED" });
    expect(store.participants).toHaveLength(0);
  });

  it("rejects a forged staff identity", async () => {
    const store = createDemoStore();
    useInMemoryStore(store);
    requireAuthMock.mockResolvedValue({ userId: "host-1", role: "host", userName: "Host" });

    const response = await POST(
      new Request("http://local.test/api/live-sessions/demo-live/token", {
        method: "POST",
        body: JSON.stringify({ userId: "moderator-1", role: "moderator" }),
      }),
      { params: Promise.resolve({ id: "demo-live" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "AUTH_IDENTITY_MISMATCH" });
  });
});
