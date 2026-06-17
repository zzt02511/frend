import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppStore } from "@/lib/domain";
import { createDemoStore } from "@/lib/store";
import { setStoreRepository, type StoreRepository } from "@/lib/store-repository";
import { PATCH } from "./route";

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
  });

  it("updates only editable live session fields", async () => {
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
});
