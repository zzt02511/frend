import type { AppStore } from "./domain";
import { getStoreRepository } from "./store-repository";
import { normalizeStore } from "./store-persistence";
import { hashPassword } from "./password";

export function createDemoStore(): AppStore {
  return {
    users: [
      {
        id: "admin-1",
        name: "超级管理员",
        role: "super_admin",
        status: "active",
        passwordHash: hashPassword("admin123"),
      },
      {
        id: "director-1",
        name: "营销总监",
        role: "director",
        status: "active",
        tenantId: "default-tenant",
        passwordHash: hashPassword("director123"),
      },
      {
        id: "host-1",
        name: "移动主播",
        role: "host",
        status: "active",
        tenantId: "default-tenant",
        passwordHash: hashPassword("host123"),
      },
      {
        id: "moderator-1",
        name: "直播场控",
        role: "moderator",
        status: "active",
        tenantId: "default-tenant",
        passwordHash: hashPassword("mod123"),
      },
      {
        id: "audience-1",
        name: "微信观众 A",
        role: "audience",
        status: "active",
      },
      {
        id: "audience-2",
        name: "意向客户 B",
        role: "audience",
        status: "active",
      },
    ],
    liveSessions: [
      {
        id: "demo-live",
        title: "全屋定制新品私域直播",
        coverUrl: "/window.svg",
        description: "移动主播边走边讲解产品，场控审核留言并管理连麦。",
        roomName: "private-demo-live",
        status: "scheduled",
        startTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        hostUserId: "host-1",
        tenantId: "default-tenant",
        moderatorIds: ["moderator-1", "director-1"],
        enableComment: true,
        commentMode: "review",
        enableMicApply: true,
        enableRecord: true,
        cdnPlayUrl: "webrtc://play.fuguilong.cn/live/IHQDAT",
      },
    ],
    participants: [],
    comments: [],
    micRequests: [],
    replays: [],
    stats: [
      {
        id: "stats-demo-live",
        liveId: "demo-live",
        pv: 128,
        uv: 46,
        peakOnline: 32,
        currentOnline: 0,
        avgWatchDuration: 0,
        commentCount: 0,
        likeCount: 219,
        micApplyCount: 0,
        successfulMicCount: 0,
        leadCount: 0,
        replayViewCount: 0,
      },
    ],
    auditLogs: [],
    customerFollowUps: [],
    shareVisits: [
      {
        id: "share-visit-1",
        liveId: "demo-live",
        viewerId: "customer-a",
        source: "wechat",
        sharedBy: "moderator-1",
        createdAt: new Date().toISOString(),
      },
      {
        id: "share-visit-2",
        liveId: "demo-live",
        viewerId: "customer-b",
        source: "wechat",
        sharedBy: "director-1",
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

const globalStore = globalThis as typeof globalThis & { __wechatLiveStore?: AppStore };

export function getStore() {
  if (!globalStore.__wechatLiveStore) {
    globalStore.__wechatLiveStore = getStoreRepository().load();
  }
  globalStore.__wechatLiveStore = normalizeStore(globalStore.__wechatLiveStore);

  return globalStore.__wechatLiveStore;
}

export function persistStore(store = getStore()) {
  getStoreRepository().save(store);
}

export function persistStoreIfGlobal(store: AppStore) {
  if (globalStore.__wechatLiveStore === store) {
    persistStore(store);
  }
}
