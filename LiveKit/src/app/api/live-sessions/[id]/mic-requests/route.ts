import { z } from "zod";
import { applyForMic, withMicRequestUserNames } from "@/lib/mic-service";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { getStore } from "@/lib/store";
import { getLiveSession } from "@/lib/live-service";
import { requireRoomAccess } from "@/lib/room-access-request";
import { getOptionalAuth, requireLiveManagementAccess } from "@/lib/auth-helpers";

const micSchema = z.object({
  userId: z.string().default("audience-1"),
  reason: z.string().optional().default("希望上麦提问"),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const userId = new URL(request.url).searchParams.get("userId")?.trim();
    const store = getStore();
    const live = getLiveSession(store, id);
    const auth = await getOptionalAuth();
    if (auth) {
      await requireLiveManagementAccess(id, ["host", "moderator", "director", "super_admin"]);
      return jsonOk(withMicRequestUserNames(store, store.micRequests.filter((item) => item.liveId === id)));
    }
    if (!userId) throw new Error("ROOM_ACCESS_REQUIRED");
    requireRoomAccess(request, { live, liveId: id, viewerId: userId });
    return jsonOk(withMicRequestUserNames(store, store.micRequests.filter((item) => item.liveId === id && item.userId === userId)));
  } catch (error) {
    const code = error instanceof Error ? error.message : String(error);
    return jsonError(error, code.startsWith("ROOM_ACCESS_") || code.startsWith("AUTH_") || code === "TENANT_NOT_ACTIVE" ? 403 : 400);
  }
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
