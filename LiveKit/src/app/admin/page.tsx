import { AdminConsole } from "@/components/admin-console";
import { requireAuth } from "@/lib/auth-helpers";
import { getCommentAnalytics, withCommentUserNames } from "@/lib/comment-service";
import { getCustomerLeads } from "@/lib/lead-service";
import { getStats, listOnlineParticipants, withParticipantUserNames } from "@/lib/live-service";
import { withMicRequestUserNames } from "@/lib/mic-service";
import { getShareRanking } from "@/lib/share-service";
import { getStore } from "@/lib/store";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const currentUser = await requireAuth(["super_admin", "director", "moderator"]);
  const store = getStore();
  const scopedSessions = currentUser.role === "super_admin" ? store.liveSessions : store.liveSessions.filter((item) => item.tenantId === currentUser.tenantId);
  if (scopedSessions.length === 0) return <p className="p-6">当前租户暂无直播间。</p>;
  const live = scopedSessions[0];

  return (<>
    {currentUser.role === "super_admin" ? <div className="absolute right-6 top-6 z-10"><Link className="rounded-md border bg-background px-3 py-2 text-sm" href="/admin/users">账号管理</Link></div> : null}
    {currentUser.role === "director" ? <div className="absolute right-6 top-6 z-10"><Link className="rounded-md border bg-background px-3 py-2 text-sm" href="/admin/users">账号管理</Link></div> : null}
    <div className="absolute right-6 top-16 z-10"><SignOutButton /></div>
    <AdminConsole
      liveSessions={scopedSessions}
      initialComments={withCommentUserNames(store, store.comments.filter((item) => item.liveId === live.id))}
      initialMicRequests={withMicRequestUserNames(store, store.micRequests.filter((item) => item.liveId === live.id))}
      initialParticipants={withParticipantUserNames(store, listOnlineParticipants(store, live.id))}
      stats={getStats(store, live.id)}
      initialShareRanking={getShareRanking(store, live.id)}
      initialCommentAnalytics={getCommentAnalytics(store, live.id)}
      initialCustomerLeads={getCustomerLeads(store, live.id)}
    />
  </>);
}
