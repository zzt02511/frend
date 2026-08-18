import { requireLiveManagementAccess } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { unmuteParticipant, withParticipantUserNames } from "@/lib/live-service";
import { getStore } from "@/lib/store";

type Ctx = { params: Promise<{ id: string; participantId: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { id, participantId } = await ctx.params;
    const { auth } = await requireLiveManagementAccess(id, ["moderator", "director", "super_admin"]);
    const store = getStore();
    return jsonOk(withParticipantUserNames(store, [unmuteParticipant(store, id, participantId, auth.userId)])[0]);
  } catch (error) {
    return jsonError(error);
  }
}
