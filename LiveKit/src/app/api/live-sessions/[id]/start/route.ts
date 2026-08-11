import { jsonError, jsonOk } from "@/lib/http";
import { assertLiveTenantAccess, requireAuth } from "@/lib/auth-helpers";
import { getLiveSession, startLiveSession } from "@/lib/live-service";
import { getStore } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const auth = await requireAuth(["host", "director", "super_admin"]);
    const { id } = await ctx.params;
    const store = getStore();
    const live = getLiveSession(store, id);
    assertLiveTenantAccess(auth, live);
    return jsonOk(startLiveSession(store, id, auth.userId));
  } catch (error) {
    return jsonError(error);
  }
}
