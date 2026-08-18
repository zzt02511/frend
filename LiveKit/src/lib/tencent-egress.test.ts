import { afterEach, describe, expect, it, vi } from "vitest";
import { createDemoStore } from "./store";
import { buildTencentRtmpPushUrl } from "./tencent-egress";

describe("Tencent RTMP URL generation", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("signs a short-lived URL with the room's unique stream name", () => {
    vi.stubEnv("TENCENT_RTMP_PUSH_KEY", "secret");
    vi.stubEnv("TENCENT_RTMP_URL_TTL_SECONDS", "300");
    const live = { ...createDemoStore().liveSessions[0], tencentStreamName: "live-room" };

    expect(buildTencentRtmpPushUrl(live, new Date("2023-12-31T23:55:00.000Z"))).toBe(
      "rtmp://push.fuguilong.cn/live/live-room?txSecret=a2134ab8d2c8e7a8372bd5e93456ac7c&txTime=65920080",
    );
  });

  it("never reuses the same push path for two rooms", () => {
    vi.stubEnv("TENCENT_RTMP_PUSH_KEY", "secret");
    const base = createDemoStore().liveSessions[0];
    const first = buildTencentRtmpPushUrl({ ...base, id: "live-a", tencentStreamName: "live-a" });
    const second = buildTencentRtmpPushUrl({ ...base, id: "live-b", tencentStreamName: "live-b" });

    expect(first).toContain("/live/live-a?");
    expect(second).toContain("/live/live-b?");
    expect(first).not.toBe(second);
  });

  it("refuses to start without the server-side push key", () => {
    vi.stubEnv("TENCENT_RTMP_PUSH_KEY", "");
    expect(() => buildTencentRtmpPushUrl(createDemoStore().liveSessions[0])).toThrow("TENCENT_RTMP_PUSH_KEY_REQUIRED");
  });
});
