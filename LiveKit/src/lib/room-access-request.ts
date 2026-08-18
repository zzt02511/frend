import type { LiveSession } from "./domain";
import { roomAccessCookieName, verifyRoomAccessToken } from "./room-access";

function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  for (const item of header.split(";")) {
    const [cookieName, ...valueParts] = item.trim().split("=");
    if (cookieName === name) return valueParts.join("=");
  }
  return undefined;
}

export function requireRoomAccess(
  request: Request,
  input: { live: LiveSession; liveId: string; viewerId: string },
) {
  if (!input.live.accessPassword && !input.live.accessPasswordCiphertext) return;

  const token = readCookie(request, roomAccessCookieName(input.liveId));
  if (!token) throw new Error("ROOM_ACCESS_REQUIRED");

  verifyRoomAccessToken(token, {
    secret: process.env.AUTH_SECRET ?? "",
    liveId: input.liveId,
    viewerId: input.viewerId,
    passwordVersion: input.live.accessPasswordVersion ?? 0,
  });
}
