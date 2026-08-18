import { z } from "zod";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { createId } from "@/lib/domain";
import { getStore, persistStore } from "@/lib/store";
import { requireAuth } from "@/lib/auth-helpers";
import { encryptRoomPassword } from "@/lib/room-password";
import { toPublicLiveSession } from "@/lib/live-dto";

const createLiveSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional().default(""),
  startTime: z.string().optional(),
  accessPassword: z.string().optional(),
  hostUserId: z.string().min(1).optional(),
});

export async function GET() {
  const sessions = getStore().liveSessions.map(toPublicLiveSession);
  return jsonOk(sessions);
}

export async function POST(request: Request) {
  try {
    const actor = await requireAuth(["super_admin", "director"]);
    const input = createLiveSchema.parse(await readJson(request));
    const store = getStore();
    const host = store.users.find((user) => user.id === input.hostUserId && user.role === "host" && user.status === "active")
      ?? store.users.find((user) => user.role === "host" && user.status === "active" && (actor.role === "super_admin" || user.tenantId === (actor.tenantId ?? "default-tenant")));
    if (!host) throw new Error("HOST_USER_NOT_FOUND");
    const tenantId = actor.role === "super_admin" ? host.tenantId : actor.tenantId ?? "default-tenant";
    if (!tenantId || host.tenantId !== tenantId) throw new Error("AUTH_TENANT_ACCESS_DENIED");
    const id = createId("live");
    const live = {
      id,
      title: input.title,
      coverUrl: "/window.svg",
      description: input.description,
      roomName: `private-${id}`,
      status: "scheduled" as const,
      startTime: input.startTime ?? new Date().toISOString(),
      hostUserId: host.id,
      tenantId,
      moderatorIds: store.users.filter((user) => user.role === "moderator" && user.tenantId === tenantId && user.status === "active").map((user) => user.id),
      enableComment: true,
      commentMode: "review" as const,
      enableMicApply: true,
      enableRecord: true,
      ...(input.accessPassword
        ? {
            accessPasswordCiphertext: encryptRoomPassword(
              input.accessPassword,
              process.env.ROOM_PASSWORD_ENCRYPTION_KEY ?? "",
            ),
            accessPasswordVersion: 1,
          }
        : {}),
    };
    store.liveSessions.unshift(live);
    store.stats.push({
      id: `stats-${id}`,
      liveId: id,
      pv: 0,
      uv: 0,
      peakOnline: 0,
      currentOnline: 0,
      avgWatchDuration: 0,
      commentCount: 0,
      likeCount: 0,
      micApplyCount: 0,
      successfulMicCount: 0,
      leadCount: 0,
      replayViewCount: 0,
    });
    persistStore(store);
    return jsonOk(toPublicLiveSession(live), { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : String(error);
    return jsonError(error, code === "AUTH_REQUIRED" ? 401 : code === "AUTH_INSUFFICIENT_ROLE" ? 403 : 400);
  }
}
