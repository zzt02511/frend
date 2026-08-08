import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth-helpers";
import { selectHostConsoleLiveSession } from "@/lib/live-service";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function HostPage() {
  const { userId } = await requireAuth(["host"]);
  const store = getStore();
  const live = selectHostConsoleLiveSession(store, userId);

  redirect(`/host/${live.id}`);
}
