import { z } from "zod";
import { listAudienceComments, listPublicComments, sendComment, withCommentUserNames } from "@/lib/comment-service";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { getStore } from "@/lib/store";
import { getLiveSession } from "@/lib/live-service";
import { requireRoomAccess } from "@/lib/room-access-request";
import { getOptionalAuth, requireLiveManagementAccess } from "@/lib/auth-helpers";

const commentSchema = z.object({
  userId: z.string().default("audience-1"),
  content: z.string().max(500).refine((value) => value.trim().length > 0, "COMMENT_EMPTY"),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const store = getStore();
    const live = getLiveSession(store, id);
    const viewerId = new URL(request.url).searchParams.get("viewerId")?.trim();
    const auth = await getOptionalAuth();
    if (auth) {
      await requireLiveManagementAccess(id, ["host", "moderator", "director", "super_admin"]);
      return jsonOk(withCommentUserNames(store, store.comments.filter((item) => item.liveId === id && item.status !== "deleted")));
    }
    if (viewerId) {
      requireRoomAccess(request, { live, liveId: id, viewerId });
      return jsonOk(withCommentUserNames(store, listAudienceComments(store, id, viewerId)));
    }
    return jsonOk(withCommentUserNames(store, listPublicComments(store, id)));
  } catch (error) {
    const code = error instanceof Error ? error.message : String(error);
    return jsonError(error, code.startsWith("ROOM_ACCESS_") || code.startsWith("AUTH_") || code === "TENANT_NOT_ACTIVE" ? 403 : 400);
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const input = commentSchema.parse(await readJson(request));
    const { id } = await ctx.params;
    const store = getStore();
    const live = getLiveSession(store, id);
    requireRoomAccess(request, { live, liveId: id, viewerId: input.userId });
    return jsonOk(withCommentUserNames(store, [sendComment(store, { liveId: id, ...input })])[0], { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : String(error);
    return jsonError(error, code.startsWith("ROOM_ACCESS_") ? 403 : 400);
  }
}
