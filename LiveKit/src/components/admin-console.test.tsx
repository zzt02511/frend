/**
 * @vitest-environment jsdom
 */
import { act, render, screen } from "@testing-library/react";
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

function payload<T>(data: T) {
  return Promise.resolve({ json: async () => ({ ok: true, data }) });
}

describe("AdminConsole", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { origin: "https://live.fuguilong.cn" },
    });
  });

  afterEach(() => {
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
});
