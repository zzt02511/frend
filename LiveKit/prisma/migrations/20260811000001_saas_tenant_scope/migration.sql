ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "LiveSession" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'default-tenant';
UPDATE "User" SET "tenantId" = 'default-tenant' WHERE "role" IN ('director', 'host', 'moderator') AND "tenantId" IS NULL;
CREATE INDEX IF NOT EXISTS "User_tenantId_idx" ON "User"("tenantId");
CREATE INDEX IF NOT EXISTS "LiveSession_tenantId_idx" ON "LiveSession"("tenantId");
