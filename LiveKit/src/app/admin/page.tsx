import { AdminConsole } from "@/components/admin-console";
import { getCommentAnalytics } from "@/lib/comment-service";
import { getCustomerLeads } from "@/lib/lead-service";
import { getStats } from "@/lib/live-service";
import { getShareRanking } from "@/lib/share-service";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  const store = getStore();
  const live = store.liveSessions[0];

  return (
    <AdminConsole
      liveSessions={store.liveSessions}
      initialComments={store.comments.filter((item) => item.liveId === live.id)}
      initialMicRequests={store.micRequests.filter((item) => item.liveId === live.id)}
      initialParticipants={store.participants.filter((item) => item.liveId === live.id)}
      stats={getStats(store, live.id)}
      initialShareRanking={getShareRanking(store, live.id)}
      initialCommentAnalytics={getCommentAnalytics(store, live.id)}
      initialCustomerLeads={getCustomerLeads(store, live.id)}
    />
  );
}
