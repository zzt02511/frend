import { describe, expect, it } from "vitest";
import { applyForMic, approveMicRequest, endMicRequest, rejectMicRequest } from "./mic-service";
import { createDemoStore } from "./store";
import { getStats, joinLiveSession, kickParticipant, muteParticipant } from "./live-service";

describe("mic service", () => {
  it("approves a mic request and grants publish permission", () => {
    const store = createDemoStore();
    const request = applyForMic(store, {
      liveId: "demo-live",
      userId: "audience-1",
      reason: "想现场提问",
    });

    const approved = approveMicRequest(store, "demo-live", request.id, "moderator-1");
    const participant = store.participants.find((item) => item.userId === "audience-1");

    expect(approved.status).toBe("approved");
    expect(participant?.canPublish).toBe(true);
  });

  it("ends mic access and revokes publish permission", () => {
    const store = createDemoStore();
    const request = applyForMic(store, {
      liveId: "demo-live",
      userId: "audience-1",
      reason: "想现场提问",
    });
    approveMicRequest(store, "demo-live", request.id, "moderator-1");

    const ended = endMicRequest(store, "demo-live", request.id, "moderator-1");
    const participant = store.participants.find((item) => item.userId === "audience-1");

    expect(ended.status).toBe("ended");
    expect(participant?.canPublish).toBe(false);
  });

  it("rejects a mic request without granting publish permission", () => {
    const store = createDemoStore();
    const request = applyForMic(store, {
      liveId: "demo-live",
      userId: "audience-1",
      reason: "背景太吵",
    });

    const rejected = rejectMicRequest(store, "demo-live", request.id, "moderator-1");
    const participant = store.participants.find((item) => item.userId === "audience-1");

    expect(rejected.status).toBe("rejected");
    expect(participant?.canPublish).not.toBe(true);
  });

  it("creates a fresh manual-approval request after a previous approved mic session", () => {
    const store = createDemoStore();
    const firstRequest = applyForMic(store, {
      liveId: "demo-live",
      userId: "audience-1",
      reason: "first request",
    });
    approveMicRequest(store, "demo-live", firstRequest.id, "host-1");

    const nextRequest = applyForMic(store, {
      liveId: "demo-live",
      userId: "audience-1",
      reason: "second request",
    });
    const participant = store.participants.find((item) => item.userId === "audience-1");

    expect(nextRequest.id).not.toBe(firstRequest.id);
    expect(nextRequest.status).toBe("applied");
    expect(firstRequest.status).toBe("ended");
    expect(participant?.canPublish).toBe(false);
  });

  it("does not approve a mic request for a banned participant", () => {
    const store = createDemoStore();
    const request = applyForMic(store, {
      liveId: "demo-live",
      userId: "audience-1",
      reason: "before ban",
    });
    const participant = joinLiveSession(store, {
      liveId: "demo-live",
      userId: "audience-1",
      role: "audience",
    });
    kickParticipant(store, "demo-live", participant.id, "moderator-1");

    expect(() => approveMicRequest(store, "demo-live", request.id, "host-1")).toThrow("USER_BANNED");
    expect(request.status).toBe("applied");
    expect(participant.canPublish).toBe(false);
  });

  it("does not approve a mic request for a muted participant", () => {
    const store = createDemoStore();
    const request = applyForMic(store, {
      liveId: "demo-live",
      userId: "audience-1",
      reason: "before mute",
    });
    const participant = joinLiveSession(store, {
      liveId: "demo-live",
      userId: "audience-1",
      role: "audience",
    });
    muteParticipant(store, "demo-live", participant.id, "moderator-1");

    expect(() => approveMicRequest(store, "demo-live", request.id, "host-1")).toThrow("USER_MUTED");
    expect(request.status).toBe("applied");
    expect(participant.canPublish).toBe(false);
  });

  it("counts a successful mic approval only once", () => {
    const store = createDemoStore();
    const request = applyForMic(store, {
      liveId: "demo-live",
      userId: "audience-1",
      reason: "single approval",
    });

    approveMicRequest(store, "demo-live", request.id, "host-1");

    expect(() => approveMicRequest(store, "demo-live", request.id, "host-1")).toThrow("MIC_REQUEST_NOT_APPLIED");
    expect(getStats(store, "demo-live").successfulMicCount).toBe(1);
  });
});
