import { z } from "zod";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { createId } from "@/lib/domain";
import { getStore, persistStore } from "@/lib/store";

const createLiveSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional().default(""),
  startTime: z.string().optional(),
  accessPassword: z.string().optional(),
  hostUserId: z.string().optional().default("host-1"),
});

export async function GET() {
  const sessions = getStore().liveSessions.map((item) => ({ ...item, accessPassword: undefined }));
  return jsonOk(sessions);
}

export async function POST(request: Request) {
  try {
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
      ...(input.accessPassword ? { accessPassword: input.accessPassword } : {}),
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
    return jsonOk(live, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
