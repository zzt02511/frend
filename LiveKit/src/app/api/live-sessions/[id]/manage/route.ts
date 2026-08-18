import { assertLiveTenantAccess, requireAuth } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { toManagementLiveSession } from "@/lib/live-dto";
import { getLiveSession } from "@/lib/live-service";
import { getStore } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const auth = await requireAuth(["super_admin", "director", "moderator"]);
    const { id } = await ctx.params;
    const live = getLiveSession(getStore(), id);
    assertLiveTenantAccess(auth, live);
    if (auth.role === "moderator" && !live.moderatorIds.includes(auth.userId)) throw new Error("AUTH_INSUFFICIENT_ROLE");
    return jsonOk(
      toManagementLiveSession(live, process.env.ROOM_PASSWORD_ENCRYPTION_KEY ?? ""),
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : String(error);
    const status = code === "AUTH_REQUIRED" ? 401 : code === "AUTH_INSUFFICIENT_ROLE" ? 403 : 400;
    return jsonError(error, status);
  }
}
