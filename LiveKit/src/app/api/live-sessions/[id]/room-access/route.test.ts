import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppStore } from "@/lib/domain";
import { encryptRoomPassword } from "@/lib/room-password";
import { createDemoStore } from "@/lib/store";
import { setStoreRepository, type StoreRepository } from "@/lib/store-repository";
import { POST } from "./route";

const encryptionKey = Buffer.alloc(32, 5).toString("base64");

function useInMemoryStore(store: AppStore) {
  const repository: StoreRepository = {
    load: () => store,
    save: vi.fn(),
    mutate: (mutator) => mutator(store),
  };
  (globalThis as typeof globalThis & { __wechatLiveStore?: AppStore }).__wechatLiveStore = store;
  setStoreRepository(repository);
}

describe("room access API", () => {
  afterEach(() => {
    delete (globalThis as typeof globalThis & { __wechatLiveStore?: AppStore }).__wechatLiveStore;
    setStoreRepository(undefined);
    vi.unstubAllEnvs();
  });

  it("sets an HttpOnly room cookie after the correct password", async () => {
    vi.stubEnv("AUTH_SECRET", "test-auth-secret-that-is-long-enough");
    vi.stubEnv("ROOM_PASSWORD_ENCRYPTION_KEY", encryptionKey);
    vi.stubEnv("NODE_ENV", "development");
    const store = createDemoStore();
    store.liveSessions[0].accessPasswordCiphertext = encryptRoomPassword("sale-2026", encryptionKey);
    store.liveSessions[0].accessPasswordVersion = 2;
    useInMemoryStore(store);

    const response = await POST(
      new Request("http://local.test/api/live-sessions/demo-live/room-access", {
        method: "POST",
        body: JSON.stringify({ viewerId: "viewer-1", password: "sale-2026" }),
      }),
      { params: Promise.resolve({ id: "demo-live" }) },
    );
    const payload = await response.json();
    const cookie = response.headers.get("set-cookie");

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true, data: { verified: true } });
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("sale-2026");
  });

  it("rejects a wrong password without setting a cookie", async () => {
    vi.stubEnv("AUTH_SECRET", "test-auth-secret-that-is-long-enough");
    vi.stubEnv("ROOM_PASSWORD_ENCRYPTION_KEY", encryptionKey);
    const store = createDemoStore();
    store.liveSessions[0].accessPasswordCiphertext = encryptRoomPassword("sale-2026", encryptionKey);
    useInMemoryStore(store);

    const response = await POST(
      new Request("http://local.test/api/live-sessions/demo-live/room-access", {
        method: "POST",
        body: JSON.stringify({ viewerId: "viewer-1", password: "wrong" }),
      }),
      { params: Promise.resolve({ id: "demo-live" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "ACCESS_PASSWORD_INCORRECT" });
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
