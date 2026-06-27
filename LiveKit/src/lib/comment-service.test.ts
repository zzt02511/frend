import { describe, expect, it } from "vitest";
import {
  approveComment,
  listAudienceComments,
  listPublicComments,
  markHighValueQuestion,
  recordAudienceEvent,
  sendComment,
  withCommentUserNames,
} from "./comment-service";
import { createDemoStore } from "./store";
import { joinLiveSession, muteParticipant } from "./live-service";

describe("comment service", () => {
  it("keeps review-mode comments out of the public stream until approval", () => {
    const store = createDemoStore();

    const comment = sendComment(store, {
      liveId: "demo-live",
      userId: "audience-1",
      content: "想看看这款门的隔音效果",
    });

    expect(comment.status).toBe("pending");
    expect(listPublicComments(store, "demo-live")).toHaveLength(0);

    approveComment(store, "demo-live", comment.id, "moderator-1");

    expect(listPublicComments(store, "demo-live")).toHaveLength(1);
  });

  it("shows the sender their own pending comments", () => {
    const store = createDemoStore();

    const comment = sendComment(store, {
      liveId: "demo-live",
      userId: "audience-1",
      content: "可以讲一下安装周期吗",
    });

    expect(comment.visibleToSender).toBe(true);
    expect(comment.status).toBe("pending");
  });

  it("hides pending comments from other audience members until approval", () => {
    const store = createDemoStore();
    const ownComment = sendComment(store, {
      liveId: "demo-live",
      userId: "audience-1",
      content: "我想看一下价格",
    });
    const otherComment = sendComment(store, {
      liveId: "demo-live",
      userId: "audience-2",
      content: "能不能看看细节",
    });

    expect(listAudienceComments(store, "demo-live", "audience-1").map((item) => item.id)).toEqual([
      ownComment.id,
    ]);

    approveComment(store, "demo-live", otherComment.id, "moderator-1");

    expect(listAudienceComments(store, "demo-live", "audience-1").map((item) => item.id)).toEqual([
      ownComment.id,
      otherComment.id,
    ]);
  });

  it("blocks muted users from sending comments", () => {
    const store = createDemoStore();
    const participant = joinLiveSession(store, {
      liveId: "demo-live",
      userId: "audience-1",
      role: "audience",
    });
    muteParticipant(store, "demo-live", participant.id, "moderator-1");

    expect(() =>
      sendComment(store, {
        liveId: "demo-live",
        userId: "audience-1",
        content: "我被禁言后不应发送成功",
      }),
    ).toThrow("USER_MUTED");
  });

  it("marks approved comments as high-value host questions", () => {
    const store = createDemoStore();
    const comment = sendComment(store, {
      liveId: "demo-live",
      userId: "audience-1",
      content: "这套方案适合南方回南天吗",
    });
    approveComment(store, "demo-live", comment.id, "moderator-1");

    const marked = markHighValueQuestion(store, "demo-live", comment.id, "moderator-1");

    expect(marked.isHighValueQuestion).toBe(true);
  });

  it("rejects whitespace-only comments before updating stats", () => {
    const store = createDemoStore();
    const stats = store.stats.find((item) => item.liveId === "demo-live");

    expect(() =>
      sendComment(store, {
        liveId: "demo-live",
        userId: "audience-1",
        content: "   \n\t  ",
      }),
    ).toThrow("COMMENT_EMPTY");

    expect(store.comments).toHaveLength(0);
    expect(stats?.commentCount).toBe(0);
  });

  it("adds WeChat display names to comments from the user table", () => {
    const store = createDemoStore();
    store.users.push({
      id: "wx-viewer-1",
      name: "微信昵称小王",
      role: "audience",
      status: "active",
    });
    const comment = sendComment(store, {
      liveId: "demo-live",
      userId: "wx-viewer-1",
      content: "hello",
    });

    expect(withCommentUserNames(store, [comment])[0].userName).toBe("微信昵称小王");
  });

  it("records audience join and like events as approved comments without review", () => {
    const store = createDemoStore();
    const initialLikeCount = store.stats.find((item) => item.liveId === "demo-live")?.likeCount ?? 0;
    store.users.push({
      id: "wx-viewer-event",
      name: "微信昵称小李",
      role: "audience",
      status: "active",
    });

    const joinEvent = recordAudienceEvent(store, {
      liveId: "demo-live",
      userId: "wx-viewer-event",
      type: "join",
    });
    const likeEvent = recordAudienceEvent(store, {
      liveId: "demo-live",
      userId: "wx-viewer-event",
      type: "like",
    });

    expect(joinEvent.status).toBe("approved");
    expect(joinEvent.visibleToSender).toBe(false);
    expect(joinEvent.content).toBe("微信昵称小李进入直播间了");
    expect(likeEvent.status).toBe("approved");
    expect(likeEvent.content).toBe("微信昵称小李点赞了主播");
    expect(listPublicComments(store, "demo-live").map((comment) => comment.id)).toEqual([
      joinEvent.id,
      likeEvent.id,
    ]);
    expect(store.stats.find((item) => item.liveId === "demo-live")?.likeCount).toBe(initialLikeCount + 1);
  });
});
