import { AdminConsole } from "@/components/admin-console";
import { getCommentAnalytics, withCommentUserNames } from "@/lib/comment-service";
import { getCustomerLeads } from "@/lib/lead-service";
import { getStats, listOnlineParticipants, withParticipantUserNames } from "@/lib/live-service";
import { withMicRequestUserNames } from "@/lib/mic-service";
import { getShareRanking } from "@/lib/share-service";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  const store = getStore();
  const live = store.liveSessions[0];

  return (
    <AdminConsole
      liveSessions={store.liveSessions}
      initialComments={withCommentUserNames(store, store.comments.filter((item) => item.liveId === live.id))}
      initialMicRequests={withMicRequestUserNames(store, store.micRequests.filter((item) => item.liveId === live.id))}
      initialParticipants={withParticipantUserNames(store, listOnlineParticipants(store, live.id))}
      stats={getStats(store, live.id)}
      initialShareRanking={getShareRanking(store, live.id)}
      initialCommentAnalytics={getCommentAnalytics(store, live.id)}
      initialCustomerLeads={getCustomerLeads(store, live.id)}
    />
  );
}
