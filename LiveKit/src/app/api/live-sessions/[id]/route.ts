import { z } from "zod";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { getLiveSession } from "@/lib/live-service";
import { getStore, persistStore } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

const livePatchSchema = z.object({
  title: z.string().min(1).optional(),
  coverUrl: z.string().min(1).optional(),
  description: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  enableComment: z.boolean().optional(),
  commentMode: z.enum(["free", "review", "host_only", "closed"]).optional(),
  enableMicApply: z.boolean().optional(),
  enableRecord: z.boolean().optional(),
});

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    return jsonOk(getLiveSession(getStore(), id));
  } catch (error) {
    return jsonError(error, 404);
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const live = getLiveSession(getStore(), id);
    Object.assign(live, livePatchSchema.parse(await readJson(request)));
    persistStore();
    return jsonOk(live);
  } catch (error) {
    return jsonError(error);
  }
}
