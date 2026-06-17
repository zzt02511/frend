import { jsonOk } from "@/lib/http";
import { getStore } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const replay = getStore().replays.find((item) => item.liveId === id);
  return jsonOk(replay ?? null);
}
