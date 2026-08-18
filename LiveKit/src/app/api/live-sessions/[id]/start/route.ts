import { jsonError, jsonOk } from "@/lib/http";
import { requireLiveManagementAccess } from "@/lib/auth-helpers";
import { startLiveSession } from "@/lib/live-service";
import { getStore } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const { auth } = await requireLiveManagementAccess(id, ["host", "director", "super_admin"]);
    return jsonOk(startLiveSession(getStore(), id, auth.userId));
  } catch (error) {
    return jsonError(error);
  }
}
