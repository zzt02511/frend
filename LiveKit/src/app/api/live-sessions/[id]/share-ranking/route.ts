import { jsonOk } from "@/lib/http";
import { getShareRanking } from "@/lib/share-service";
import { getStore } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return jsonOk(getShareRanking(getStore(), id));
}
