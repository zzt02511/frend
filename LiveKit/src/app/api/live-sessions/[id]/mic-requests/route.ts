import { z } from "zod";
import { applyForMic, withMicRequestUserNames } from "@/lib/mic-service";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { getStore } from "@/lib/store";
import { getLiveSession } from "@/lib/live-service";
import { requireRoomAccess } from "@/lib/room-access-request";

const micSchema = z.object({
  userId: z.string().default("audience-1"),
  reason: z.string().optional().default("希望上麦提问"),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const userId = new URL(request.url).searchParams.get("userId");
  const store = getStore();
  return jsonOk(
    withMicRequestUserNames(
      store,
      store.micRequests.filter((item) => item.liveId === id && (!userId || item.userId === userId)),
    ),
  );
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const input = micSchema.parse(await readJson(request));
    const { id } = await ctx.params;
    const store = getStore();
    const live = getLiveSession(store, id);
    requireRoomAccess(request, { live, liveId: id, viewerId: input.userId });
    return jsonOk(withMicRequestUserNames(store, [applyForMic(store, { liveId: id, ...input })])[0], { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : String(error);
    return jsonError(error, code.startsWith("ROOM_ACCESS_") ? 403 : 400);
  }
}
