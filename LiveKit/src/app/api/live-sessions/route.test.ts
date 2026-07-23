import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppStore } from "@/lib/domain";
import { createDemoStore } from "@/lib/store";
import { setStoreRepository, type StoreRepository } from "@/lib/store-repository";

const { requireAuthMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
}));

vi.mock("@/lib/auth-helpers", () => ({
  requireAuth: requireAuthMock,
}));

import { POST } from "./route";

function useInMemoryStore(store: AppStore) {
  const repository: StoreRepository = {
    load: () => store,
    save: vi.fn(),
    mutate: (mutator) => mutator(store),
  };
  (globalThis as typeof globalThis & { __wechatLiveStore?: AppStore }).__wechatLiveStore = store;
  setStoreRepository(repository);
}

describe("live session collection API", () => {
  afterEach(() => {
    delete (globalThis as typeof globalThis & { __wechatLiveStore?: AppStore }).__wechatLiveStore;
    setStoreRepository(undefined);
    requireAuthMock.mockReset();
  });

  it("rejects unauthenticated live creation without mutating the store", async () => {
    const store = createDemoStore();
    const before = store.liveSessions.length;
    useInMemoryStore(store);
    requireAuthMock.mockRejectedValue(new Error("AUTH_REQUIRED"));

    const response = await POST(
      new Request("http://local.test/api/live-sessions", {
        method: "POST",
        body: JSON.stringify({ title: "Protected live" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ ok: false, error: "AUTH_REQUIRED" });
    expect(store.liveSessions).toHaveLength(before);
  });
});
