/**
 * @vitest-environment jsdom
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AudienceRoom } from "./audience-room";
import type { LiveComment, LiveSession, LiveStats } from "@/lib/domain";

const { liveKitAudiencePlayerMock } = vi.hoisted(() => ({
  liveKitAudiencePlayerMock: vi.fn(() => <div data-testid="audience-player" />),
}));

vi.mock("@/components/livekit-audience-player", () => ({
  LiveKitAudiencePlayer: liveKitAudiencePlayerMock,
}));

const live: LiveSession = {
  id: "demo-live",
  title: "观众测试直播",
  coverUrl: "/window.svg",
  description: "测试直播",
  roomName: "private-demo-live",
  status: "scheduled",
  startTime: "2026-06-15T00:00:00.000Z",
  hostUserId: "host-1",
  moderatorIds: ["moderator-1"],
  enableComment: true,
  commentMode: "review",
  enableMicApply: true,
  enableRecord: true,
  cdnPlayUrl: "webrtc://play.fuguilong.cn/live/IHQDAT",
};

const stats: LiveStats = {
  id: "stats-demo-live",
  liveId: "demo-live",
  pv: 0,
  uv: 0,
  peakOnline: 0,
  currentOnline: 1,
  avgWatchDuration: 0,
  commentCount: 0,
  likeCount: 0,
  micApplyCount: 0,
  successfulMicCount: 0,
  leadCount: 0,
  replayViewCount: 0,
};

const approvedComment: LiveComment = {
  id: "comment-1",
  liveId: "demo-live",
  userId: "audience-1",
  content: "这套产品多少钱？",
  status: "approved",
  isPinned: false,
  isHighValueQuestion: false,
  visibleToSender: true,
  hitSensitiveWords: [],
  createdAt: "2026-06-15T00:00:00.000Z",
};

describe("AudienceRoom", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not expose moderation status labels beside comments", () => {
    render(<AudienceRoom live={live} comments={[approvedComment]} stats={stats} initialViewerId="audience-1" />);

    expect(screen.getAllByText("留言互动").length).toBeGreaterThan(0);
    expect(screen.getByText("这套产品多少钱？")).toBeInTheDocument();
    expect(screen.queryByText("已展示")).not.toBeInTheDocument();
    expect(screen.queryByText("已发送")).not.toBeInTheDocument();
    expect(screen.queryByText("未展示")).not.toBeInTheDocument();
  });
  it("passes the exact host LiveKit identity to the audience player", () => {
    render(<AudienceRoom live={live} comments={[]} stats={stats} initialViewerId="audience-1" />);

    expect(liveKitAudiencePlayerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        liveId: "demo-live",
        hostIdentity: "private-demo-live-host-1",
        cdnPlayUrl: "webrtc://play.fuguilong.cn/live/IHQDAT",
      }),
      undefined,
    );
  });

  it("polls live stats and refreshes the online count", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => ({
        json: async () =>
          url.endsWith("/stats")
            ? { ok: true, data: { ...stats, currentOnline: 8 } }
            : { ok: true, data: [] },
      })),
    );

    render(<AudienceRoom live={live} comments={[]} stats={stats} initialViewerId="viewer-online" />);

    expect(screen.getByText(/1.*在线/)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(screen.getByText(/8.*在线/)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/live-sessions/demo-live/stats");
  });
  it("keeps the sender's own pending comment when polling visible comments", async () => {
    const ownPendingComment: LiveComment = {
      ...approvedComment,
      id: "pending-own-comment",
      userId: "viewer-own",
      content: "waiting for review",
      status: "pending",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => ({
        json: async () =>
          url.includes("/comments")
            ? { ok: true, data: [approvedComment] }
            : { ok: true, data: stats },
      })),
    );

    render(
      <AudienceRoom
        live={live}
        comments={[ownPendingComment]}
        stats={stats}
        initialViewerId="viewer-own"
      />,
    );

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/live-sessions/demo-live/comments?viewerId=viewer-own"),
    );

    expect(screen.getByText("waiting for review")).toBeInTheDocument();
  });

  it("renders audience comments like the host panel with WeChat names, no borders, newest at the bottom, and auto-scroll", async () => {
    vi.useFakeTimers();
    const firstComment = {
      ...approvedComment,
      id: "audience-comment-1",
      userId: "viewer-1",
      userName: "微信昵称1",
      content: "older message",
      createdAt: "2026-06-15T00:00:01.000Z",
    };
    const latestComment = {
      ...approvedComment,
      id: "audience-comment-2",
      userId: "viewer-2",
      userName: "微信昵称2",
      content: "latest message",
      createdAt: "2026-06-15T00:00:02.000Z",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => ({
        json: async () =>
          url.includes("/comments")
            ? { ok: true, data: [firstComment, latestComment] }
            : { ok: true, data: { ...stats, currentOnline: 5, peakOnline: 30 } },
      })),
    );

    render(
      <AudienceRoom
        live={live}
        comments={[firstComment]}
        stats={{ ...stats, currentOnline: 2, peakOnline: 30 }}
        initialViewerId="viewer-1"
      />,
    );

    const commentsPanel = screen.getByTestId("audience-comments-panel");
    Object.defineProperty(commentsPanel, "scrollHeight", { configurable: true, value: 360 });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    const rows = screen.getAllByTestId("audience-comment-row");
    expect(rows[0]).toHaveTextContent("older message");
    expect(rows[1]).toHaveTextContent("latest message");
    expect(rows[0]).toHaveTextContent("微信昵称1");
    expect(rows[1]).toHaveTextContent("微信昵称2");
    expect(rows[0]).not.toHaveClass("border");
    expect(commentsPanel.scrollTop).toBe(360);
    expect(screen.getByText(/5.*在线/)).toBeInTheDocument();
  });

  it("uses the bottom interaction button to focus a borderless inline comment input and hides the subtitle under the title", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ ok: true, data: [] }),
      }),
    );

    render(<AudienceRoom live={live} comments={[]} stats={stats} initialViewerId="viewer-comment" />);

    fireEvent.click(screen.getByRole("button", { name: "留言互动" }));

    const input = screen.getByPlaceholderText("输入想问主播的问题");
    expect(input).toHaveFocus();
    expect(input).not.toHaveClass("border");
    expect(screen.getByTestId("audience-comment-compose")).toHaveTextContent("发送");
    expect(screen.queryByText("测试直播")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "0" })).not.toBeInTheDocument();
  });

  it("shows mic apply, applying, connected, and reset states while allowing the audience to end mic", async () => {
    vi.useFakeTimers();
    let statusPolls = 0;
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => ({
      json: async () => {
        if (url.endsWith("/mic-requests") && init?.method === "POST") {
          return { ok: true, data: { id: "mic-1", status: "applied" } };
        }
        if (url.includes("/mic-requests?")) {
          statusPolls += 1;
          return { ok: true, data: [{ id: "mic-1", status: statusPolls === 1 ? "applied" : "approved" }] };
        }
        if (url.endsWith("/mic-requests/mic-1/end")) {
          return { ok: true, data: { id: "mic-1", status: "ended" } };
        }
        return { ok: true, data: stats };
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<AudienceRoom live={{ ...live, status: "live" }} comments={[]} stats={stats} initialViewerId="viewer-mic" />);

    expect(screen.getByRole("button", { name: /申请连麦/ })).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /申请连麦/ }));
    });

    expect(screen.getByRole("button", { name: /申请中/ })).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(screen.getByRole("button", { name: /连麦中/ })).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /结束连麦/ }));
    });

    expect(screen.getByRole("button", { name: /申请连麦/ })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/live-sessions/demo-live/mic-requests/mic-1/end", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: "viewer-mic" }),
    });
  });

  it("places title/status/comments over the video and records likes as approved interaction rows", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => ({
        json: async () => {
          if (url.endsWith("/audience-events") && init?.method === "POST") {
            return {
              ok: true,
              data: {
                ...approvedComment,
                id: "like-comment",
                userId: "viewer-like",
                userName: "微信昵称小赵",
                content: "微信昵称小赵点赞了主播",
                status: "approved",
                createdAt: "2026-06-15T00:00:03.000Z",
              },
            };
          }
          return { ok: true, data: [] };
        },
      })),
    );

    render(<AudienceRoom live={live} comments={[]} stats={stats} initialViewerId="viewer-like" />);

    expect(screen.getByTestId("audience-title-overlay")).toHaveClass("left-4", "top-4");
    expect(screen.getByTestId("audience-status-overlay")).toHaveClass("right-4", "top-4");
    expect(screen.getByTestId("audience-comments-overlay")).toHaveClass("bg-transparent");
    expect(screen.queryByText(`LiveKit Room: ${live.roomName}`)).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId("audience-like-button"));
    });

    expect(fetch).toHaveBeenCalledWith("/api/live-sessions/demo-live/audience-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "viewer-like", type: "like" }),
    });
    expect(screen.getByText("微信昵称小赵点赞了主播")).toBeInTheDocument();
  });

  it("asks for WeChat nickname authorization before joining and records a join interaction", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => ({
      json: async () => {
        if (url.includes("/wechat-profile")) {
          return { ok: true, data: { viewerId: "viewer-auth", nickname: "微信昵称小周" } };
        }
        if (url.endsWith("/join") && init?.method === "POST") {
          return { ok: true, data: { id: "participant-1" } };
        }
        if (url.endsWith("/audience-events") && init?.method === "POST") {
          return {
            ok: true,
            data: {
              ...approvedComment,
              id: "join-comment",
              userId: "viewer-auth",
              userName: "微信昵称小周",
              content: "微信昵称小周进入直播间了",
              status: "approved",
              createdAt: "2026-06-15T00:00:04.000Z",
            },
          };
        }
        return { ok: true, data: [] };
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<AudienceRoom live={live} comments={[]} stats={stats} initialViewerId="viewer-auth" />);

    expect(screen.getByTestId("wechat-auth-panel")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId("wechat-auto-auth-button"));
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/live-sessions/demo-live/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "viewer-auth", role: "audience", displayName: "微信昵称小周" }),
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/live-sessions/demo-live/audience-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "viewer-auth", type: "join" }),
    });
    expect(screen.getByText("微信昵称小周进入直播间了")).toBeInTheDocument();
  });

  it("gets the WeChat nickname automatically instead of asking the viewer to type it", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => ({
      json: async () => {
        if (url.includes("/wechat-profile")) {
          return { ok: true, data: { viewerId: "viewer-auto", nickname: "微信昵称小周" } };
        }
        if (url.endsWith("/join") && init?.method === "POST") {
          return { ok: true, data: { id: "participant-auto" } };
        }
        if (url.endsWith("/audience-events") && init?.method === "POST") {
          return {
            ok: true,
            data: {
              ...approvedComment,
              id: "join-auto-comment",
              userId: "viewer-auto",
              userName: "微信昵称小周",
              content: "微信昵称小周进入直播间了",
              status: "approved",
              createdAt: "2026-06-15T00:00:05.000Z",
            },
          };
        }
        return { ok: true, data: [] };
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<AudienceRoom live={live} comments={[]} stats={stats} initialViewerId="viewer-auto" />);

    const authPanel = screen.getByTestId("wechat-auth-panel");
    expect(within(authPanel).queryByRole("textbox")).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "同意授权并进入" }));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/live-sessions/demo-live/wechat-profile?"),
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/live-sessions/demo-live/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "viewer-auto", role: "audience", displayName: "微信昵称小周" }),
    });
    expect(screen.getByText("微信昵称小周进入直播间了")).toBeInTheDocument();
  });

  it("does not skip WeChat OAuth when the phone only has an old fallback nickname cached", async () => {
    vi.useFakeTimers();
    window.localStorage.setItem("wechat-live-viewer-name", "微信观众 old");
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ ok: true, data: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AudienceRoom live={live} comments={[]} stats={stats} initialViewerId="viewer-old-cache" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByTestId("wechat-auth-panel")).toBeInTheDocument();
  });

  it("skips the auth panel only after a prior WeChat OAuth authorization", async () => {
    vi.useFakeTimers();
    window.localStorage.setItem("wechat-live-viewer-name", "微信昵称小周");
    window.localStorage.setItem("wechat-live-viewer-name-source", "wechat");
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ ok: true, data: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AudienceRoom live={live} comments={[]} stats={stats} initialViewerId="viewer-wechat-cache" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.queryByTestId("wechat-auth-panel")).not.toBeInTheDocument();
  });

  it("shows an authorization error when the automatic join request fails", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => ({
      json: async () => {
        if (url.includes("/wechat-profile")) {
          return { ok: true, data: { viewerId: "viewer-banned", nickname: "微信昵称小王" } };
        }
        if (url.endsWith("/join") && init?.method === "POST") {
          return { ok: false, error: "USER_BANNED" };
        }
        return { ok: true, data: [] };
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<AudienceRoom live={live} comments={[]} stats={stats} initialViewerId="viewer-banned" />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("wechat-auto-auth-button"));
    });

    expect(screen.getByText("进入失败：USER_BANNED")).toBeInTheDocument();
    expect(screen.getByTestId("wechat-auth-panel")).toBeInTheDocument();
  });
});
