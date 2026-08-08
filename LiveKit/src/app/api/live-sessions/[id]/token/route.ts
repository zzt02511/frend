import { z } from "zod";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { createAccessToken } from "@/lib/live-service";
import { getStore } from "@/lib/store";
import { getLiveSession } from "@/lib/live-service";
import { requireRoomAccess } from "@/lib/room-access-request";
import { requireAuth } from "@/lib/auth-helpers";

const tokenSchema = z.object({
  userId: z.string().default("audience-1"),
  role: z.enum(["super_admin", "director", "host", "moderator", "audience"]).default("audience"),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const input = tokenSchema.parse(await readJson(request));
    const { id } = await ctx.params;
    const store = getStore();
    const live = getLiveSession(store, id);
    if (input.role === "audience") {
      requireRoomAccess(request, { live, liveId: id, viewerId: input.userId });
    } else {
      const auth = await requireAuth(["super_admin", "director", "host", "moderator"]);
      if (auth.userId !== input.userId || auth.role !== input.role) {
        throw new Error("AUTH_IDENTITY_MISMATCH");
      }
      if (auth.role === "host" && live.hostUserId !== auth.userId) {
        throw new Error("AUTH_INSUFFICIENT_ROLE");
      }
    }
    return jsonOk(await createAccessToken(store, { liveId: id, ...input }));
  } catch (error) {
    const code = error instanceof Error ? error.message : String(error);
    const status = code.startsWith("ROOM_ACCESS_") || code.startsWith("AUTH_") ? 403 : 400;
    return jsonError(error, status);
  }
}
