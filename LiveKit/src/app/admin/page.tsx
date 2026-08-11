import Link from "next/link";
import { AdminConsole } from "@/components/admin-console";
import { SignOutButton } from "@/components/sign-out-button";
import { requireAuth } from "@/lib/auth-helpers";
import { getCommentAnalytics, withCommentUserNames } from "@/lib/comment-service";
import { getCustomerLeads } from "@/lib/lead-service";
import { getStats, listOnlineParticipants, withParticipantUserNames } from "@/lib/live-service";
import { withMicRequestUserNames } from "@/lib/mic-service";
import { getShareRanking } from "@/lib/share-service";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const emptyStats = {
  id: "stats-empty", liveId: "", pv: 0, uv: 0, peakOnline: 0, currentOnline: 0, avgWatchDuration: 0,
  commentCount: 0, likeCount: 0, micApplyCount: 0, successfulMicCount: 0, leadCount: 0, replayViewCount: 0,
};

const emptyCommentAnalytics = {
  summary: { total: 0, pending: 0, approved: 0, rejected: 0, deleted: 0, highValueQuestions: 0, pinned: 0, uniqueUsers: 0 },
  statusBreakdown: [],
  userRanking: [],
};

export default async function AdminPage() {
  const currentUser = await requireAuth(["super_admin", "director", "moderator"]);
  const store = getStore();
  const scopedSessions = currentUser.role === "super_admin"
    ? store.liveSessions
    : store.liveSessions.filter((item) => item.tenantId === currentUser.tenantId);
  const live = scopedSessions[0];

  return <>
    {currentUser.role === "super_admin" || currentUser.role === "director" ? <div className="absolute right-6 top-6 z-10"><Link className="rounded-md border bg-background px-3 py-2 text-sm" href="/admin/users">账号管理</Link></div> : null}
    <div className="absolute right-6 top-16 z-10"><SignOutButton /></div>
    {!live ? <div className="absolute left-6 top-6 z-10 max-w-md rounded-md border border-primary/30 bg-background/95 p-3 text-sm text-muted-foreground">当前租户还没有直播间。请先在“账号管理”创建主播账号，再在右侧输入标题并点击“创建直播”。</div> : null}
    <AdminConsole
      liveSessions={scopedSessions}
      initialComments={live ? withCommentUserNames(store, store.comments.filter((item) => item.liveId === live.id)) : []}
      initialMicRequests={live ? withMicRequestUserNames(store, store.micRequests.filter((item) => item.liveId === live.id)) : []}
      initialParticipants={live ? withParticipantUserNames(store, listOnlineParticipants(store, live.id)) : []}
      stats={live ? getStats(store, live.id) : emptyStats}
      initialShareRanking={live ? getShareRanking(store, live.id) : []}
      initialCommentAnalytics={live ? getCommentAnalytics(store, live.id) : emptyCommentAnalytics}
      initialCustomerLeads={live ? getCustomerLeads(store, live.id) : []}
    />
  </>;
}
