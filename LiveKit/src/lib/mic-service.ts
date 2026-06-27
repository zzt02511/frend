import type { AppStore, MicRequest } from "./domain";
import { createId, nowIso } from "./domain";
import { addAuditLog, getLiveSession, getParticipantByUser, getStats, joinLiveSession } from "./live-service";
import { persistStoreIfGlobal } from "./store";

export function applyForMic(
  store: AppStore,
  input: { liveId: string; userId: string; reason: string },
): MicRequest {
  const live = getLiveSession(store, input.liveId);
  if (!live.enableMicApply) throw new Error("MIC_APPLY_CLOSED");

  const participant =
    getParticipantByUser(store, input.liveId, input.userId) ??
    joinLiveSession(store, {
      liveId: input.liveId,
      userId: input.userId,
      role: "audience",
    });

  if (participant.isBanned) throw new Error("USER_BANNED");
  if (participant.isMuted) throw new Error("USER_MUTED");

  const existingApplied = store.micRequests.find(
    (item) =>
      item.liveId === input.liveId &&
      item.userId === input.userId &&
      item.status === "applied",
  );
  if (existingApplied) return existingApplied;

  const reusableAccess = store.micRequests.filter(
    (item) =>
      item.liveId === input.liveId &&
      item.userId === input.userId &&
      ["approved", "connected"].includes(item.status),
  );
  if (reusableAccess.length > 0) {
    for (const request of reusableAccess) {
      request.status = "ended";
      request.endedAt = nowIso();
    }
    participant.canPublish = false;
  }

  const request: MicRequest = {
    id: createId("mic"),
    liveId: input.liveId,
    userId: input.userId,
    status: "applied",
    reason: input.reason,
    createdAt: nowIso(),
  };

  store.micRequests.push(request);
  getStats(store, input.liveId).micApplyCount += 1;
  persistStoreIfGlobal(store);
  return request;
}

export function approveMicRequest(store: AppStore, liveId: string, requestId: string, actorId: string) {
  const request = getMicRequest(store, liveId, requestId);
  if (request.status !== "applied") throw new Error("MIC_REQUEST_NOT_APPLIED");

  const participant =
    getParticipantByUser(store, liveId, request.userId) ??
    joinLiveSession(store, {
      liveId,
      userId: request.userId,
      role: "audience",
    });

  if (participant.isBanned) throw new Error("USER_BANNED");
  if (participant.isMuted) throw new Error("USER_MUTED");

  request.status = "approved";
  request.approvedBy = actorId;
  request.approvedAt = nowIso();
  participant.canPublish = true;
  getStats(store, liveId).successfulMicCount += 1;
  addAuditLog(store, actorId, "mic.approve", requestId);
  persistStoreIfGlobal(store);
  return request;
}

export function rejectMicRequest(store: AppStore, liveId: string, requestId: string, actorId: string) {
  const request = getMicRequest(store, liveId, requestId);
  request.status = "rejected";
  request.approvedBy = actorId;
  request.approvedAt = nowIso();
  addAuditLog(store, actorId, "mic.reject", requestId);
  persistStoreIfGlobal(store);
  return request;
}

export function endMicRequest(store: AppStore, liveId: string, requestId: string, actorId: string) {
  const request = getMicRequest(store, liveId, requestId);
  const participant = getParticipantByUser(store, liveId, request.userId);
  request.status = "ended";
  request.endedAt = nowIso();
  if (participant) participant.canPublish = false;
  addAuditLog(store, actorId, "mic.end", requestId);
  persistStoreIfGlobal(store);
  return request;
}

export function withMicRequestUserNames(store: AppStore, requests: MicRequest[]) {
  const usersById = new Map(store.users.map((user) => [user.id, user.name]));
  return requests.map((request) => ({
    ...request,
    userName: usersById.get(request.userId) ?? request.userName ?? request.userId,
  }));
}

function getMicRequest(store: AppStore, liveId: string, requestId: string) {
  const request = store.micRequests.find((item) => item.liveId === liveId && item.id === requestId);
  if (!request) throw new Error("MIC_REQUEST_NOT_FOUND");
  return request;
}
