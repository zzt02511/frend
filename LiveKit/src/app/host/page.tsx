import Link from "next/link";
import { redirect } from "next/navigation";
import { assertLiveTenantAccess, requireAuth } from "@/lib/auth-helpers";
import { selectHostConsoleLiveSession } from "@/lib/live-service";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function HostPage() {
  const auth = await requireAuth(["host"]);
  const store = getStore();
  const availableRooms = store.liveSessions.filter(
    (live) => live.hostUserId === auth.userId && ["draft", "scheduled", "live"].includes(live.status),
  );

  if (availableRooms.length > 1) {
    return <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 bg-background p-6 text-foreground">
      <h1 className="text-xl font-semibold">选择要进入的直播间</h1>
      <p className="text-sm text-muted-foreground">请选择本次需要开播或管理的直播间。</p>
      <div className="grid gap-3">
        {availableRooms.map((live) => <Link key={live.id} href={`/host/${live.id}`} className="rounded-lg border border-border bg-card p-4 transition hover:border-primary">
          <div className="font-medium">{live.title}</div>
          <div className="mt-1 text-xs text-muted-foreground">{live.status === "live" ? "直播中" : live.status === "scheduled" ? "待开播" : "草稿"}</div>
        </Link>)}
      </div>
    </main>;
  }

  const live = selectHostConsoleLiveSession(store, auth.userId);
  assertLiveTenantAccess(auth, live);

  redirect(`/host/${live.id}`);
}
