import { redirect } from "next/navigation";
import { assertLiveTenantAccess, requireAuth } from "@/lib/auth-helpers";
import { selectHostConsoleLiveSession } from "@/lib/live-service";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function HostPage() {
  const auth = await requireAuth(["host"]);
  const store = getStore();
  const live = selectHostConsoleLiveSession(store, auth.userId);
  assertLiveTenantAccess(auth, live);

  redirect(`/host/${live.id}`);
}
