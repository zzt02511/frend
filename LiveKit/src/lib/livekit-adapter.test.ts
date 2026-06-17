import { afterEach, describe, expect, it } from "vitest";
import { createLiveKitToken } from "./livekit-adapter";

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,
};

describe("livekit adapter", () => {
  afterEach(() => {
    if (originalEnv.NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnv.NODE_ENV;

    if (originalEnv.LIVEKIT_API_KEY === undefined) delete process.env.LIVEKIT_API_KEY;
    else process.env.LIVEKIT_API_KEY = originalEnv.LIVEKIT_API_KEY;

    if (originalEnv.LIVEKIT_API_SECRET === undefined) delete process.env.LIVEKIT_API_SECRET;
    else process.env.LIVEKIT_API_SECRET = originalEnv.LIVEKIT_API_SECRET;
  });

  it("rejects development LiveKit credentials in production", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;

    await expect(
      createLiveKitToken({
        identity: "private-demo-live-host-1",
        roomName: "private-demo-live",
        role: "host",
      }),
    ).rejects.toThrow("LIVEKIT_PRODUCTION_SECRET_REQUIRED");
  });
});
