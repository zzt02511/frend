import { approveComment } from "@/lib/comment-service";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { getStore } from "@/lib/store";

type Ctx = { params: Promise<{ id: string; commentId: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { actorId = "moderator-1" } = await readJson<{ actorId?: string }>(request);
    const { id, commentId } = await ctx.params;
    return jsonOk(approveComment(getStore(), id, commentId, actorId));
  } catch (error) {
    return jsonError(error);
  }
}
