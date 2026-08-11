import { jsonError, jsonOk } from "@/lib/http";
import { assertLiveTenantAccess, requireAuth } from "@/lib/auth-helpers";
import { endLiveSession } from "@/lib/live-service";
import { getStore } from "@/lib/store";
import { getLiveSession } from "@/lib/live-service";
import { stopTencentHostEgress } from "@/lib/tencent-egress";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const auth = await requireAuth(["host", "director", "super_admin"]);
    const { id } = await ctx.params;
    const store = getStore();
    const live = getLiveSession(store, id);
    assertLiveTenantAccess(auth, live);
    try {
      await stopTencentHostEgress(live);
    } catch (error) {
      // Tencent forwarding must never prevent the host from ending a live room.
      console.error("Unable to stop Tencent Cloud egress", error);
    }
    return jsonOk(endLiveSession(store, id, auth.userId));
  } catch (error) {
    return jsonError(error);
  }
}
