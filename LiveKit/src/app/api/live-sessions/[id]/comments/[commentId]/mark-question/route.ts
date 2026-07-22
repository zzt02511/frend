import { markHighValueQuestion } from "@/lib/comment-service";
import { requireAuth } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { getStore } from "@/lib/store";

type Ctx = { params: Promise<{ id: string; commentId: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { userId } = await requireAuth(["moderator", "director", "super_admin"]);
    const { id, commentId } = await ctx.params;
    return jsonOk(markHighValueQuestion(getStore(), id, commentId, userId));
  } catch (error) {
    return jsonError(error);
  }
}
