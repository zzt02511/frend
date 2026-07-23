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
  hostUserId: z.string().optional().default("host-1"),
});

export async function GET() {
  const sessions = getStore().liveSessions.map(toPublicLiveSession);
  return jsonOk(sessions);
}

export async function POST(request: Request) {
  try {
    await requireAuth(["super_admin", "director", "moderator"]);
    const input = createLiveSchema.parse(await readJson(request));
    const store = getStore();
    const id = createId("live");
    const live = {
      id,
      title: input.title,
      coverUrl: "/window.svg",
      description: input.description,
      roomName: `private-${id}`,
      status: "scheduled" as const,
      startTime: input.startTime ?? new Date().toISOString(),
      hostUserId: input.hostUserId,
      moderatorIds: ["moderator-1", "director-1"],
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
