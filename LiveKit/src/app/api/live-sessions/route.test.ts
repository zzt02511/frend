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
    vi.unstubAllEnvs();
  });

  it("encrypts a new room password and returns only the public password flag", async () => {
    const key = Buffer.alloc(32, 9).toString("base64");
    vi.stubEnv("ROOM_PASSWORD_ENCRYPTION_KEY", key);
    const store = createDemoStore();
    useInMemoryStore(store);
    requireAuthMock.mockResolvedValue({ userId: "moderator-1", role: "moderator", userName: "直播场控" });

    requireAuthMock.mockResolvedValue({ userId: "director-1", role: "director", userName: "Tenant director" });

    const response = await POST(
      new Request("http://local.test/api/live-sessions", {
        method: "POST",
        body: JSON.stringify({ title: "Password live", accessPassword: "sale-2026" }),
      }),
    );
    const payload = await response.json();
    const created = store.liveSessions[0];

    expect(response.status).toBe(201);
    expect(created.accessPassword).toBeUndefined();
    expect(created.accessPasswordCiphertext).toMatch(/^v1\./);
    expect(created.accessPasswordVersion).toBe(1);
    expect(payload.data).not.toHaveProperty("accessPassword");
    expect(payload.data).not.toHaveProperty("accessPasswordCiphertext");
    expect(payload.data.hasAccessPassword).toBe(true);
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
