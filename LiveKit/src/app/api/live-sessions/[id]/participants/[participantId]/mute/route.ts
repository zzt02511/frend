import { jsonError, jsonOk, readJson } from "@/lib/http";
import { muteParticipant, withParticipantUserNames } from "@/lib/live-service";
import { getStore } from "@/lib/store";

type Ctx = { params: Promise<{ id: string; participantId: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { actorId = "moderator-1" } = await readJson<{ actorId?: string }>(request);
    const { id, participantId } = await ctx.params;
    const store = getStore();
    return jsonOk(withParticipantUserNames(store, [muteParticipant(store, id, participantId, actorId)])[0]);
  } catch (error) {
    return jsonError(error);
  }
}
