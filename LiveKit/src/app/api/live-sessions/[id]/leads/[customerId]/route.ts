import { z } from "zod";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { getCustomerLeads, updateCustomerFollowUp } from "@/lib/lead-service";
import { getStore } from "@/lib/store";

const followUpSchema = z.object({
  wecomStatus: z.enum(["not_contacted", "pending_add", "added", "rejected"]).optional(),
  leadStage: z.enum(["new", "identified", "converted", "invalid"]).optional(),
  followUpOwnerId: z.string().optional(),
  followUpStatus: z.enum(["unassigned", "pending", "contacted", "done"]).optional(),
  followUpNote: z.string().optional(),
});

type Ctx = { params: Promise<{ id: string; customerId: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const { id, customerId } = await ctx.params;
    const store = getStore();
    updateCustomerFollowUp(store, id, decodeURIComponent(customerId), followUpSchema.parse(await readJson(request)));
    const lead = getCustomerLeads(store, id).find((item) => item.customerId === decodeURIComponent(customerId));
    return jsonOk(lead);
  } catch (error) {
    return jsonError(error);
  }
}
