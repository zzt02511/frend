import { z } from "zod";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { recordParticipantHeartbeat } from "@/lib/live-service";
import { getStore } from "@/lib/store";

const heartbeatSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["audience", "host", "moderator", "director", "super_admin"]).default("audience"),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const input = heartbeatSchema.parse(await readJson(request));
    return jsonOk(recordParticipantHeartbeat(getStore(), { liveId: id, ...input }));
  } catch (error) {
    return jsonError(error);
  }
}
