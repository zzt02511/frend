import { getOptionalAuth, requireLiveManagementAccess } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { endMicRequest } from "@/lib/mic-service";
import { getLiveSession } from "@/lib/live-service";
import { requireRoomAccess } from "@/lib/room-access-request";
import { getStore } from "@/lib/store";

type Ctx = { params: Promise<{ id: string; requestId: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { id, requestId } = await ctx.params;
    const store = getStore();
    const micRequest = store.micRequests.find((item) => item.id === requestId && item.liveId === id);
    if (!micRequest) throw new Error("MIC_REQUEST_NOT_FOUND");

    const auth = await getOptionalAuth();
    if (auth) {
      const { auth: verifiedAuth } = await requireLiveManagementAccess(id, ["host", "moderator", "director", "super_admin"]);
      return jsonOk(endMicRequest(store, id, requestId, verifiedAuth.userId));
    }

    {
      requireRoomAccess(request, {
        live: getLiveSession(store, id),
        liveId: id,
        viewerId: micRequest.userId,
      });
    }

    return jsonOk(endMicRequest(store, id, requestId, micRequest.userId));
  } catch (error) {
    const code = error instanceof Error ? error.message : String(error);
    return jsonError(error, code.startsWith("ROOM_ACCESS_") ? 403 : 400);
  }
}
