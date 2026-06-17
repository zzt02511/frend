import { describe, expect, it } from "vitest";
import { approveComment, markHighValueQuestion, rejectComment, sendComment } from "./comment-service";
import { getCustomerLeads, updateCustomerFollowUp } from "./lead-service";
import { recordShareVisit } from "./share-service";
import { createDemoStore } from "./store";

describe("lead service", () => {
  it("combines share visits and comments into customer-level leads", () => {
    const store = createDemoStore();
    store.shareVisits = [];

    recordShareVisit(store, {
      liveId: "demo-live",
      viewerId: "customer-a",
      source: "wechat",
      sharedBy: "moderator-1",
    });
    recordShareVisit(store, {
      liveId: "demo-live",
      viewerId: "customer-a",
      source: "wechat",
      sharedBy: "moderator-1",
    });
    recordShareVisit(store, {
      liveId: "demo-live",
      viewerId: "customer-b",
      source: "wechat",
      sharedBy: "director-1",
    });

    const first = sendComment(store, {
      liveId: "demo-live",
      userId: "customer-a",
      content: "想了解套餐价格",
    });
    const second = sendComment(store, {
      liveId: "demo-live",
      userId: "customer-a",
      content: "安装周期多久",
    });
    approveComment(store, "demo-live", first.id, "moderator-1");
    approveComment(store, "demo-live", second.id, "moderator-1");
    markHighValueQuestion(store, "demo-live", second.id, "moderator-1");

    const rejected = sendComment(store, {
      liveId: "demo-live",
      userId: "customer-b",
      content: "随便看看",
    });
    rejectComment(store, "demo-live", rejected.id, "moderator-1");

    const leads = getCustomerLeads(store, "demo-live");

    expect(leads).toEqual([
      expect.objectContaining({
        customerId: "customer-a",
        source: "wechat",
        sharedBy: "moderator-1",
        visitCount: 2,
        commentCount: 2,
        approvedCommentCount: 2,
        rejectedCommentCount: 0,
        highValueQuestionCount: 1,
        questions: [
          expect.objectContaining({ content: "想了解套餐价格" }),
          expect.objectContaining({ content: "安装周期多久", isHighValueQuestion: true }),
        ],
        temperature: "hot",
        wecomStatus: "not_contacted",
        leadStage: "new",
        followUpStatus: "unassigned",
      }),
      expect.objectContaining({
        customerId: "customer-b",
        source: "wechat",
        sharedBy: "director-1",
        visitCount: 1,
        commentCount: 1,
        approvedCommentCount: 0,
        rejectedCommentCount: 1,
        highValueQuestionCount: 0,
        temperature: "warm",
      }),
    ]);
  });

  it("creates a direct lead when a commenter has no share visit", () => {
    const store = createDemoStore();
    store.shareVisits = [];

    sendComment(store, {
      liveId: "demo-live",
      userId: "walk-in-customer",
      content: "我从群里直接点进来的",
    });

    expect(getCustomerLeads(store, "demo-live")).toEqual([
      expect.objectContaining({
        customerId: "walk-in-customer",
        source: "direct",
        sharedBy: "direct",
        visitCount: 0,
        commentCount: 1,
        temperature: "warm",
      }),
    ]);
  });

  it("includes watch duration and manual follow-up state", () => {
    const store = createDemoStore();
    store.participants.push({
      id: "participant-customer-a",
      liveId: "demo-live",
      userId: "customer-a",
      livekitIdentity: "private-demo-live-customer-a",
      role: "audience",
      joinTime: "2026-06-15T10:00:00.000Z",
      leaveTime: "2026-06-15T10:08:30.000Z",
      watchDuration: 0,
      isMuted: false,
      isBanned: false,
      canPublish: false,
    });

    updateCustomerFollowUp(store, "demo-live", "customer-a", {
      wecomStatus: "added",
      leadStage: "converted",
      followUpOwnerId: "moderator-1",
      followUpStatus: "pending",
      followUpNote: "直播后优先回访报价",
    });

    expect(getCustomerLeads(store, "demo-live")).toContainEqual(
      expect.objectContaining({
        customerId: "customer-a",
        watchDurationSeconds: 510,
        wecomStatus: "added",
        leadStage: "converted",
        followUpOwnerId: "moderator-1",
        followUpStatus: "pending",
        followUpNote: "直播后优先回访报价",
      }),
    );
  });
});
