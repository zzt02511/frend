import { jsonError, jsonOk } from "@/lib/http";
import { requireLiveManagementAccess } from "@/lib/auth-helpers";
import { endLiveSession } from "@/lib/live-service";
import { getStore } from "@/lib/store";
import { stopTencentHostEgress } from "@/lib/tencent-egress";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const { auth, live } = await requireLiveManagementAccess(id, ["host", "director", "super_admin"]);
    try {
      await stopTencentHostEgress(live);
    } catch (error) {
      // Tencent forwarding must never prevent the host from ending a live room.
      console.error("Unable to stop Tencent Cloud egress", error);
    }
    return jsonOk(endLiveSession(getStore(), id, auth.userId));
  } catch (error) {
    return jsonError(error);
  }
}
