import { z } from "zod";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { requireAuth } from "@/lib/auth-helpers";
import { deleteLiveSession, getLiveSession, updateLiveSession } from "@/lib/live-service";
import { getStore } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

const livePatchSchema = z.object({
  title: z.string().min(1).optional(),
  coverUrl: z.string().min(1).optional(),
  description: z.string().optional(),
  cdnPlayUrl: z.string().trim().min(1).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  enableComment: z.boolean().optional(),
  commentMode: z.enum(["free", "review", "host_only", "closed"]).optional(),
  enableMicApply: z.boolean().optional(),
  enableRecord: z.boolean().optional(),
  accessPassword: z.string().optional(),
  clearPassword: z.boolean().optional(),
});

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const live = getLiveSession(getStore(), id);
    return jsonOk({ ...live, accessPassword: undefined });
  } catch (error) {
    return jsonError(error, 404);
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    return jsonOk(updateLiveSession(getStore(), id, livePatchSchema.parse(await readJson(request))));
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    const { userId } = await requireAuth(["director", "super_admin", "moderator"]);
    const { id } = await ctx.params;
    return jsonOk(deleteLiveSession(getStore(), id, userId));
  } catch (error) {
    return jsonError(error);
  }
}
