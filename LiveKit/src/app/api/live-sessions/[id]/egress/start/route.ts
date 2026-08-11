import { jsonError, jsonOk } from "@/lib/http";
import { requireLiveManagementAccess } from "@/lib/auth-helpers";
import { startTencentHostEgress } from "@/lib/tencent-egress";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const { live } = await requireLiveManagementAccess(id, ["host", "director", "super_admin"]);
    return jsonOk(await startTencentHostEgress(live));
  } catch (error) {
    return jsonError(error);
  }
}
