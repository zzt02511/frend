import { AdminConsole } from "@/components/admin-console";
import { assertLiveTenantAccess, requireAuth } from "@/lib/auth-helpers";
import { getCommentAnalytics, withCommentUserNames } from "@/lib/comment-service";
import { getCustomerLeads } from "@/lib/lead-service";
import { getLiveSession, getStats, listOnlineParticipants, withParticipantUserNames } from "@/lib/live-service";
import { withMicRequestUserNames } from "@/lib/mic-service";
import { getShareRanking } from "@/lib/share-service";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function AdminRoomPage({ params }: Props) {
  const auth = await requireAuth(["super_admin", "director", "moderator"]);
  const { id } = await params;
  const store = getStore();
  const live = getLiveSession(store, id);
  assertLiveTenantAccess(auth, live);
  if (auth.role === "moderator" && !live.moderatorIds.includes(auth.userId)) {
    throw new Error("AUTH_INSUFFICIENT_ROLE");
  }

  return (
    <AdminConsole
      liveSessions={[live]}
      initialComments={withCommentUserNames(store, store.comments.filter((item) => item.liveId === live.id))}
      initialMicRequests={withMicRequestUserNames(store, store.micRequests.filter((item) => item.liveId === live.id))}
      initialParticipants={withParticipantUserNames(store, listOnlineParticipants(store, live.id))}
      stats={getStats(store, live.id)}
      initialShareRanking={getShareRanking(store, live.id)}
      initialCommentAnalytics={getCommentAnalytics(store, live.id)}
      initialCustomerLeads={getCustomerLeads(store, live.id)}
      roomScoped
    />
  );
}
