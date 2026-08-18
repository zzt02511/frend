import { z } from "zod";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { getLiveSession, joinLiveSession } from "@/lib/live-service";
import { requireRoomAccess } from "@/lib/room-access-request";
import { getStore } from "@/lib/store";

const joinSchema = z.object({
  userId: z.string().default("audience-1"),
  displayName: z.string().trim().min(1).max(40).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const input = joinSchema.parse(await readJson(request));
    const { id } = await ctx.params;
    const store = getStore();
    const live = getLiveSession(store, id);
    requireRoomAccess(request, { live, liveId: id, viewerId: input.userId });
    return jsonOk(joinLiveSession(store, { liveId: id, ...input, role: "audience" }));
  } catch (error) {
    const code = error instanceof Error ? error.message : String(error);
    return jsonError(error, code.startsWith("ROOM_ACCESS_") ? 403 : 400);
  }
}
