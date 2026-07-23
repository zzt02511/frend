import { z } from "zod";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { getLiveSession, recordParticipantHeartbeat } from "@/lib/live-service";
import { requireRoomAccess } from "@/lib/room-access-request";
import { getStore } from "@/lib/store";

const heartbeatSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["audience", "host", "moderator", "director", "super_admin"]).default("audience"),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const input = heartbeatSchema.parse(await readJson(request));
    const store = getStore();
    const live = getLiveSession(store, id);
    requireRoomAccess(request, { live, liveId: id, viewerId: input.userId });
    return jsonOk(recordParticipantHeartbeat(store, { liveId: id, ...input }));
  } catch (error) {
    const code = error instanceof Error ? error.message : String(error);
    return jsonError(error, code.startsWith("ROOM_ACCESS_") ? 403 : 400);
  }
}
