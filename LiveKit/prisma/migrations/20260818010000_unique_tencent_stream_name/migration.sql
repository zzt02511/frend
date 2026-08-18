ALTER TABLE "LiveSession" ADD COLUMN IF NOT EXISTS "tencentStreamName" TEXT;

UPDATE "LiveSession"
SET "tencentStreamName" = id
WHERE "tencentStreamName" IS NULL;

UPDATE "LiveSession"
SET "cdnPlayUrl" = 'webrtc://play.fuguilong.cn/live/' || "tencentStreamName"
WHERE "cdnPlayUrl" IS NULL OR "cdnPlayUrl" = '';

CREATE UNIQUE INDEX IF NOT EXISTS "LiveSession_tencentStreamName_key"
ON "LiveSession"("tencentStreamName");
