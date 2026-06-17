import { jsonError, jsonOk, readJson } from "@/lib/http";
import { startLiveSession } from "@/lib/live-service";
import { getStore } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { actorId = "host-1" } = await readJson<{ actorId?: string }>(request);
    const { id } = await ctx.params;
    return jsonOk(startLiveSession(getStore(), id, actorId));
  } catch (error) {
    return jsonError(error);
  }
}
