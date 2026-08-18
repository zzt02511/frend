import { z } from "zod";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { assertLiveTenantAccess, requireAuth } from "@/lib/auth-helpers";
import { deleteLiveSession, getLiveSession, updateLiveSession } from "@/lib/live-service";
import { getStore } from "@/lib/store";
import { encryptRoomPassword } from "@/lib/room-password";
import { toPublicLiveSession } from "@/lib/live-dto";

type Ctx = { params: Promise<{ id: string }> };

function routeErrorStatus(error: unknown) {
  const code = error instanceof Error ? error.message : String(error);
  if (code === "AUTH_REQUIRED") return 401;
  if (code === "AUTH_INSUFFICIENT_ROLE") return 403;
  return 400;
}

const livePatchSchema = z.object({
  title: z.string().min(1).optional(),
  coverUrl: z.string().min(1).optional(),
  description: z.string().optional(),
  cdnPlayUrl: z.string().trim().min(1).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  enableComment: z.boolean().optional(),
  commentMode: z.enum(["free", "review", "host_only", "closed"]).optional(),
  enableMicApply: z.boolean().optional(),
  enableRecord: z.boolean().optional(),
  accessPassword: z.string().optional(),
  clearPassword: z.boolean().optional(),
});

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const live = getLiveSession(getStore(), id);
    return jsonOk(toPublicLiveSession(live));
  } catch (error) {
    return jsonError(error, 404);
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const auth = await requireAuth(["director", "super_admin"]);
    const { id } = await ctx.params;
    const store = getStore();
    const live = getLiveSession(store, id);
    assertLiveTenantAccess(auth, live);
    const { accessPassword, clearPassword, ...editablePatch } = livePatchSchema.parse(await readJson(request));
    const passwordPatch = clearPassword
      ? {
          accessPassword: undefined,
          accessPasswordCiphertext: undefined,
          accessPasswordVersion: (live.accessPasswordVersion ?? 0) + 1,
        }
      : accessPassword
        ? {
            accessPassword: undefined,
            accessPasswordCiphertext: encryptRoomPassword(
              accessPassword,
              process.env.ROOM_PASSWORD_ENCRYPTION_KEY ?? "",
            ),
            accessPasswordVersion: (live.accessPasswordVersion ?? 0) + 1,
          }
        : {};
    return jsonOk(toPublicLiveSession(updateLiveSession(store, id, { ...editablePatch, ...passwordPatch })));
  } catch (error) {
    return jsonError(error, routeErrorStatus(error));
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    const auth = await requireAuth(["director", "super_admin"]);
    const { id } = await ctx.params;
    const store = getStore();
    const live = getLiveSession(store, id);
    assertLiveTenantAccess(auth, live);
    return jsonOk(deleteLiveSession(store, id, auth.userId));
  } catch (error) {
    return jsonError(error, routeErrorStatus(error));
  }
}
