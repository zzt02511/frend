-- Bring the initial production schema in line with the authenticated live-room domain.
ALTER TABLE "User"
ADD COLUMN "passwordHash" TEXT;

ALTER TABLE "LiveSession"
ADD COLUMN "cdnPlayUrl" TEXT,
ADD COLUMN "accessPasswordCiphertext" TEXT,
ADD COLUMN "accessPasswordVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "LiveParticipant"
ADD COLUMN "userName" TEXT,
ADD COLUMN "lastActiveAt" TIMESTAMP(3);

ALTER TABLE "LiveComment"
ADD COLUMN "userName" TEXT;

ALTER TABLE "MicRequest"
ADD COLUMN "userName" TEXT;
