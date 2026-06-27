/**
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminConsole } from "./admin-console";
import type {
  CommentAnalytics,
  CustomerLead,
  LiveComment,
  LiveParticipant,
  LiveSession,
  LiveStats,
  MicRequest,
} from "@/lib/domain";

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,qr"),
  },
}));

const live: LiveSession = {
  id: "demo-live",
  title: "admin live",
  coverUrl: "/window.svg",
  description: "test",
  roomName: "private-demo-live",
  status: "live",
  startTime: "2026-06-15T00:00:00.000Z",
  hostUserId: "host-1",
  moderatorIds: ["moderator-1"],
  enableComment: true,
  commentMode: "review",
  enableMicApply: true,
  enableRecord: true,
};

const approvedComment: LiveComment = {
  id: "comment-approved",
  liveId: "demo-live",
  userId: "viewer-approved",
  content: "already approved",
  status: "approved",
  isPinned: false,
  isHighValueQuestion: false,
  visibleToSender: true,
  hitSensitiveWords: [],
  createdAt: "2026-06-15T00:00:00.000Z",
};

const pendingComment: LiveComment = {
  id: "comment-pending",
  liveId: "demo-live",
  userId: "viewer-pending",
  content: "needs review",
  status: "pending",
  isPinned: false,
  isHighValueQuestion: false,
  visibleToSender: true,
  hitSensitiveWords: [],
  createdAt: "2026-06-15T00:01:00.000Z",
};

const stats: LiveStats = {
  id: "stats-demo-live",
  liveId: "demo-live",
  pv: 0,
  uv: 0,
  peakOnline: 0,
  currentOnline: 0,
  avgWatchDuration: 0,
  commentCount: 0,
  likeCount: 0,
  micApplyCount: 0,
  successfulMicCount: 0,
  leadCount: 0,
  replayViewCount: 0,
};

const commentAnalytics: CommentAnalytics = {
  summary: {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    deleted: 0,
    highValueQuestions: 0,
    pinned: 0,
    uniqueUsers: 0,
  },
  statusBreakdown: [],
  userRanking: [],
};

type AdminTab = "comments" | "commentStats" | "leads" | "mic" | "participants";

function payload<T>(data: T) {
  return Promise.resolve({ json: async () => ({ ok: true, data }) });
}

const namedPendingComment: LiveComment = {
  ...pendingComment,
  userId: "wx-id-pending",
  userName: "微信昵称待审",
};

const namedApprovedComment: LiveComment = {
  ...approvedComment,
  userId: "wx-id-approved",
  userName: "微信昵称发言",
};

const namedCommentAnalytics: CommentAnalytics = {
  ...commentAnalytics,
  userRanking: [
    {
      userId: "wx-id-ranking",
      userName: "微信昵称排行",
      total: 3,
      pending: 1,
      approved: 2,
      rejected: 0,
      deleted: 0,
      highValueQuestions: 0,
      lastCommentAt: "2026-06-15T00:02:00.000Z",
    },
  ],
};

const namedLead: CustomerLead = {
  customerId: "wx-id-lead",
  customerName: "微信昵称线索",
  source: "wechat",
  sharedBy: "moderator-1",
  visitCount: 1,
  watchDurationSeconds: 120,
  commentCount: 1,
  pendingCommentCount: 0,
  approvedCommentCount: 1,
  rejectedCommentCount: 0,
  highValueQuestionCount: 0,
  questions: [],
  firstSeenAt: "2026-06-15T00:00:00.000Z",
  lastActiveAt: "2026-06-15T00:03:00.000Z",
  temperature: "warm",
  wecomStatus: "not_contacted",
  leadStage: "new",
  followUpStatus: "unassigned",
};

const namedMicRequest: MicRequest = {
  id: "mic-named",
  liveId: "demo-live",
  userId: "wx-id-mic",
  userName: "微信昵称连麦",
  status: "applied",
  reason: "想连麦",
  createdAt: "2026-06-15T00:04:00.000Z",
};

const namedParticipant: LiveParticipant = {
  id: "participant-named",
  liveId: "demo-live",
  userId: "wx-id-online",
  userName: "微信昵称在线",
  livekitIdentity: "private-demo-live-wx-id-online",
  role: "audience",
  joinTime: "2026-06-15T00:05:00.000Z",
  watchDuration: 0,
  isMuted: false,
  isBanned: false,
  canPublish: false,
};

describe("AdminConsole", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { origin: "https://live.fuguilong.cn" },
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("polls comments and keeps pending review items at the top", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/comments")) return payload<LiveComment[]>([approvedComment, pendingComment]);
      if (url.includes("/mic-requests")) return payload<MicRequest[]>([]);
      if (url.includes("/participants")) return payload<LiveParticipant[]>([]);
      if (url.includes("/stats")) return payload<LiveStats>(stats);
      if (url.includes("/share-ranking")) return payload([]);
      if (url.includes("/comment-analytics")) return payload<CommentAnalytics>(commentAnalytics);
      if (url.includes("/leads")) return payload<CustomerLead[]>([]);
      return payload(null);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AdminConsole
        liveSessions={[live]}
        initialComments={[approvedComment]}
        initialMicRequests={[]}
        initialParticipants={[]}
        stats={stats}
        initialShareRanking={[]}
        initialCommentAnalytics={commentAnalytics}
        initialCustomerLeads={[]}
      />,
    );

    expect(screen.queryByText("needs review")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(screen.getByText("needs review")).toBeInTheDocument();
    const rows = screen.getAllByTestId("admin-review-comment-row");
    expect(rows[0]).toHaveTextContent("needs review");
    expect(rows[1]).toHaveTextContent("already approved");
  });

  it("shows WeChat nicknames instead of raw user ids in moderation, search, leads, mic, and online tabs", async () => {
    vi.stubGlobal("fetch", vi.fn());

    function renderAdmin(initialTab: AdminTab) {
      cleanup();
      render(
        <AdminConsole
          liveSessions={[live]}
          initialComments={[namedPendingComment, namedApprovedComment]}
          initialMicRequests={[namedMicRequest]}
          initialParticipants={[namedParticipant]}
          stats={stats}
          initialShareRanking={[]}
          initialCommentAnalytics={namedCommentAnalytics}
          initialCustomerLeads={[namedLead]}
          initialTab={initialTab}
        />,
      );
    }

    renderAdmin("comments");
    expect(screen.getByTestId("admin-review-comments-panel")).toHaveTextContent("微信昵称待审");
    expect(screen.getByTestId("admin-review-comments-panel")).not.toHaveTextContent("wx-id-pending");

    renderAdmin("commentStats");
    expect(screen.getByTestId("admin-comment-search-panel")).toHaveTextContent("微信昵称发言");
    expect(screen.getByTestId("admin-comment-search-panel")).not.toHaveTextContent("wx-id-approved");
    expect(screen.getByTestId("admin-comment-ranking-panel")).toHaveTextContent("微信昵称排行");
    expect(screen.getByTestId("admin-comment-ranking-panel")).not.toHaveTextContent("wx-id-ranking");

    renderAdmin("leads");
    expect(screen.getByTestId("admin-leads-panel")).toHaveTextContent("微信昵称线索");
    expect(screen.getByTestId("admin-leads-panel")).not.toHaveTextContent("wx-id-lead");

    renderAdmin("mic");
    expect(screen.getByTestId("admin-mic-panel")).toHaveTextContent("微信昵称连麦");
    expect(screen.getByTestId("admin-mic-panel")).not.toHaveTextContent("wx-id-mic");

    renderAdmin("participants");
    expect(screen.getByTestId("admin-participants-panel")).toHaveTextContent("微信昵称在线");
    expect(screen.getByTestId("admin-participants-panel")).not.toHaveTextContent("wx-id-online");
  });

  it("edits and deletes live sessions from the live list", async () => {
    const scheduledLive: LiveSession = { ...live, status: "scheduled" };
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith("/api/live-sessions/demo-live") && init?.method === "PATCH") {
        return payload<LiveSession>({ ...scheduledLive, title: "修改后的直播", description: "修改后的说明" });
      }
      if (url.endsWith("/api/live-sessions/demo-live") && init?.method === "DELETE") {
        return payload<{ id: string }>({ id: "demo-live" });
      }
      return payload([]);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
        <AdminConsole
        liveSessions={[scheduledLive]}
        initialComments={[]}
        initialMicRequests={[]}
        initialParticipants={[]}
        stats={stats}
        initialShareRanking={[]}
        initialCommentAnalytics={commentAnalytics}
        initialCustomerLeads={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    fireEvent.change(screen.getByPlaceholderText("直播标题"), { target: { value: "修改后的直播" } });
    fireEvent.change(screen.getByPlaceholderText("直播说明"), { target: { value: "修改后的说明" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "保存" }));
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/live-sessions/demo-live", {
      method: "PATCH",
      body: JSON.stringify({ title: "修改后的直播", description: "修改后的说明" }),
    });
    expect(screen.getAllByText("修改后的直播").length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "删除" }));
    });

    expect(confirmSpy).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith("/api/live-sessions/demo-live", { method: "DELETE" });
    expect(screen.queryByText("修改后的直播")).not.toBeInTheDocument();
  });

  it("does not allow deleting a live session that is currently live", () => {
    vi.stubGlobal("fetch", vi.fn());

    render(
      <AdminConsole
        liveSessions={[live]}
        initialComments={[]}
        initialMicRequests={[]}
        initialParticipants={[]}
        stats={stats}
        initialShareRanking={[]}
        initialCommentAnalytics={commentAnalytics}
        initialCustomerLeads={[]}
      />,
    );

    expect(screen.getByRole("button", { name: "删除" })).toBeDisabled();
  });
});
