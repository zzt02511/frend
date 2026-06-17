import { jsonError, jsonOk, readJson } from "@/lib/http";
import { approveMicRequest } from "@/lib/mic-service";
import { getStore } from "@/lib/store";

type Ctx = { params: Promise<{ id: string; requestId: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { actorId = "moderator-1" } = await readJson<{ actorId?: string }>(request);
    const { id, requestId } = await ctx.params;
    return jsonOk(approveMicRequest(getStore(), id, requestId, actorId));
  } catch (error) {
    return jsonError(error);
  }
}
