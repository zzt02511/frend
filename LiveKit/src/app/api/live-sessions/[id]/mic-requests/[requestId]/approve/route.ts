import { requireAuth } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { approveMicRequest } from "@/lib/mic-service";
import { getLiveSession } from "@/lib/live-service";
import { getStore } from "@/lib/store";

type Ctx = { params: Promise<{ id: string; requestId: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { userId, role } = await requireAuth(["host", "moderator", "director", "super_admin"]);
    const { id, requestId } = await ctx.params;
    const store = getStore();
    if (role === "host" && getLiveSession(store, id).hostUserId !== userId) {
      throw new Error("AUTH_INSUFFICIENT_ROLE");
    }
    return jsonOk(approveMicRequest(store, id, requestId, userId));
  } catch (error) {
    return jsonError(error);
  }
}
