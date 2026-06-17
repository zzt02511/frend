import { z } from "zod";
import { listAudienceComments, listComments, sendComment, withCommentUserNames } from "@/lib/comment-service";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { getStore } from "@/lib/store";

const commentSchema = z.object({
  userId: z.string().default("audience-1"),
  content: z.string().refine((value) => value.trim().length > 0, "COMMENT_EMPTY"),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const store = getStore();
  const viewerId = new URL(request.url).searchParams.get("viewerId");
  const comments = viewerId ? listAudienceComments(store, id, viewerId) : listComments(store, id);
  return jsonOk(withCommentUserNames(store, comments));
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const input = commentSchema.parse(await readJson(request));
    const { id } = await ctx.params;
    const store = getStore();
    return jsonOk(withCommentUserNames(store, [sendComment(store, { liveId: id, ...input })])[0], { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
