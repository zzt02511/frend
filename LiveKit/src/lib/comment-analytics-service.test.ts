import { describe, expect, it } from "vitest";
import {
  approveComment,
  deleteComment,
  getCommentAnalytics,
  markHighValueQuestion,
  rejectComment,
  sendComment,
} from "./comment-service";
import { createDemoStore } from "./store";

describe("comment analytics service", () => {
  it("summarizes live room comments by status and ranks speaking users", () => {
    const store = createDemoStore();

    const first = sendComment(store, {
      liveId: "demo-live",
      userId: "audience-1",
      content: "第一条想了解价格",
    });
    const second = sendComment(store, {
      liveId: "demo-live",
      userId: "audience-1",
      content: "第二条想看细节",
    });
    const third = sendComment(store, {
      liveId: "demo-live",
      userId: "audience-2",
      content: "这套方案适合南方吗",
    });
    const fourth = sendComment(store, {
      liveId: "demo-live",
      userId: "audience-2",
      content: "这条要删除",
    });

    approveComment(store, "demo-live", first.id, "moderator-1");
    approveComment(store, "demo-live", third.id, "moderator-1");
    markHighValueQuestion(store, "demo-live", third.id, "moderator-1");
    rejectComment(store, "demo-live", second.id, "moderator-1");
    deleteComment(store, "demo-live", fourth.id, "moderator-1");

    const analytics = getCommentAnalytics(store, "demo-live");

    expect(analytics.summary).toEqual({
      total: 4,
      pending: 0,
      approved: 2,
      rejected: 1,
      deleted: 1,
      highValueQuestions: 1,
      pinned: 0,
      uniqueUsers: 2,
    });
    expect(analytics.statusBreakdown).toEqual([
      { status: "approved", count: 2 },
      { status: "rejected", count: 1 },
      { status: "deleted", count: 1 },
      { status: "pending", count: 0 },
    ]);
    expect(analytics.userRanking).toEqual([
      expect.objectContaining({
        userId: "audience-1",
        total: 2,
        approved: 1,
        rejected: 1,
        deleted: 0,
        pending: 0,
        highValueQuestions: 0,
      }),
      expect.objectContaining({
        userId: "audience-2",
        total: 2,
        approved: 1,
        rejected: 0,
        deleted: 1,
        pending: 0,
        highValueQuestions: 1,
      }),
    ]);
  });
});
