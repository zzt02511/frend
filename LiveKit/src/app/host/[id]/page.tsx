import { MobileHostConsole } from "@/components/mobile-host-console";
import { requireAuth } from "@/lib/auth-helpers";
import { listPublicComments, withCommentUserNames } from "@/lib/comment-service";
import { getLiveSession, getStats } from "@/lib/live-service";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function HostRoomPage({ params }: Props) {
  const { userId } = await requireAuth(["host"]);
  const { id } = await params;
  const store = getStore();
  const live = getLiveSession(store, id);
  if (live.hostUserId !== userId) throw new Error("AUTH_INSUFFICIENT_ROLE");

  const comments = withCommentUserNames(store, listPublicComments(store, live.id));
  const micRequests = store.micRequests.filter((item) => item.liveId === live.id);

  return <MobileHostConsole live={live} comments={comments} stats={getStats(store, live.id)} micRequests={micRequests} />;
}
