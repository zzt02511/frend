import { getCommentAnalytics } from "@/lib/comment-service";
import { jsonError, jsonOk } from "@/lib/http";
import { getStore } from "@/lib/store";
import { requireLiveManagementAccess } from "@/lib/auth-helpers";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    await requireLiveManagementAccess(id, ["moderator", "director", "super_admin"]);
    return jsonOk(getCommentAnalytics(getStore(), id));
  } catch (error) {
    return jsonError(error, 403);
  }
}
