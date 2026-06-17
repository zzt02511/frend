const VIEWER_ID_KEY = "wechat-live-viewer-id";

type ViewerStorage = Pick<Storage, "getItem" | "setItem">;

function isUsableViewerId(value: string | null | undefined): value is string {
  return Boolean(value?.trim() && value !== "audience-1");
}

export function createAudienceViewerId(random = Math.random, now = Date.now) {
  const timePart = now().toString(36);
  const randomPart = random().toString(36).slice(2, 10);
  return `wxv-${timePart}-${randomPart}`;
}

export function getOrCreateAudienceViewerId(storage?: ViewerStorage, initialViewerId?: string): string {
  const normalizedInitialViewerId = initialViewerId?.trim();
  if (isUsableViewerId(normalizedInitialViewerId)) {
    const viewerId = normalizedInitialViewerId;
    storage?.setItem(VIEWER_ID_KEY, viewerId);
    return viewerId;
  }

  const storedViewerId = storage?.getItem(VIEWER_ID_KEY);
  if (isUsableViewerId(storedViewerId)) return storedViewerId.trim();

  const viewerId = createAudienceViewerId();
  storage?.setItem(VIEWER_ID_KEY, viewerId);
  return viewerId;
}
