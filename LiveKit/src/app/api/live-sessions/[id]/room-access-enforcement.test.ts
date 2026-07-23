import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppStore } from "@/lib/domain";
import { createDemoStore } from "@/lib/store";
import { setStoreRepository, type StoreRepository } from "@/lib/store-repository";
import { POST as join } from "./join/route";
import { POST as heartbeat } from "./heartbeat/route";
import { POST as comment } from "./comments/route";
import { POST as audienceEvent } from "./audience-events/route";
import { POST as micApply } from "./mic-requests/route";

function useInMemoryStore(store: AppStore) {
  const repository: StoreRepository = {
    load: () => store,
    save: vi.fn(),
    mutate: (mutator) => mutator(store),
  };
  (globalThis as typeof globalThis & { __wechatLiveStore?: AppStore }).__wechatLiveStore = store;
  setStoreRepository(repository);
}

const cases = [
  ["join", join, { userId: "viewer-1", role: "audience" }],
  ["heartbeat", heartbeat, { userId: "viewer-1", role: "audience" }],
  ["comment", comment, { userId: "viewer-1", content: "hello" }],
  ["audience event", audienceEvent, { userId: "viewer-1", type: "like" }],
  ["mic apply", micApply, { userId: "viewer-1", reason: "question" }],
] as const;

describe("password room audience enforcement", () => {
  afterEach(() => {
    delete (globalThis as typeof globalThis & { __wechatLiveStore?: AppStore }).__wechatLiveStore;
    setStoreRepository(undefined);
  });

  it.each(cases)("rejects %s without a room cookie", async (_label, handler, body) => {
    const store = createDemoStore();
    store.liveSessions[0].accessPassword = "sale-2026";
    useInMemoryStore(store);

    const response = await handler(
      new Request("http://local.test/protected", { method: "POST", body: JSON.stringify(body) }),
      { params: Promise.resolve({ id: "demo-live" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "ROOM_ACCESS_REQUIRED" });
  });
});
