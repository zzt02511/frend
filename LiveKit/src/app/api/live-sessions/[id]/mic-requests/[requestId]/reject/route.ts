import { requireLiveManagementAccess } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { rejectMicRequest } from "@/lib/mic-service";
import { getStore } from "@/lib/store";

type Ctx = { params: Promise<{ id: string; requestId: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { id, requestId } = await ctx.params;
    const { auth } = await requireLiveManagementAccess(id, ["host", "moderator", "director", "super_admin"]);
    return jsonOk(rejectMicRequest(getStore(), id, requestId, auth.userId));
  } catch (error) {
    return jsonError(error);
  }
}
