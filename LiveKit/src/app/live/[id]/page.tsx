import { AudienceRoom } from "@/components/audience-room";
import { listAudienceComments, withCommentUserNames } from "@/lib/comment-service";
import { getLiveSession, getStats } from "@/lib/live-service";
import { recordShareVisit } from "@/lib/share-service";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LivePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const store = getStore();
  const live = getLiveSession(store, id);
  const viewerId = firstParam(query.viewerId);
  recordShareVisit(store, {
    liveId: id,
    viewerId,
    source: firstParam(query.source),
    sharedBy: firstParam(query.sharedBy),
  });

  return (
    <AudienceRoom
      live={live}
      comments={withCommentUserNames(store, listAudienceComments(store, id, viewerId))}
      stats={getStats(store, id)}
      initialViewerId={viewerId}
    />
  );
}
