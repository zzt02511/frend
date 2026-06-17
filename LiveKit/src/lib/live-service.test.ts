import { describe, expect, it } from "vitest";
import { TokenVerifier } from "livekit-server-sdk";
import { createDemoStore } from "./store";
import {
  createAccessToken,
  endLiveSession,
  getStats,
  joinLiveSession,
  kickParticipant,
  muteParticipant,
  recordParticipantHeartbeat,
  startLiveSession,
} from "./live-service";
import { applyForMic, approveMicRequest } from "./mic-service";

describe("live service", () => {
  it("maps audience and host roles to different LiveKit publish permissions", async () => {
    const store = createDemoStore();

    const audienceToken = await createAccessToken(store, {
      liveId: "demo-live",
      userId: "audience-1",
      role: "audience",
    });
    const hostToken = await createAccessToken(store, {
      liveId: "demo-live",
      userId: "host-1",
      role: "host",
    });

    expect(audienceToken.grants.canPublish).toBe(false);
    expect(audienceToken.grants.canSubscribe).toBe(true);
    expect(hostToken.grants.canPublish).toBe(true);
    expect(hostToken.grants.canPublishData).toBe(true);
  });

  it("creates unique temporary audience users for different WeChat viewers", async () => {
    const store = createDemoStore();

    const firstToken = await createAccessToken(store, {
      liveId: "demo-live",
      userId: "wxv-phone-a",
      role: "audience",
    });
    const secondToken = await createAccessToken(store, {
      liveId: "demo-live",
      userId: "wxv-phone-b",
      role: "audience",
    });

    expect(firstToken.identity).toBe("private-demo-live-wxv-phone-a");
    expect(secondToken.identity).toBe("private-demo-live-wxv-phone-b");
    expect(firstToken.identity).not.toBe(secondToken.identity);
    expect(store.users.find((user) => user.id === "wxv-phone-a")?.role).toBe("audience");
    expect(store.users.find((user) => user.id === "wxv-phone-b")?.role).toBe("audience");
  });

  it("creates a verifiable LiveKit JWT for the room", async () => {
    const store = createDemoStore();

    const hostToken = await createAccessToken(store, {
      liveId: "demo-live",
      userId: "host-1",
      role: "host",
    });
    const verified = await new TokenVerifier("devkey", "secret").verify(hostToken.token);

    expect(hostToken.serverUrl).toBe("wss://fuguilong.cn");
    expect(hostToken.token.split(".")).toHaveLength(3);
    expect(verified.video?.room).toBe("private-demo-live");
    expect(verified.video?.roomJoin).toBe(true);
    expect(verified.video?.canPublish).toBe(true);
    expect(verified.sub).toBe("private-demo-live-host-1");
  });

  it("allows an approved audience mic participant to publish media", async () => {
    const store = createDemoStore();
    const request = applyForMic(store, {
      liveId: "demo-live",
      userId: "audience-1",
      reason: "想连麦提问",
    });

    const beforeApprovalToken = await createAccessToken(store, {
      liveId: "demo-live",
      userId: "audience-1",
      role: "audience",
    });
    approveMicRequest(store, "demo-live", request.id, "moderator-1");
    const approvedToken = await createAccessToken(store, {
      liveId: "demo-live",
      userId: "audience-1",
      role: "audience",
    });

    expect(beforeApprovalToken.grants.canPublish).toBe(false);
    expect(approvedToken.grants.canPublish).toBe(true);
  });

  it("does not keep publish permission after the viewer submits a new mic request", async () => {
    const store = createDemoStore();
    const request = applyForMic(store, {
      liveId: "demo-live",
      userId: "audience-1",
      reason: "first request",
    });
    approveMicRequest(store, "demo-live", request.id, "host-1");

    applyForMic(store, {
      liveId: "demo-live",
      userId: "audience-1",
      reason: "second request",
    });

    const token = await createAccessToken(store, {
      liveId: "demo-live",
      userId: "audience-1",
      role: "audience",
    });

    expect(token.grants.canPublish).toBe(false);
  });

  it("starts and ends a live session with replay metadata", () => {
    const store = createDemoStore();

    const started = startLiveSession(store, "demo-live", "host-1");
    expect(started.status).toBe("live");
    expect(started.actualStartTime).toBeTruthy();

    const ended = endLiveSession(store, "demo-live", "host-1");
    const replay = store.replays.find((item) => item.liveId === "demo-live");

    expect(ended.status).toBe("ended");
    expect(ended.actualEndTime).toBeTruthy();
    expect(replay?.status).toBe("ready");
  });

  it("prevents kicked participants from rejoining the same live session", () => {
    const store = createDemoStore();
    const participant = joinLiveSession(store, {
      liveId: "demo-live",
      userId: "audience-1",
      role: "audience",
    });

    kickParticipant(store, "demo-live", participant.id, "moderator-1");

    expect(() =>
      joinLiveSession(store, {
        liveId: "demo-live",
        userId: "audience-1",
        role: "audience",
      }),
    ).toThrow("USER_BANNED");
  });

  it("marks muted participants so comment service can block interaction", () => {
    const store = createDemoStore();
    const participant = joinLiveSession(store, {
      liveId: "demo-live",
      userId: "audience-1",
      role: "audience",
    });

    const muted = muteParticipant(store, "demo-live", participant.id, "moderator-1");

    expect(muted.isMuted).toBe(true);
  });

  it("refreshes participant watch duration from audience heartbeats", () => {
    const store = createDemoStore();
    const participant = joinLiveSession(store, {
      liveId: "demo-live",
      userId: "audience-heartbeat",
      role: "audience",
    });
    participant.joinTime = new Date(Date.now() - 91_000).toISOString();

    const updated = recordParticipantHeartbeat(store, {
      liveId: "demo-live",
      userId: "audience-heartbeat",
      role: "audience",
    });

    expect(updated.watchDuration).toBeGreaterThanOrEqual(90);
    expect(store.stats.find((item) => item.liveId === "demo-live")?.avgWatchDuration).toBeGreaterThan(0);
  });

  it("reports real-time online count from recent participant heartbeats", () => {
    const store = createDemoStore();
    const active = joinLiveSession(store, {
      liveId: "demo-live",
      userId: "active-viewer",
      role: "audience",
    });
    const stale = joinLiveSession(store, {
      liveId: "demo-live",
      userId: "stale-viewer",
      role: "audience",
    });
    active.lastActiveAt = new Date().toISOString();
    stale.lastActiveAt = new Date(Date.now() - 60_000).toISOString();

    expect(getStats(store, "demo-live").currentOnline).toBe(1);
  });
});
