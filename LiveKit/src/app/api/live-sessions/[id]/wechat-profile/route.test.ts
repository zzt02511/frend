import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppStore } from "@/lib/domain";
import { createDemoStore } from "@/lib/store";
import { setStoreRepository, type StoreRepository } from "@/lib/store-repository";
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

describe("WeChat profile API", () => {
  afterEach(() => {
    delete (globalThis as typeof globalThis & { __wechatLiveStore?: AppStore }).__wechatLiveStore;
    setStoreRepository(undefined);
    vi.unstubAllEnvs();
  });

  it("returns an automatic viewer nickname when WeChat OAuth is not configured", async () => {
    useInMemoryStore(createDemoStore());
    vi.stubEnv("WECHAT_OAUTH_APP_ID", "");
    vi.stubEnv("WECHAT_OAUTH_APP_SECRET", "");

    const response = await GET(
      new Request("http://local.test/api/live-sessions/demo-live/wechat-profile?viewerId=viewer-auto"),
      { params: Promise.resolve({ id: "demo-live" }) },
    );
    const payload = await response.json();

    expect(payload.ok).toBe(true);
    expect(payload.data).toEqual({
      viewerId: "viewer-auto",
      nickname: "微信观众 r-auto",
      source: "fallback",
    });
  });
});
