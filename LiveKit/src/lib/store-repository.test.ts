import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { JsonStoreRepository } from "./store-repository";

const tempDirs: string[] = [];

describe("store repository", () => {
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("persists mutations through a repository transaction", () => {
    const dir = mkdtempSync(join(tmpdir(), "wechat-live-repo-"));
    tempDirs.push(dir);
    const repository = new JsonStoreRepository(join(dir, "app-store.json"));

    const created = repository.mutate((store) => {
      const live = {
        ...store.liveSessions[0],
        id: "repo-live",
        title: "仓储事务直播",
        roomName: "private-repo-live",
      };
      store.liveSessions.unshift(live);
      return live;
    });

    const loaded = repository.load();

    expect(created.id).toBe("repo-live");
    expect(loaded.liveSessions[0].id).toBe("repo-live");
  });

  it("normalizes older persisted data that does not yet have follow-up records", () => {
    const dir = mkdtempSync(join(tmpdir(), "wechat-live-repo-"));
    tempDirs.push(dir);
    const repository = new JsonStoreRepository(join(dir, "app-store.json"));

    repository.save({
      users: [],
      liveSessions: [],
      participants: [],
      comments: [],
      micRequests: [],
      replays: [],
      stats: [],
      auditLogs: [],
      shareVisits: [],
      customerFollowUps: [],
    });

    const loaded = repository.load();

    expect(Array.isArray(loaded.customerFollowUps)).toBe(true);
  });
});
