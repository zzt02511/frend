import { z } from "zod";
import { recordAudienceEvent, withCommentUserNames } from "@/lib/comment-service";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { getStore } from "@/lib/store";

const audienceEventSchema = z.object({
  userId: z.string().min(1),
  type: z.enum(["join", "like"]),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const input = audienceEventSchema.parse(await readJson(request));
    const { id } = await ctx.params;
    const store = getStore();
    const comment = recordAudienceEvent(store, { liveId: id, ...input });
    return jsonOk(withCommentUserNames(store, [comment])[0], { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
