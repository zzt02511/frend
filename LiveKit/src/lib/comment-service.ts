import type { AppStore, CommentAnalytics, CommentStatus, LiveComment } from "./domain";
import { createId, nowIso } from "./domain";
import { addAuditLog, getLiveSession, getParticipantByUser, getStats } from "./live-service";
import { persistStoreIfGlobal } from "./store";

export function sendComment(
  store: AppStore,
  input: { liveId: string; userId: string; content: string },
): LiveComment {
  const live = getLiveSession(store, input.liveId);
  if (!live.enableComment || live.commentMode === "closed") throw new Error("COMMENT_CLOSED");

  const content = input.content.trim();
  if (!content) throw new Error("COMMENT_EMPTY");

  const participant = getParticipantByUser(store, input.liveId, input.userId);
  if (participant?.isBanned) throw new Error("USER_BANNED");
  if (participant?.isMuted) throw new Error("USER_MUTED");

  const status = live.commentMode === "free" ? "approved" : "pending";
  const comment: LiveComment = {
    id: createId("comment"),
    liveId: input.liveId,
    userId: input.userId,
    content,
    status,
    isPinned: false,
    isHighValueQuestion: false,
    visibleToSender: true,
    hitSensitiveWords: [],
    createdAt: nowIso(),
  };

  store.comments.push(comment);
  getStats(store, input.liveId).commentCount += 1;
  persistStoreIfGlobal(store);
  return comment;
}

export function listComments(store: AppStore, liveId: string) {
  return store.comments.filter((item) => item.liveId === liveId && item.status !== "deleted");
}

export function recordAudienceEvent(
  store: AppStore,
  input: { liveId: string; userId: string; type: "join" | "like" },
): LiveComment {
  getLiveSession(store, input.liveId);
  const user = store.users.find((item) => item.id === input.userId);
  const displayName = user?.name?.trim() || input.userId;
  const content =
    input.type === "join" ? `${displayName}进入直播间了` : `${displayName}点赞了主播`;
  const comment: LiveComment = {
    id: createId("comment"),
    liveId: input.liveId,
    userId: input.userId,
    content,
    status: "approved",
    isPinned: false,
    isHighValueQuestion: false,
    visibleToSender: false,
    hitSensitiveWords: [],
    createdAt: nowIso(),
  };

  store.comments.push(comment);
  const stats = getStats(store, input.liveId);
  stats.commentCount += 1;
  if (input.type === "like") stats.likeCount += 1;
  persistStoreIfGlobal(store);
  return comment;
}

export function listPublicComments(store: AppStore, liveId: string) {
  return listComments(store, liveId).filter((item) => item.status === "approved");
}

export function listAudienceComments(store: AppStore, liveId: string, viewerId?: string) {
  return listComments(store, liveId).filter(
    (item) => item.status === "approved" || (Boolean(viewerId) && item.userId === viewerId && item.visibleToSender),
  );
}

export function withCommentUserNames(store: AppStore, comments: LiveComment[]) {
  const usersById = new Map(store.users.map((user) => [user.id, user.name]));
  return comments.map((comment) => ({
    ...comment,
    userName: usersById.get(comment.userId) ?? comment.userName ?? comment.userId,
  }));
}

export function listPendingComments(store: AppStore, liveId: string) {
  return listComments(store, liveId).filter((item) => item.status === "pending");
}

export function getCommentAnalytics(store: AppStore, liveId: string): CommentAnalytics {
  const comments = store.comments.filter((item) => item.liveId === liveId);
  const usersById = new Map(store.users.map((user) => [user.id, user.name]));
  const summary = {
    total: comments.length,
    pending: 0,
    approved: 0,
    rejected: 0,
    deleted: 0,
    highValueQuestions: 0,
    pinned: 0,
    uniqueUsers: 0,
  };
  const userStats = new Map<
    string,
      {
        userId: string;
        userName?: string;
        total: number;
      pending: number;
      approved: number;
      rejected: number;
      deleted: number;
      highValueQuestions: number;
      lastCommentAt: string;
    }
  >();

  for (const comment of comments) {
    summary[comment.status] += 1;
    if (comment.isHighValueQuestion) summary.highValueQuestions += 1;
    if (comment.isPinned) summary.pinned += 1;

    const stat =
      userStats.get(comment.userId) ??
      {
        userId: comment.userId,
        userName: usersById.get(comment.userId),
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        deleted: 0,
        highValueQuestions: 0,
        lastCommentAt: comment.createdAt,
      };

    stat.total += 1;
    stat[comment.status] += 1;
    if (comment.isHighValueQuestion) stat.highValueQuestions += 1;
    if (comment.createdAt > stat.lastCommentAt) stat.lastCommentAt = comment.createdAt;
    userStats.set(comment.userId, stat);
  }

  summary.uniqueUsers = userStats.size;
  const statuses: CommentStatus[] = ["approved", "rejected", "deleted", "pending"];

  return {
    summary,
    statusBreakdown: statuses.map((status) => ({ status, count: summary[status] })),
    userRanking: [...userStats.values()].sort((a, b) => b.total - a.total || a.userId.localeCompare(b.userId)),
  };
}

export function approveComment(store: AppStore, liveId: string, commentId: string, actorId: string) {
  const comment = getComment(store, liveId, commentId);
  comment.status = "approved";
  comment.reviewedBy = actorId;
  comment.reviewedAt = nowIso();
  addAuditLog(store, actorId, "comment.approve", commentId);
  persistStoreIfGlobal(store);
  return comment;
}

export function rejectComment(store: AppStore, liveId: string, commentId: string, actorId: string) {
  const comment = getComment(store, liveId, commentId);
  comment.status = "rejected";
  comment.reviewedBy = actorId;
  comment.reviewedAt = nowIso();
  addAuditLog(store, actorId, "comment.reject", commentId);
  persistStoreIfGlobal(store);
  return comment;
}

export function deleteComment(store: AppStore, liveId: string, commentId: string, actorId: string) {
  const comment = getComment(store, liveId, commentId);
  comment.status = "deleted";
  addAuditLog(store, actorId, "comment.delete", commentId);
  persistStoreIfGlobal(store);
  return comment;
}

export function pinComment(store: AppStore, liveId: string, commentId: string, actorId: string) {
  const comment = getComment(store, liveId, commentId);
  comment.isPinned = true;
  addAuditLog(store, actorId, "comment.pin", commentId);
  persistStoreIfGlobal(store);
  return comment;
}

export function markHighValueQuestion(
  store: AppStore,
  liveId: string,
  commentId: string,
  actorId: string,
) {
  const comment = getComment(store, liveId, commentId);
  comment.isHighValueQuestion = true;
  addAuditLog(store, actorId, "comment.markQuestion", commentId);
  persistStoreIfGlobal(store);
  return comment;
}

function getComment(store: AppStore, liveId: string, commentId: string) {
  const comment = store.comments.find((item) => item.liveId === liveId && item.id === commentId);
  if (!comment) throw new Error("COMMENT_NOT_FOUND");
  return comment;
}
