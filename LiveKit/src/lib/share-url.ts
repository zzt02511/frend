export function buildLiveShareUrl(input: {
  origin: string;
  liveId: string;
  source?: string;
  sharedBy?: string;
}) {
  const url = new URL(`/live/${input.liveId}`, input.origin);
  if (input.source) url.searchParams.set("source", input.source);
  if (input.sharedBy) url.searchParams.set("sharedBy", input.sharedBy);
  return url.toString();
}
