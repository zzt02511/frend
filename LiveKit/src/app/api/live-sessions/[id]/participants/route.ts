import { jsonOk } from "@/lib/http";
import { listOnlineParticipants, withParticipantUserNames } from "@/lib/live-service";
import { getStore } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const store = getStore();
  return jsonOk(withParticipantUserNames(store, listOnlineParticipants(store, id)));
}
