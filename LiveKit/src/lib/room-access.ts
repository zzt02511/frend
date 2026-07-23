import { createHash, createHmac, timingSafeEqual } from "node:crypto";

type RoomAccessPayload = {
  v: 1;
  liveId: string;
  viewerId: string;
  passwordVersion: number;
  iat: number;
  exp: number;
};

type IssueOptions = {
  secret: string;
  now?: number;
  ttlSeconds?: number;
};

type VerifyOptions = {
  secret: string;
  now?: number;
  liveId: string;
  viewerId: string;
  passwordVersion: number;
};

function signingKey(secret: string) {
  if (secret.length < 24) throw new Error("ROOM_ACCESS_SECRET_INVALID");
  return createHmac("sha256", secret).update("wechat-live-room-access-v1").digest();
}

function sign(encodedPayload: string, secret: string) {
  return createHmac("sha256", signingKey(secret)).update(encodedPayload).digest("base64url");
}

export function roomAccessCookieName(liveId: string) {
  const suffix = createHash("sha256").update(liveId).digest("hex").slice(0, 16);
  return `wechat-live-room-${suffix}`;
}

export function issueRoomAccessToken(
  input: Pick<RoomAccessPayload, "liveId" | "viewerId" | "passwordVersion">,
  options: IssueOptions,
) {
  const issuedAt = options.now ?? Math.floor(Date.now() / 1000);
  const payload: RoomAccessPayload = {
    v: 1,
    ...input,
    iat: issuedAt,
    exp: issuedAt + (options.ttlSeconds ?? 2 * 60 * 60),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload, options.secret)}`;
}

export function verifyRoomAccessToken(token: string, options: VerifyOptions): RoomAccessPayload {
  try {
    const [encodedPayload, encodedSignature, extra] = token.split(".");
    if (!encodedPayload || !encodedSignature || extra) throw new Error("INVALID_FORMAT");

    const expectedSignature = Buffer.from(sign(encodedPayload, options.secret), "base64url");
    const actualSignature = Buffer.from(encodedSignature, "base64url");
    if (
      expectedSignature.length !== actualSignature.length ||
      !timingSafeEqual(expectedSignature, actualSignature)
    ) {
      throw new Error("INVALID_SIGNATURE");
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as RoomAccessPayload;
    const now = options.now ?? Math.floor(Date.now() / 1000);
    if (payload.exp < now) throw new Error("ROOM_ACCESS_EXPIRED");
    if (
      payload.v !== 1 ||
      payload.liveId !== options.liveId ||
      payload.viewerId !== options.viewerId ||
      payload.passwordVersion !== options.passwordVersion
    ) {
      throw new Error("ROOM_ACCESS_INVALID");
    }
    return payload;
  } catch (error) {
    if (error instanceof Error && error.message === "ROOM_ACCESS_EXPIRED") throw error;
    if (error instanceof Error && error.message === "ROOM_ACCESS_SECRET_INVALID") throw error;
    throw new Error("ROOM_ACCESS_INVALID");
  }
}
