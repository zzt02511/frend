import { afterEach, expect, it, vi } from "vitest";
import type { AppStore } from "@/lib/domain";
import { encryptRoomPassword } from "@/lib/room-password";
import { createDemoStore } from "@/lib/store";
import { setStoreRepository, type StoreRepository } from "@/lib/store-repository";

const { requireAuthMock } = vi.hoisted(() => ({ requireAuthMock: vi.fn() }));
vi.mock("@/lib/auth-helpers", () => ({ requireAuth: requireAuthMock }));

import { GET } from "./route";

function useInMemoryStore(store: AppStore) {
  const repository: StoreRepository = {
    load: () => store,
    save: vi.fn(),
    mutate: (mutator) => mutator(store),
  };
  (globalThis as typeof globalThis & { __wechatLiveStore?: AppStore }).__wechatLiveStore = store;
  setStoreRepository(repository);
}

afterEach(() => {
  delete (globalThis as typeof globalThis & { __wechatLiveStore?: AppStore }).__wechatLiveStore;
  setStoreRepository(undefined);
  requireAuthMock.mockReset();
  vi.unstubAllEnvs();
});

it("returns the decrypted password only to an authorized manager", async () => {
  const key = Buffer.alloc(32, 8).toString("base64");
  vi.stubEnv("ROOM_PASSWORD_ENCRYPTION_KEY", key);
  const store = createDemoStore();
  store.liveSessions[0].accessPasswordCiphertext = encryptRoomPassword("sale-2026", key);
  useInMemoryStore(store);
  requireAuthMock.mockResolvedValue({ userId: "moderator-1", role: "moderator", userName: "直播场控" });

  const response = await GET(new Request("http://local.test/manage"), {
    params: Promise.resolve({ id: "demo-live" }),
  });
  const payload = await response.json();

  expect(response.status).toBe(200);
  expect(payload.data.accessPassword).toBe("sale-2026");
  expect(payload.data).not.toHaveProperty("accessPasswordCiphertext");
});
