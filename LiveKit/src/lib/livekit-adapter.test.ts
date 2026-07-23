import { afterEach, describe, expect, it, vi } from "vitest";
import { createLiveKitToken } from "./livekit-adapter";

describe("livekit adapter", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects development LiveKit credentials in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LIVEKIT_API_KEY", "");
    vi.stubEnv("LIVEKIT_API_SECRET", "");

    await expect(
      createLiveKitToken({
        identity: "private-demo-live-host-1",
        roomName: "private-demo-live",
        role: "host",
      }),
    ).rejects.toThrow("LIVEKIT_PRODUCTION_SECRET_REQUIRED");
  });
});
