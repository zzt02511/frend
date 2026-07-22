import { requireAuth } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { kickParticipant, withParticipantUserNames } from "@/lib/live-service";
import { getStore } from "@/lib/store";

type Ctx = { params: Promise<{ id: string; participantId: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { userId } = await requireAuth(["moderator", "director", "super_admin"]);
    const { id, participantId } = await ctx.params;
    const store = getStore();
    return jsonOk(withParticipantUserNames(store, [kickParticipant(store, id, participantId, userId)])[0]);
  } catch (error) {
    return jsonError(error);
  }
}
