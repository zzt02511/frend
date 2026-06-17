import type { AppStore, ShareRank, ShareVisit } from "./domain";
import { createId, nowIso } from "./domain";
import { buildLiveShareUrl } from "./share-url";
import { persistStoreIfGlobal } from "./store";

export { buildLiveShareUrl };

export function recordShareVisit(
  store: AppStore,
  input: { liveId: string; viewerId?: string; source?: string; sharedBy?: string },
): ShareVisit {
  const visit: ShareVisit = {
    id: createId("share"),
    liveId: input.liveId,
    viewerId: input.viewerId || `anonymous-${createId("viewer")}`,
    source: input.source || "direct",
    sharedBy: input.sharedBy || "direct",
    createdAt: nowIso(),
  };
  store.shareVisits.push(visit);
  persistStoreIfGlobal(store);
  return visit;
}

export function getShareRanking(store: AppStore, liveId: string): ShareRank[] {
  const grouped = new Map<string, { viewers: Set<string>; visits: number; sharedBy: string; source: string }>();

  for (const visit of store.shareVisits.filter((item) => item.liveId === liveId)) {
    const key = `${visit.sharedBy}::${visit.source}`;
    const current =
      grouped.get(key) ??
      {
        viewers: new Set<string>(),
        visits: 0,
        sharedBy: visit.sharedBy,
        source: visit.source,
      };
    current.visits += 1;
    current.viewers.add(visit.viewerId);
    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .map((item) => ({
      sharedBy: item.sharedBy,
      source: item.source,
      visits: item.visits,
      uniqueViewers: item.viewers.size,
    }))
    .sort((a, b) => b.visits - a.visits || b.uniqueViewers - a.uniqueViewers);
}
