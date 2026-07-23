import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { getLiveSession } from "@/lib/live-service";
import { issueRoomAccessToken, roomAccessCookieName } from "@/lib/room-access";
import { decryptRoomPassword } from "@/lib/room-password";
import { getStore } from "@/lib/store";

const inputSchema = z.object({
  viewerId: z.string().trim().min(1).max(100),
  password: z.string().max(200),
});

type Ctx = { params: Promise<{ id: string }> };

function passwordDigest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

function matchesPassword(actual: string, expected: string) {
  return timingSafeEqual(passwordDigest(actual), passwordDigest(expected));
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const input = inputSchema.parse(await readJson(request));
    const { id } = await ctx.params;
    const live = getLiveSession(getStore(), id);
    const expectedPassword = live.accessPasswordCiphertext
      ? decryptRoomPassword(
          live.accessPasswordCiphertext,
          process.env.ROOM_PASSWORD_ENCRYPTION_KEY ?? "",
        )
      : live.accessPassword;

    if (expectedPassword && !matchesPassword(input.password, expectedPassword)) {
      return jsonError("ACCESS_PASSWORD_INCORRECT", 403);
    }

    const maxAge = 2 * 60 * 60;
    const token = issueRoomAccessToken(
      {
        liveId: id,
        viewerId: input.viewerId,
        passwordVersion: live.accessPasswordVersion ?? 0,
      },
      { secret: process.env.AUTH_SECRET ?? "", ttlSeconds: maxAge },
    );
    const response = jsonOk({ verified: true });
    response.headers.append(
      "Set-Cookie",
      `${roomAccessCookieName(id)}=${token}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${
        process.env.NODE_ENV === "production" ? "; Secure" : ""
      }`,
    );
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
