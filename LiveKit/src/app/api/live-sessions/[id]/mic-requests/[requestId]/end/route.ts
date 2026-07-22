import { requireAuth } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { endMicRequest } from "@/lib/mic-service";
import { getStore } from "@/lib/store";

type Ctx = { params: Promise<{ id: string; requestId: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { userId } = await requireAuth();
    const { id, requestId } = await ctx.params;
    return jsonOk(endMicRequest(getStore(), id, requestId, userId));
  } catch (error) {
    return jsonError(error);
  }
}
