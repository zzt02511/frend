import { jsonError, jsonOk } from "@/lib/http";
import { requireLiveManagementAccess } from "@/lib/auth-helpers";
import { startTencentHostEgress } from "@/lib/tencent-egress";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const { live } = await requireLiveManagementAccess(id, ["host", "director", "super_admin"]);
    console.info("[egress/start] requested", { liveId: live.id, roomName: live.roomName });
    const egress = await startTencentHostEgress(live);
    console.info("[egress/start] active", { liveId: live.id, egressId: egress.egressId });
    return jsonOk(egress);
  } catch (error) {
    console.error("[egress/start] failed", { error: error instanceof Error ? error.message : String(error) });
    return jsonError(error);
  }
}
