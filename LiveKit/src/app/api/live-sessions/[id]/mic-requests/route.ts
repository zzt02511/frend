import { z } from "zod";
import { applyForMic } from "@/lib/mic-service";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { getStore } from "@/lib/store";

const micSchema = z.object({
  userId: z.string().default("audience-1"),
  reason: z.string().optional().default("希望上麦提问"),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const userId = new URL(request.url).searchParams.get("userId");
  return jsonOk(
    getStore().micRequests.filter((item) => item.liveId === id && (!userId || item.userId === userId)),
  );
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const input = micSchema.parse(await readJson(request));
    const { id } = await ctx.params;
    return jsonOk(applyForMic(getStore(), { liveId: id, ...input }), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
