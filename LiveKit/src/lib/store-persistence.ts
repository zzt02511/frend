import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AppStore } from "./domain";
import { createDemoStore } from "./store";

export const defaultStorePath = join(process.cwd(), ".data", "app-store.json");
let demoStoreTemplate: AppStore | undefined;

function cloneDefault<T>(value: T): T {
  return structuredClone(value);
}

function getDemoStoreTemplate() {
  demoStoreTemplate ??= createDemoStore();
  return demoStoreTemplate;
}

function normalizeLiveSessions(store: Partial<AppStore>, demo: AppStore) {
  const sessions = store.liveSessions ?? cloneDefault(demo.liveSessions);
  for (const session of sessions) {
    const demoSession = demo.liveSessions.find((item) => item.id === session.id);
    session.cdnPlayUrl ??= demoSession?.cdnPlayUrl;
  }
  return sessions;
}

export function loadStoreFromFile(filePath = defaultStorePath): AppStore {
  if (!existsSync(filePath)) return createDemoStore();

  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Partial<AppStore>;
  return normalizeStore(parsed);
}

export function saveStoreToFile(store: AppStore, filePath = defaultStorePath) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(store, null, 2), "utf8");
}

export function normalizeStore(store: Partial<AppStore>): AppStore {
  const demo = getDemoStoreTemplate();
  return {
    users: store.users ?? cloneDefault(demo.users),
    liveSessions: normalizeLiveSessions(store, demo),
    participants: store.participants ?? [],
    comments: store.comments ?? [],
    micRequests: store.micRequests ?? [],
    replays: store.replays ?? [],
    stats: store.stats ?? cloneDefault(demo.stats),
    auditLogs: store.auditLogs ?? [],
    shareVisits: store.shareVisits ?? cloneDefault(demo.shareVisits),
    customerFollowUps: store.customerFollowUps ?? [],
  };
}
