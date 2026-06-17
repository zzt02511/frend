/**
 * @vitest-environment jsdom
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileHostConsole } from "./mobile-host-console";
import type { LiveComment, LiveSession, LiveStats, MicRequest } from "@/lib/domain";

const liveKitHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => void>());

vi.mock("livekit-client", () => {
  class MockRoom {
    remoteParticipants = new Map();
    localParticipant = { publishTrack: vi.fn() };
    on(event: string, handler: (...args: unknown[]) => void) {
      liveKitHandlers.set(event, handler);
      return this;
    }
    off(event: string) {
      liveKitHandlers.delete(event);
      return this;
    }
    connect = vi.fn().mockResolvedValue(undefined);
    disconnect = vi.fn();
  }

  class LocalVideoTrack {}

  return {
    createLocalTracks: vi.fn().mockResolvedValue([
      {
        kind: "video",
        attach: vi.fn(),
        detach: vi.fn(),
        stop: vi.fn(),
      },
      {
        kind: "audio",
        attach: vi.fn(),
        detach: vi.fn(),
        stop: vi.fn(),
      },
    ]),
    LocalVideoTrack,
    Room: MockRoom,
    RoomEvent: {
      TrackSubscribed: "TrackSubscribed",
      TrackUnsubscribed: "TrackUnsubscribed",
      ParticipantDisconnected: "ParticipantDisconnected",
      Disconnected: "Disconnected",
    },
    Track: { Kind: { Video: "video", Audio: "audio" } },
  };
});

const live: LiveSession = {
  id: "demo-live",
  title: "涓绘挱娴嬭瘯鐩存挱",
  coverUrl: "/window.svg",
  description: "娴嬭瘯",
  roomName: "private-demo-live",
  status: "scheduled",
  startTime: "2026-06-15T00:00:00.000Z",
  hostUserId: "host-1",
  moderatorIds: ["moderator-1"],
  enableComment: true,
  commentMode: "review",
  enableMicApply: true,
  enableRecord: true,
};

const micRequest: MicRequest = {
  id: "mic-1",
  liveId: "demo-live",
  userId: "audience-1",
  status: "applied",
  reason: "鎯宠繛楹︾湅浜у搧缁嗚妭",
  createdAt: "2026-06-15T00:00:00.000Z",
};

const connectedMicRequest: MicRequest = {
  ...micRequest,
  id: "mic-connected-1",
  status: "connected",
  approvedAt: "2026-06-15T00:00:01.000Z",
  connectedAt: "2026-06-15T00:00:02.000Z",
};

const stats: LiveStats = {
  id: "stats-demo-live",
  liveId: "demo-live",
  pv: 0,
  uv: 0,
  peakOnline: 99,
  currentOnline: 3,
  avgWatchDuration: 0,
  commentCount: 0,
  likeCount: 0,
  micApplyCount: 0,
  successfulMicCount: 0,
  leadCount: 0,
  replayViewCount: 0,
};

const approvedComments: LiveComment[] = [1, 2, 3].map((index) => ({
  id: `comment-${index}`,
  liveId: "demo-live",
  userId: `audience-${index}`,
  content: `浜掑姩鐣欒█ ${index}`,
  status: "approved",
  isPinned: false,
  isHighValueQuestion: false,
  visibleToSender: true,
  hitSensitiveWords: [],
  createdAt: "2026-06-15T00:00:00.000Z",
}));

describe("MobileHostConsole", () => {
  beforeEach(() => {
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    liveKitHandlers.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("starts the live session and updates the visible status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ ok: true, data: { ...live, status: "live" } }),
      }),
    );

    render(<MobileHostConsole live={live} comments={[]} stats={stats} micRequests={[]} />);

    fireEvent.click(screen.getByRole("button", { name: /开播/ }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/live-sessions/demo-live/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: "host-1" }),
      }),
    );
  });

  it("does not duplicate the live title above the mobile video area", () => {
    render(<MobileHostConsole live={live} comments={[]} stats={stats} micRequests={[]} />);

    expect(screen.getAllByText("涓绘挱娴嬭瘯鐩存挱")).toHaveLength(1);
  });

  it("approves a mic request from the host console", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ ok: true, data: { ...micRequest, status: "approved" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<MobileHostConsole live={live} comments={[]} stats={stats} micRequests={[micRequest]} />);

    expect(screen.getByText("audience-1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "通过" }));

    await waitFor(() => expect(screen.queryByText("audience-1")).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/live-sessions/demo-live/mic-requests/mic-1/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: "host-1" }),
    });
  });

  it("polls and shows new mic requests without re-entering the host console", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ ok: true, data: [micRequest] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<MobileHostConsole live={live} comments={[]} stats={stats} micRequests={[]} />);

    expect(screen.queryByText("audience-1")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(screen.getByText("audience-1")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/live-sessions/demo-live/mic-requests");
  });

  it("keeps mic requests and three comments visible in the first screen", () => {
    render(
      <MobileHostConsole
        live={live}
        comments={approvedComments}
        stats={stats}
        micRequests={[micRequest]}
      />,
    );

    expect(screen.getByTestId("first-screen-mic-requests")).toHaveTextContent("audience-1");
    expect(screen.getByTestId("host-first-screen-comments")).toHaveTextContent("浜掑姩鐣欒█ 1");
    expect(screen.getByTestId("host-first-screen-comments")).toHaveTextContent("浜掑姩鐣欒█ 2");
    expect(screen.getByTestId("host-first-screen-comments")).toHaveTextContent("浜掑姩鐣欒█ 3");
    expect(screen.getByText("开启设备").closest("button")).toHaveClass("h-9");
  });
  it("keeps the video surface clear and removes the high-value question area", () => {
    render(
      <MobileHostConsole
        live={live}
        comments={approvedComments}
        stats={stats}
        micRequests={[micRequest]}
      />,
    );

    expect(screen.getByTestId("host-video-surface")).not.toContainElement(
      screen.getByTestId("first-screen-mic-requests"),
    );
    expect(screen.queryByTestId("host-high-value-questions")).not.toBeInTheDocument();
  });

  it("renders compact audience interaction rows with user and content only", () => {
    const comments = [1, 2, 3, 4].map((index) => ({
      ...approvedComments[0],
      id: `compact-comment-${index}`,
      userId: `viewer-${index}`,
      content: `message ${index}`,
      createdAt: `2026-06-15T00:00:0${index}.000Z`,
    }));

    render(<MobileHostConsole live={live} comments={comments} stats={stats} micRequests={[]} />);

    const rows = screen.getAllByTestId("host-comment-row");
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent("message 1");
    expect(rows[3]).toHaveTextContent("message 4");
    expect(rows[0]).not.toHaveClass("border");
  });

  it("shows connected mic guests and lets the host end one mic session", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => ({
      json: async () =>
        url.endsWith("/mic-connected-1/end")
          ? { ok: true, data: { ...connectedMicRequest, status: "ended" } }
          : { ok: true, data: [connectedMicRequest] },
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<MobileHostConsole live={live} comments={[]} stats={stats} micRequests={[connectedMicRequest]} />);

    expect(screen.getByTestId("host-connected-mic-guests")).toHaveTextContent("audience-1");
    expect(screen.getByTestId("host-connected-mic-guests")).toHaveTextContent("连麦中");

    fireEvent.click(screen.getByRole("button", { name: "结束连麦" }));

    await waitFor(() => expect(screen.getByTestId("host-connected-mic-guests")).not.toHaveTextContent("audience-1"));
    expect(fetchMock).toHaveBeenCalledWith("/api/live-sessions/demo-live/mic-requests/mic-connected-1/end", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: "host-1" }),
    });
  });

  it("shows WeChat names, live online count, one-line status, and scrolls new host comments to the bottom", async () => {
    vi.useFakeTimers();
    const initialComments = [1, 2].map((index) => ({
      ...approvedComments[0],
      id: `named-comment-${index}`,
      userId: `viewer-${index}`,
      userName: `微信昵称${index}`,
      content: `named message ${index}`,
      createdAt: `2026-06-15T00:00:0${index}.000Z`,
    }));
    const nextComment = {
      ...approvedComments[0],
      id: "named-comment-3",
      userId: "viewer-3",
      userName: "微信昵称3",
      content: "newest message",
      createdAt: "2026-06-15T00:00:03.000Z",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => ({
        json: async () =>
          url.endsWith("/stats")
            ? { ok: true, data: { ...stats, currentOnline: 7, peakOnline: 99 } }
            : url.includes("/comments")
              ? { ok: true, data: [...initialComments, nextComment] }
              : { ok: true, data: [] },
      })),
    );

    render(<MobileHostConsole live={live} comments={initialComments} stats={stats} micRequests={[]} />);

    const commentsPanel = screen.getByTestId("host-first-screen-comments");
    Object.defineProperty(commentsPanel, "scrollHeight", { configurable: true, value: 400 });

    expect(screen.getByText(/3.*在线/)).toBeInTheDocument();
    expect(screen.getByText("微信昵称1")).toBeInTheDocument();
    expect(screen.getByTestId("host-status-line")).toHaveClass("flex");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(screen.getByText(/7.*在线/)).toBeInTheDocument();
    expect(screen.getByText("微信昵称3")).toBeInTheDocument();
    expect(screen.getByText("newest message")).toBeInTheDocument();
    expect(commentsPanel.scrollTop).toBe(400);
  });

  it("hides the mic guest preview when the guest track unsubscribes", async () => {
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn() } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          ok: true,
          data: {
            token: "token",
            serverUrl: "wss://live.fuguilong.cn",
            grants: { canPublish: true },
          },
        }),
      }),
    );

    render(<MobileHostConsole live={live} comments={[]} stats={stats} micRequests={[]} />);

    fireEvent.click(screen.getByText("开启设备").closest("button")!);
    await waitFor(() => expect(liveKitHandlers.has("TrackSubscribed")).toBe(true));

    act(() => {
      liveKitHandlers.get("TrackSubscribed")?.(
        { kind: "video", attach: vi.fn() },
        undefined,
        { identity: "private-demo-live-audience-1" },
      );
    });

    expect(screen.getByTestId("host-mic-preview")).toHaveClass("block");

    act(() => {
      liveKitHandlers.get("TrackUnsubscribed")?.(
        { kind: "video", detach: vi.fn() },
        undefined,
        { identity: "private-demo-live-audience-1" },
      );
    });

    expect(screen.getByTestId("host-mic-preview")).toHaveClass("hidden");
  });

  it("shows an action error when starting fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ ok: false, error: "LIVE_NOT_FOUND" }),
      }),
    );

    render(<MobileHostConsole live={live} comments={[]} stats={stats} micRequests={[]} />);

    fireEvent.click(screen.getByText("开播").closest("button")!);

    await waitFor(() =>
      expect(screen.getByTestId("host-status-line")).toHaveTextContent("操作失败：LIVE_NOT_FOUND"),
    );
  });

  it("explains why mobile device access is blocked on plain HTTP", async () => {
    vi.stubGlobal("navigator", { mediaDevices: undefined });
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: false,
    });

    render(<MobileHostConsole live={live} comments={[]} stats={stats} micRequests={[]} />);

    fireEvent.click(screen.getByText("开启设备").closest("button")!);

    expect(await screen.findByText(/当前是 HTTP 访问/)).toBeInTheDocument();
  });
});
