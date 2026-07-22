import { requireAuth } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { rejectMicRequest } from "@/lib/mic-service";
import { getStore } from "@/lib/store";

type Ctx = { params: Promise<{ id: string; requestId: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { userId } = await requireAuth(["moderator", "director", "super_admin"]);
    const { id, requestId } = await ctx.params;
    return jsonOk(rejectMicRequest(getStore(), id, requestId, userId));
  } catch (error) {
    return jsonError(error);
  }
}
