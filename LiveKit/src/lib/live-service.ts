import type { AppStore, LiveKitAccessToken, LiveParticipant, UserRole } from "./domain";
import { createId, nowIso } from "./domain";
import { createLiveKitToken } from "./livekit-adapter";
import { persistStoreIfGlobal } from "./store";

const ONLINE_HEARTBEAT_WINDOW_MS = 30_000;

export function getLiveSession(store: AppStore, liveId: string) {
  const live = store.liveSessions.find((item) => item.id === liveId);
  if (!live) throw new Error("LIVE_NOT_FOUND");
  return live;
}

export function selectHostConsoleLiveSession(store: AppStore, hostUserId?: string) {
  const sessions = hostUserId
    ? store.liveSessions.filter((item) => item.hostUserId === hostUserId)
    : store.liveSessions;
  const live =
    sessions.find((item) => item.status === "live") ??
    sessions.find((item) => item.status === "scheduled" || item.status === "draft") ??
    sessions.find((item) => item.status !== "ended" && item.status !== "closed") ??
    sessions[0];

  if (!live) throw new Error("LIVE_NOT_FOUND");
  return live;
}

export function getUser(store: AppStore, userId: string) {
  const user = store.users.find((item) => item.id === userId);
  if (!user) throw new Error("USER_NOT_FOUND");
  return user;
}

function getOrCreateJoinUser(store: AppStore, userId: string, role: UserRole, displayName?: string) {
  const normalizedDisplayName = displayName?.trim();
  const user = store.users.find((item) => item.id === userId);
  if (user) {
    if (role === "audience" && normalizedDisplayName) user.name = normalizedDisplayName;
    return user;
  }
  if (role !== "audience") throw new Error("USER_NOT_FOUND");

  const guestUser = {
    id: userId,
    name: normalizedDisplayName || `微信观众 ${userId.slice(-6)}`,
    role: "audience" as const,
    status: "active" as const,
  };
  store.users.push(guestUser);
  return guestUser;
}

export function joinLiveSession(
  store: AppStore,
  input: { liveId: string; userId: string; role: UserRole; displayName?: string },
): LiveParticipant {
  const live = getLiveSession(store, input.liveId);
  const user = getOrCreateJoinUser(store, input.userId, input.role, input.displayName);
  const existing = store.participants.find(
    (item) => item.liveId === input.liveId && item.userId === input.userId,
  );

  if (user.status === "blacklisted" || existing?.isBanned) throw new Error("USER_BANNED");
  if (existing) return existing;

  const participant: LiveParticipant = {
    id: createId("participant"),
    liveId: live.id,
    userId: user.id,
    livekitIdentity: `${live.roomName}-${user.id}`,
    role: input.role,
    joinTime: nowIso(),
    lastActiveAt: nowIso(),
    watchDuration: 0,
    isMuted: false,
    isBanned: false,
    canPublish: input.role !== "audience" && input.role !== "moderator",
  };

  store.participants.push(participant);
  const stats = getStats(store, live.id);
  stats.uv += 1;
  persistStoreIfGlobal(store);
  return participant;
}

function refreshWatchDuration(store: AppStore, participant: LiveParticipant) {
  const durationSeconds = Math.max(
    participant.watchDuration,
    Math.floor((Date.now() - new Date(participant.joinTime).getTime()) / 1000),
  );
  participant.watchDuration = Number.isFinite(durationSeconds) ? durationSeconds : participant.watchDuration;

  const stats = getStats(store, participant.liveId);
  const durations = store.participants
    .filter((item) => item.liveId === participant.liveId && item.watchDuration > 0)
    .map((item) => item.watchDuration);
  stats.avgWatchDuration = durations.length
    ? Math.round(durations.reduce((total, value) => total + value, 0) / durations.length)
    : 0;
}

export function recordParticipantHeartbeat(
  store: AppStore,
  input: { liveId: string; userId: string; role: UserRole },
) {
  const participant = joinLiveSession(store, input);
  if (participant.leaveTime) participant.leaveTime = undefined;
  participant.lastActiveAt = nowIso();
  refreshWatchDuration(store, participant);
  persistStoreIfGlobal(store);
  return participant;
}

export function createAccessToken(
  store: AppStore,
  input: { liveId: string; userId: string; role: UserRole },
): Promise<LiveKitAccessToken> {
  const live = getLiveSession(store, input.liveId);
  const participant = joinLiveSession(store, input);

  return createLiveKitToken({
    identity: participant.livekitIdentity,
    roomName: live.roomName,
    role: input.role,
    canPublishOverride: participant.canPublish,
  });
}

export function startLiveSession(store: AppStore, liveId: string, actorId: string) {
  const live = getLiveSession(store, liveId);
  live.status = "live";
  live.actualStartTime = nowIso();
  addAuditLog(store, actorId, "live.start", liveId);
  persistStoreIfGlobal(store);
  return live;
}

export function endLiveSession(store: AppStore, liveId: string, actorId: string) {
  const live = getLiveSession(store, liveId);
  live.status = "ended";
  live.actualEndTime = nowIso();
  if (live.enableRecord) {
    live.replayUrl = `/api/live-sessions/${liveId}/replay?download=1`;
    store.replays.push({
      id: createId("replay"),
      liveId,
      status: "ready",
      url: live.replayUrl,
      visible: true,
      createdAt: nowIso(),
    });
  }
  addAuditLog(store, actorId, "live.end", liveId);
  persistStoreIfGlobal(store);
  return live;
}

export function deleteLiveSession(store: AppStore, liveId: string, actorId: string) {
  const live = getLiveSession(store, liveId);
  if (live.status === "live") throw new Error("LIVE_SESSION_ACTIVE");
  store.liveSessions.splice(0, store.liveSessions.length, ...store.liveSessions.filter((item) => item.id !== liveId));
  store.participants.splice(0, store.participants.length, ...store.participants.filter((item) => item.liveId !== liveId));
  store.comments.splice(0, store.comments.length, ...store.comments.filter((item) => item.liveId !== liveId));
  store.micRequests.splice(0, store.micRequests.length, ...store.micRequests.filter((item) => item.liveId !== liveId));
  store.replays.splice(0, store.replays.length, ...store.replays.filter((item) => item.liveId !== liveId));
  store.stats.splice(0, store.stats.length, ...store.stats.filter((item) => item.liveId !== liveId));
  store.shareVisits.splice(0, store.shareVisits.length, ...store.shareVisits.filter((item) => item.liveId !== liveId));
  store.customerFollowUps.splice(
    0,
    store.customerFollowUps.length,
    ...store.customerFollowUps.filter((item) => item.liveId !== liveId),
  );
  addAuditLog(store, actorId, "live.delete", liveId, { title: live.title });
  persistStoreIfGlobal(store);
  return { id: liveId };
}

export function updateLiveSession(
  store: AppStore,
  liveId: string,
  patch: Partial<
    Pick<
      ReturnType<typeof getLiveSession>,
      | "title"
      | "coverUrl"
      | "description"
      | "cdnPlayUrl"
      | "startTime"
      | "endTime"
      | "enableComment"
      | "commentMode"
      | "enableMicApply"
      | "enableRecord"
      | "accessPassword"
      | "accessPasswordCiphertext"
      | "accessPasswordVersion"
    >
  >,
) {
  const live = getLiveSession(store, liveId);
  Object.assign(live, patch);
  persistStoreIfGlobal(store);
  return live;
}

export function muteParticipant(store: AppStore, liveId: string, participantId: string, actorId: string) {
  const participant = getParticipant(store, liveId, participantId);
  participant.isMuted = true;
  addAuditLog(store, actorId, "participant.mute", participantId);
  persistStoreIfGlobal(store);
  return participant;
}

export function unmuteParticipant(store: AppStore, liveId: string, participantId: string, actorId: string) {
  const participant = getParticipant(store, liveId, participantId);
  participant.isMuted = false;
  addAuditLog(store, actorId, "participant.unmute", participantId);
  persistStoreIfGlobal(store);
  return participant;
}

export function kickParticipant(store: AppStore, liveId: string, participantId: string, actorId: string) {
  const participant = getParticipant(store, liveId, participantId);
  participant.isBanned = true;
  participant.leaveTime = nowIso();
  participant.lastActiveAt = participant.leaveTime;
  participant.canPublish = false;
  getStats(store, liveId);
  addAuditLog(store, actorId, "participant.kick", participantId);
  persistStoreIfGlobal(store);
  return participant;
}

export function getParticipant(store: AppStore, liveId: string, participantId: string) {
  const participant = store.participants.find(
    (item) => item.liveId === liveId && item.id === participantId,
  );
  if (!participant) throw new Error("PARTICIPANT_NOT_FOUND");
  return participant;
}

export function getParticipantByUser(store: AppStore, liveId: string, userId: string) {
  return store.participants.find((item) => item.liveId === liveId && item.userId === userId);
}

export function withParticipantUserNames(store: AppStore, participants: LiveParticipant[]) {
  const usersById = new Map(store.users.map((user) => [user.id, user.name]));
  return participants.map((participant) => ({
    ...participant,
    userName: usersById.get(participant.userId) ?? participant.userName ?? participant.userId,
  }));
}

export function listOnlineParticipants(store: AppStore, liveId: string) {
  const live = getLiveSession(store, liveId);
  if (live.status !== "live") return [];
  const now = Date.now();
  return store.participants.filter((participant) => isOnlineParticipant(participant, liveId, now));
}

export function getStats(store: AppStore, liveId: string) {
  let stats = store.stats.find((item) => item.liveId === liveId);
  if (!stats) {
    stats = {
      id: createId("stats"),
      liveId,
      pv: 0,
      uv: 0,
      peakOnline: 0,
      currentOnline: 0,
      avgWatchDuration: 0,
      commentCount: 0,
      likeCount: 0,
      micApplyCount: 0,
      successfulMicCount: 0,
      leadCount: 0,
      replayViewCount: 0,
    };
    store.stats.push(stats);
  }
  const onlineCount = listOnlineParticipants(store, liveId).length;
  stats.currentOnline = onlineCount;
  stats.peakOnline = Math.max(stats.peakOnline, onlineCount);
  return stats;
}

function isOnlineParticipant(participant: LiveParticipant, liveId: string, now: number) {
  if (participant.liveId !== liveId || participant.isBanned || participant.leaveTime) return false;
  const activeAt = participant.lastActiveAt ?? participant.joinTime;
  return now - new Date(activeAt).getTime() <= ONLINE_HEARTBEAT_WINDOW_MS;
}

export function addAuditLog(
  store: AppStore,
  actorId: string,
  action: string,
  targetId: string,
  metadata?: Record<string, unknown>,
) {
  store.auditLogs.push({
    id: createId("audit"),
    actorId,
    action,
    targetId,
    metadata,
    createdAt: nowIso(),
  });
}
