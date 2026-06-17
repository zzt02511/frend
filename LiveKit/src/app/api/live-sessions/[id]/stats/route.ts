import { jsonOk } from "@/lib/http";
import { getStats } from "@/lib/live-service";
import { getStore } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return jsonOk(getStats(getStore(), id));
}
