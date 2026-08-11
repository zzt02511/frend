import { rejectComment } from "@/lib/comment-service";
import { requireLiveManagementAccess } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { getStore } from "@/lib/store";

type Ctx = { params: Promise<{ id: string; commentId: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { id, commentId } = await ctx.params;
    const { auth } = await requireLiveManagementAccess(id, ["moderator", "director", "super_admin"]);
    return jsonOk(rejectComment(getStore(), id, commentId, auth.userId));
  } catch (error) {
    return jsonError(error);
  }
}
