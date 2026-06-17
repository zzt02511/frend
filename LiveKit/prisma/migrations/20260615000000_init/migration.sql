-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('super_admin', 'director', 'host', 'moderator', 'audience');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'disabled', 'blacklisted');

-- CreateEnum
CREATE TYPE "LiveStatus" AS ENUM ('draft', 'scheduled', 'live', 'ended', 'closed');

-- CreateEnum
CREATE TYPE "CommentMode" AS ENUM ('free', 'review', 'host_only', 'closed');

-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('pending', 'approved', 'rejected', 'deleted');

-- CreateEnum
CREATE TYPE "MicRequestStatus" AS ENUM ('applied', 'approved', 'rejected', 'connected', 'cancelled', 'ended', 'kicked');

-- CreateEnum
CREATE TYPE "ReplayStatus" AS ENUM ('recording', 'processing', 'ready', 'failed', 'hidden', 'deleted');

-- CreateEnum
CREATE TYPE "WecomStatus" AS ENUM ('not_contacted', 'pending_add', 'added', 'rejected');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('new', 'identified', 'converted', 'invalid');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('unassigned', 'pending', 'contacted', 'done');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "openid" TEXT,
    "unionid" TEXT,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "mobile" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'audience',
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveSession" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "coverUrl" TEXT,
    "description" TEXT,
    "roomName" TEXT NOT NULL,
    "status" "LiveStatus" NOT NULL DEFAULT 'draft',
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "actualStartTime" TIMESTAMP(3),
    "actualEndTime" TIMESTAMP(3),
    "hostUserId" TEXT NOT NULL,
    "moderatorIds" TEXT[],
    "enableComment" BOOLEAN NOT NULL DEFAULT true,
    "commentMode" "CommentMode" NOT NULL DEFAULT 'review',
    "enableMicApply" BOOLEAN NOT NULL DEFAULT true,
    "enableRecord" BOOLEAN NOT NULL DEFAULT true,
    "replayUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveParticipant" (
    "id" TEXT NOT NULL,
    "liveId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "livekitIdentity" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "joinTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaveTime" TIMESTAMP(3),
    "watchDuration" INTEGER NOT NULL DEFAULT 0,
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "canPublish" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveComment" (
    "id" TEXT NOT NULL,
    "liveId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "CommentStatus" NOT NULL DEFAULT 'pending',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isHighValueQuestion" BOOLEAN NOT NULL DEFAULT false,
    "visibleToSender" BOOLEAN NOT NULL DEFAULT true,
    "hitSensitiveWords" TEXT[],
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MicRequest" (
    "id" TEXT NOT NULL,
    "liveId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "MicRequestStatus" NOT NULL DEFAULT 'applied',
    "reason" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MicRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveStats" (
    "id" TEXT NOT NULL,
    "liveId" TEXT NOT NULL,
    "pv" INTEGER NOT NULL DEFAULT 0,
    "uv" INTEGER NOT NULL DEFAULT 0,
    "peakOnline" INTEGER NOT NULL DEFAULT 0,
    "currentOnline" INTEGER NOT NULL DEFAULT 0,
    "avgWatchDuration" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "micApplyCount" INTEGER NOT NULL DEFAULT 0,
    "successfulMicCount" INTEGER NOT NULL DEFAULT 0,
    "leadCount" INTEGER NOT NULL DEFAULT 0,
    "replayViewCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LiveStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplayRecord" (
    "id" TEXT NOT NULL,
    "liveId" TEXT NOT NULL,
    "status" "ReplayStatus" NOT NULL DEFAULT 'processing',
    "url" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReplayRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareVisit" (
    "id" TEXT NOT NULL,
    "liveId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'direct',
    "sharedBy" TEXT NOT NULL DEFAULT 'direct',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerFollowUp" (
    "id" TEXT NOT NULL,
    "liveId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "wecomStatus" "WecomStatus" NOT NULL DEFAULT 'not_contacted',
    "leadStage" "LeadStage" NOT NULL DEFAULT 'new',
    "followUpOwnerId" TEXT,
    "followUpStatus" "FollowUpStatus" NOT NULL DEFAULT 'unassigned',
    "followUpNote" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_openid_key" ON "User"("openid");

-- CreateIndex
CREATE UNIQUE INDEX "LiveSession_roomName_key" ON "LiveSession"("roomName");

-- CreateIndex
CREATE INDEX "LiveParticipant_liveId_idx" ON "LiveParticipant"("liveId");

-- CreateIndex
CREATE INDEX "LiveParticipant_userId_idx" ON "LiveParticipant"("userId");

-- CreateIndex
CREATE INDEX "LiveComment_liveId_idx" ON "LiveComment"("liveId");

-- CreateIndex
CREATE INDEX "MicRequest_liveId_idx" ON "MicRequest"("liveId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveStats_liveId_key" ON "LiveStats"("liveId");

-- CreateIndex
CREATE INDEX "ShareVisit_liveId_idx" ON "ShareVisit"("liveId");

-- CreateIndex
CREATE INDEX "ShareVisit_sharedBy_idx" ON "ShareVisit"("sharedBy");

-- CreateIndex
CREATE INDEX "CustomerFollowUp_liveId_idx" ON "CustomerFollowUp"("liveId");

-- CreateIndex
CREATE INDEX "CustomerFollowUp_followUpOwnerId_idx" ON "CustomerFollowUp"("followUpOwnerId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerFollowUp_liveId_customerId_key" ON "CustomerFollowUp"("liveId", "customerId");
