import { z } from "zod";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { joinLiveSession } from "@/lib/live-service";
import { getStore } from "@/lib/store";

const joinSchema = z.object({
  userId: z.string().default("audience-1"),
  role: z.enum(["super_admin", "director", "host", "moderator", "audience"]).default("audience"),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const input = joinSchema.parse(await readJson(request));
    const { id } = await ctx.params;
    return jsonOk(joinLiveSession(getStore(), { liveId: id, ...input }));
  } catch (error) {
    return jsonError(error);
  }
}
