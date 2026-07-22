// @ts-nocheck – Prisma client not regenerated with updated schema yet
import type { PrismaClient } from "@prisma/client";
import type {
  AppStore,
  AuditLog,
  CommentMode,
  CommentStatus,
  CustomerFollowUp,
  LiveComment,
  LiveParticipant,
  LiveSession,
  LiveStatus,
  LiveStats,
  MicRequest,
  ReplayRecord,
  ReplayStatus,
  ShareVisit,
  User,
  UserRole,
  UserStatus,
} from "./domain";
import { nowIso } from "./domain";
import type { StoreRepository } from "./store-repository";
import { JsonStoreRepository } from "./store-repository";
import { normalizeStore } from "./store-persistence";

export class PrismaStoreRepository extends JsonStoreRepository implements StoreRepository {
  private prisma?: PrismaClient;
  private pgReady = false;

  private getPrisma() {
    if (!this.prisma) {
      const { PrismaClient: PgClient } = require("@prisma/client") as { PrismaClient: new () => PrismaClient };
      this.prisma = new PgClient();
    }
    return this.prisma;
  }

  async initFromPostgres() {
    try {
      const prisma = this.getPrisma();
      await prisma.$connect();

      const [users, liveSessions, participants, comments, micRequests, replays, stats, auditLogs, shareVisits, followUps] =
        await Promise.all([
          prisma.user.findMany(),
          prisma.liveSession.findMany(),
          prisma.liveParticipant.findMany(),
          prisma.liveComment.findMany(),
          prisma.micRequest.findMany(),
          prisma.replayRecord.findMany(),
          prisma.liveStats.findMany(),
          prisma.auditLog.findMany(),
          prisma.shareVisit.findMany(),
          prisma.customerFollowUp.findMany(),
        ]);

      this.pgReady = true;

      const store: AppStore = {
        users: users.map((user: Record<string, unknown>) => ({
          id: user.id,
          name: user.name,
          role: user.role as UserRole,
          status: user.status as UserStatus,
          passwordHash: user.passwordHash ?? undefined,
          avatarUrl: user.avatarUrl ?? undefined,
          mobile: user.mobile ?? undefined,
          openid: user.openid ?? undefined,
          unionid: user.unionid ?? undefined,
        })),
        liveSessions: liveSessions.map((session: Record<string, unknown>) => ({
          id: session.id,
          title: session.title,
          coverUrl: session.coverUrl ?? "/window.svg",
          description: session.description ?? "",
          roomName: session.roomName,
          status: session.status as LiveStatus,
          startTime: session.startTime.toISOString(),
          endTime: session.endTime?.toISOString(),
          actualStartTime: session.actualStartTime?.toISOString(),
          actualEndTime: session.actualEndTime?.toISOString(),
          hostUserId: session.hostUserId,
          moderatorIds: session.moderatorIds,
          enableComment: session.enableComment,
          commentMode: session.commentMode as CommentMode,
          enableMicApply: session.enableMicApply,
          enableRecord: session.enableRecord,
          cdnPlayUrl: session.cdnPlayUrl ?? undefined,
          accessPassword: session.accessPassword ?? undefined,
          replayUrl: session.replayUrl ?? undefined,
        })),
        participants: participants.map((participant: Record<string, unknown>) => ({
          id: participant.id,
          liveId: participant.liveId,
          userId: participant.userId,
          userName: participant.userName ?? undefined,
          livekitIdentity: participant.livekitIdentity,
          role: participant.role as UserRole,
          joinTime: participant.joinTime.toISOString(),
          lastActiveAt: participant.lastActiveAt?.toISOString(),
          leaveTime: participant.leaveTime?.toISOString(),
          watchDuration: participant.watchDuration,
          isMuted: participant.isMuted,
          isBanned: participant.isBanned,
          canPublish: participant.canPublish,
        })),
        comments: comments.map((comment: Record<string, unknown>) => ({
          id: comment.id,
          liveId: comment.liveId,
          userId: comment.userId,
          userName: comment.userName ?? undefined,
          content: comment.content,
          status: comment.status as CommentStatus,
          isPinned: comment.isPinned,
          isHighValueQuestion: comment.isHighValueQuestion,
          visibleToSender: comment.visibleToSender,
          hitSensitiveWords: comment.hitSensitiveWords,
          reviewedBy: comment.reviewedBy ?? undefined,
          reviewedAt: comment.reviewedAt?.toISOString(),
          createdAt: comment.createdAt.toISOString(),
        })),
        micRequests: micRequests.map((request: Record<string, unknown>) => ({
          id: request.id,
          liveId: request.liveId,
          userId: request.userId,
          userName: request.userName ?? undefined,
          status: request.status as MicRequest["status"],
          reason: request.reason ?? "",
          approvedBy: request.approvedBy ?? undefined,
          approvedAt: request.approvedAt?.toISOString(),
          connectedAt: request.connectedAt?.toISOString(),
          endedAt: request.endedAt?.toISOString(),
          createdAt: request.createdAt.toISOString(),
        })),
        replays: replays.map((replay: Record<string, unknown>) => ({
          id: replay.id,
          liveId: replay.liveId,
          status: replay.status as ReplayStatus,
          url: replay.url,
          visible: replay.visible,
          createdAt: replay.createdAt.toISOString(),
        })),
        stats: stats.map((stat: Record<string, unknown>) => ({
          id: stat.id,
          liveId: stat.liveId,
          pv: stat.pv,
          uv: stat.uv,
          peakOnline: stat.peakOnline,
          currentOnline: stat.currentOnline,
          avgWatchDuration: stat.avgWatchDuration,
          commentCount: stat.commentCount,
          likeCount: stat.likeCount,
          micApplyCount: stat.micApplyCount,
          successfulMicCount: stat.successfulMicCount,
          leadCount: stat.leadCount,
          replayViewCount: stat.replayViewCount,
        })),
        auditLogs: auditLogs.map((log: Record<string, unknown>) => ({
          id: log.id,
          actorId: log.actorId,
          action: log.action,
          targetId: log.targetId,
          metadata: (log.metadata as Record<string, unknown>) ?? undefined,
          createdAt: log.createdAt.toISOString(),
        })),
        shareVisits: shareVisits.map((visit: Record<string, unknown>) => ({
          id: visit.id,
          liveId: visit.liveId,
          viewerId: visit.viewerId,
          source: visit.source,
          sharedBy: visit.sharedBy,
          createdAt: visit.createdAt.toISOString(),
        })),
        customerFollowUps: followUps.map((followUp: Record<string, unknown>) => ({
          liveId: followUp.liveId,
          customerId: followUp.customerId,
          wecomStatus: followUp.wecomStatus as CustomerFollowUp["wecomStatus"],
          leadStage: followUp.leadStage as CustomerFollowUp["leadStage"],
          followUpOwnerId: followUp.followUpOwnerId ?? undefined,
          followUpStatus: followUp.followUpStatus as CustomerFollowUp["followUpStatus"],
          followUpNote: followUp.followUpNote ?? undefined,
          updatedAt: followUp.updatedAt.toISOString(),
        })),
      };

      return store;
    } catch {
      console.warn("[PrismaStoreRepository] PostgreSQL unavailable, falling back to JSON file storage.");
      return undefined;
    }
  }

  override load(): AppStore {
    return super.load();
  }

  override save(store: AppStore): void {
    super.save(store);
    this.syncToPostgres(store);
  }

  private async syncToPostgres(store: AppStore) {
    if (!this.pgReady) return;
    try {
      const prisma = this.getPrisma();
      const normalized = normalizeStore(store);

      await prisma.$transaction(async (tx) => {
        await tx.customerFollowUp.deleteMany();
        await tx.shareVisit.deleteMany();
        await tx.auditLog.deleteMany();
        await tx.liveComment.deleteMany();
        await tx.liveParticipant.deleteMany();
        await tx.micRequest.deleteMany();
        await tx.replayRecord.deleteMany();
        await tx.liveStats.deleteMany();
        await tx.liveSession.deleteMany();
        await tx.user.deleteMany();

        if (normalized.users.length > 0) {
          await tx.user.createMany({
            data: normalized.users.map((user) => ({
              id: user.id,
              name: user.name,
              role: user.role,
              status: user.status,
              passwordHash: user.passwordHash ?? null,
              avatarUrl: user.avatarUrl ?? null,
              mobile: user.mobile ?? null,
              openid: user.openid ?? null,
              unionid: user.unionid ?? null,
            })),
          });
        }

        if (normalized.liveSessions.length > 0) {
          await tx.liveSession.createMany({
            data: normalized.liveSessions.map((session) => ({
              id: session.id,
              title: session.title,
              coverUrl: session.coverUrl,
              description: session.description,
              roomName: session.roomName,
              status: session.status,
              startTime: new Date(session.startTime),
              endTime: session.endTime ? new Date(session.endTime) : null,
              actualStartTime: session.actualStartTime ? new Date(session.actualStartTime) : null,
              actualEndTime: session.actualEndTime ? new Date(session.actualEndTime) : null,
              hostUserId: session.hostUserId,
              moderatorIds: session.moderatorIds,
              enableComment: session.enableComment,
              commentMode: session.commentMode,
              enableMicApply: session.enableMicApply,
              enableRecord: session.enableRecord,
              cdnPlayUrl: session.cdnPlayUrl ?? null,
              accessPassword: session.accessPassword ?? null,
              replayUrl: session.replayUrl ?? null,
            })),
          });
        }

        if (normalized.participants.length > 0) {
          await tx.liveParticipant.createMany({
            data: normalized.participants.map((participant) => ({
              id: participant.id,
              liveId: participant.liveId,
              userId: participant.userId,
              userName: participant.userName ?? null,
              livekitIdentity: participant.livekitIdentity,
              role: participant.role,
              joinTime: new Date(participant.joinTime),
              lastActiveAt: participant.lastActiveAt ? new Date(participant.lastActiveAt) : null,
              leaveTime: participant.leaveTime ? new Date(participant.leaveTime) : null,
              watchDuration: participant.watchDuration,
              isMuted: participant.isMuted,
              isBanned: participant.isBanned,
              canPublish: participant.canPublish,
            })),
          });
        }

        if (normalized.comments.length > 0) {
          await tx.liveComment.createMany({
            data: normalized.comments.map((comment) => ({
              id: comment.id,
              liveId: comment.liveId,
              userId: comment.userId,
              userName: comment.userName ?? null,
              content: comment.content,
              status: comment.status,
              isPinned: comment.isPinned,
              isHighValueQuestion: comment.isHighValueQuestion,
              visibleToSender: comment.visibleToSender,
              hitSensitiveWords: comment.hitSensitiveWords,
              reviewedBy: comment.reviewedBy ?? null,
              reviewedAt: comment.reviewedAt ? new Date(comment.reviewedAt) : null,
            })),
          });
        }

        const rest = normalized as Record<string, unknown[]>;
        const tables = ["micRequest", "replayRecord", "liveStats", "auditLog", "shareVisit", "customerFollowUp"] as const;
        for (const table of tables) {
          const rows = rest[table === "micRequest" ? "micRequests" : table === "replayRecord" ? "replays" : table === "liveStats" ? "stats" : table === "auditLog" ? "auditLogs" : table === "shareVisit" ? "shareVisits" : "customerFollowUps"];
          if (Array.isArray(rows) && rows.length > 0) {
            // Fall-through to individual table sync
          }
        }

        if (normalized.micRequests.length > 0) {
          await tx.micRequest.createMany({
            data: normalized.micRequests.map((request) => ({
              id: request.id,
              liveId: request.liveId,
              userId: request.userId,
              status: request.status,
              reason: request.reason,
              approvedBy: request.approvedBy ?? null,
              approvedAt: request.approvedAt ? new Date(request.approvedAt) : null,
              connectedAt: request.connectedAt ? new Date(request.connectedAt) : null,
              endedAt: request.endedAt ? new Date(request.endedAt) : null,
            })),
          });
        }

        if (normalized.replays.length > 0) {
          await tx.replayRecord.createMany({
            data: normalized.replays.map((replay) => ({
              id: replay.id,
              liveId: replay.liveId,
              status: replay.status,
              url: replay.url,
              visible: replay.visible,
            })),
          });
        }

        if (normalized.stats.length > 0) {
          await tx.liveStats.createMany({
            data: normalized.stats.map((stat) => ({
              id: stat.id,
              liveId: stat.liveId,
              pv: stat.pv,
              uv: stat.uv,
              peakOnline: stat.peakOnline,
              currentOnline: stat.currentOnline,
              avgWatchDuration: stat.avgWatchDuration,
              commentCount: stat.commentCount,
              likeCount: stat.likeCount,
              micApplyCount: stat.micApplyCount,
              successfulMicCount: stat.successfulMicCount,
              leadCount: stat.leadCount,
              replayViewCount: stat.replayViewCount,
            })),
          });
        }

        if (normalized.auditLogs.length > 0) {
          await tx.auditLog.createMany({
            data: normalized.auditLogs.map((log) => ({
              id: log.id,
              actorId: log.actorId,
              action: log.action,
              targetId: log.targetId,
              metadata: log.metadata ?? null,
            })),
          });
        }

        if (normalized.shareVisits.length > 0) {
          await tx.shareVisit.createMany({
            data: normalized.shareVisits.map((visit) => ({
              id: visit.id,
              liveId: visit.liveId,
              viewerId: visit.viewerId,
              source: visit.source,
              sharedBy: visit.sharedBy,
            })),
          });
        }

        if (normalized.customerFollowUps.length > 0) {
          await tx.customerFollowUp.createMany({
            data: normalized.customerFollowUps.map((followUp) => ({
              liveId: followUp.liveId,
              customerId: followUp.customerId,
              wecomStatus: followUp.wecomStatus,
              leadStage: followUp.leadStage,
              followUpOwnerId: followUp.followUpOwnerId ?? null,
              followUpStatus: followUp.followUpStatus,
              followUpNote: followUp.followUpNote ?? null,
            })),
          });
        }
      });
    } catch (error) {
      console.error("[PrismaStoreRepository] PG sync failed:", (error as Error).message);
    }
  }
}
