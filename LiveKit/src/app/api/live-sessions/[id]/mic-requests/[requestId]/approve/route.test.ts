import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppStore } from "@/lib/domain";
import { createDemoStore } from "@/lib/store";
import { setStoreRepository, type StoreRepository } from "@/lib/store-repository";

const { requireAuthMock } = vi.hoisted(() => ({ requireAuthMock: vi.fn() }));

vi.mock("@/lib/auth-helpers", () => ({ requireAuth: requireAuthMock }));

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

function addMicRequest(store: AppStore) {
  store.participants.push({
    id: "participant-host-approval",
    liveId: "demo-live",
    userId: "audience-host-approval",
    livekitIdentity: "private-demo-live-audience-host-approval",
    role: "audience",
    joinTime: "2026-08-08T00:00:00.000Z",
    watchDuration: 0,
    isMuted: false,
    isBanned: false,
    canPublish: false,
  });
  store.micRequests.push({
    id: "mic-host-approval",
    liveId: "demo-live",
    userId: "audience-host-approval",
    status: "applied",
    reason: "申请连麦",
    createdAt: "2026-08-08T00:00:00.000Z",
  });
}

describe("host mic approval API", () => {
  afterEach(() => {
    delete (globalThis as typeof globalThis & { __wechatLiveStore?: AppStore }).__wechatLiveStore;
    setStoreRepository(undefined);
    requireAuthMock.mockReset();
  });

  it("allows the assigned host to approve a mic request", async () => {
    const store = createDemoStore();
    addMicRequest(store);
    useInMemoryStore(store);
    requireAuthMock.mockResolvedValue({ userId: "host-1", role: "host", userName: "主播" });

    const response = await POST(new Request("http://local.test"), {
      params: Promise.resolve({ id: "demo-live", requestId: "mic-host-approval" }),
    });
    const payload = await response.json();

    expect(payload.ok).toBe(true);
    expect(payload.data.status).toBe("approved");
  });

  it("rejects a host who is not assigned to the room", async () => {
    const store = createDemoStore();
    addMicRequest(store);
    useInMemoryStore(store);
    requireAuthMock.mockResolvedValue({ userId: "host-other", role: "host", userName: "其他主播" });

    const response = await POST(new Request("http://local.test"), {
      params: Promise.resolve({ id: "demo-live", requestId: "mic-host-approval" }),
    });
    const payload = await response.json();

    expect(payload.ok).toBe(false);
    expect(payload.error).toBe("AUTH_INSUFFICIENT_ROLE");
    expect(store.micRequests[0].status).toBe("applied");
  });
});
