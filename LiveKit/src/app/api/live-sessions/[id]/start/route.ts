import { jsonError, jsonOk } from "@/lib/http";
import { requireAuth } from "@/lib/auth-helpers";
import { startLiveSession } from "@/lib/live-service";
import { getStore } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { userId } = await requireAuth(["host", "director", "super_admin"]);
    const { id } = await ctx.params;
    return jsonOk(startLiveSession(getStore(), id, userId));
  } catch (error) {
    return jsonError(error);
  }
}
