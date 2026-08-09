import { jsonError, jsonOk } from "@/lib/http";
import { requireAuth } from "@/lib/auth-helpers";
import { getLiveSession } from "@/lib/live-service";
import { getStore } from "@/lib/store";
import { startTencentHostEgress } from "@/lib/tencent-egress";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  try {
    const { userId } = await requireAuth(["host", "director", "super_admin"]);
    const { id } = await ctx.params;
    const live = getLiveSession(getStore(), id);
    if (userId !== live.hostUserId) throw new Error("AUTH_INSUFFICIENT_ROLE");
    return jsonOk(await startTencentHostEgress(live));
  } catch (error) {
    return jsonError(error);
  }
}
