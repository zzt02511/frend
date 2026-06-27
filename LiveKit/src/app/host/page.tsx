import { MobileHostConsole } from "@/components/mobile-host-console";
import { listPublicComments, withCommentUserNames } from "@/lib/comment-service";
import { getStats, selectHostConsoleLiveSession } from "@/lib/live-service";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function HostPage() {
  const store = getStore();
  const live = selectHostConsoleLiveSession(store);
  const comments = withCommentUserNames(store, listPublicComments(store, live.id));
  const micRequests = store.micRequests.filter((item) => item.liveId === live.id);

  return <MobileHostConsole live={live} comments={comments} stats={getStats(store, live.id)} micRequests={micRequests} />;
}
