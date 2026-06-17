"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Mic, Send } from "lucide-react";
import type { LiveComment, LiveSession, LiveStats, MicRequest } from "@/lib/domain";
import { getOrCreateAudienceViewerId } from "@/lib/audience-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LiveKitAudiencePlayer } from "@/components/livekit-audience-player";

type Props = {
  live: LiveSession;
  comments: LiveComment[];
  stats: LiveStats;
  initialViewerId?: string;
};

function sortCommentsByTime(comments: LiveComment[]) {
  return [...comments].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function commentDisplayName(comment: LiveComment) {
  return comment.userName || comment.userId;
}

function mergeVisibleComments(current: LiveComment[], incoming: LiveComment[], viewerId: string) {
  const incomingIds = new Set(incoming.map((comment) => comment.id));
  const ownPendingComments = current.filter(
    (comment) => comment.userId === viewerId && comment.status === "pending" && !incomingIds.has(comment.id),
  );
  return sortCommentsByTime([...ownPendingComments, ...incoming]);
}

export function AudienceRoom({ live, comments: initialComments, stats, initialViewerId }: Props) {
  const commentInputRef = useRef<HTMLInputElement>(null);
  const commentsPanelRef = useRef<HTMLDivElement>(null);
  const [viewerId, setViewerId] = useState(initialViewerId && initialViewerId !== "audience-1" ? initialViewerId : "");
  const [comments, setComments] = useState(sortCommentsByTime(initialComments));
  const [content, setContent] = useState("");
  const [micStatus, setMicStatus] = useState("未申请");
  const [micRequestId, setMicRequestId] = useState("");
  const [micApproved, setMicApproved] = useState(false);
  const [isApplyingMic, setIsApplyingMic] = useState(false);
  const [liveStats, setLiveStats] = useState(stats);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setViewerId(getOrCreateAudienceViewerId(window.localStorage, initialViewerId));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialViewerId]);

  useEffect(() => {
    if (!commentsPanelRef.current) return;
    commentsPanelRef.current.scrollTop = commentsPanelRef.current.scrollHeight;
  }, [comments.length]);

  const statusText = live.status === "live" ? "直播中" : live.status === "ended" ? "已结束" : "未开播";

  useEffect(() => {
    if (!viewerId) return;

    const sendHeartbeat = () => {
      void Promise.resolve(
        fetch(`/api/live-sessions/${live.id}/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: viewerId, role: "audience" }),
          keepalive: true,
        }),
      ).catch(() => {
        // Keep watching even if one heartbeat fails.
      });
    };

    sendHeartbeat();
    const timer = window.setInterval(sendHeartbeat, 15000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") sendHeartbeat();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [live.id, viewerId]);

  useEffect(() => {
    if (!viewerId) return;

    let ignore = false;
    async function fetchVisibleComments() {
      const response = await fetch(`/api/live-sessions/${live.id}/comments?viewerId=${encodeURIComponent(viewerId)}`);
      const payload = await response.json();
      if (!ignore && payload.ok && Array.isArray(payload.data)) {
        setComments((current) => mergeVisibleComments(current, payload.data, viewerId));
      }
    }

    void fetchVisibleComments();
    const timer = window.setInterval(fetchVisibleComments, 5000);
    return () => {
      ignore = true;
      window.clearInterval(timer);
    };
  }, [live.id, viewerId]);

  useEffect(() => {
    let ignore = false;

    async function fetchStats() {
      try {
        const response = await fetch(`/api/live-sessions/${live.id}/stats`);
        const payload = await response.json();
        if (!ignore && payload.ok) setLiveStats(payload.data);
      } catch {
        // Keep the current count visible if a refresh fails.
      }
    }

    void fetchStats();
    const timer = window.setInterval(fetchStats, 3000);
    return () => {
      ignore = true;
      window.clearInterval(timer);
    };
  }, [live.id]);

  useEffect(() => {
    if (!viewerId || !micRequestId) return;

    let ignore = false;
    async function fetchMicStatus() {
      const response = await fetch(`/api/live-sessions/${live.id}/mic-requests?userId=${encodeURIComponent(viewerId)}`);
      const payload = await response.json();
      if (ignore || !payload.ok) return;

      const request = (payload.data as MicRequest[]).find((item) => item.id === micRequestId);
      if (!request) return;

      if (request.status === "approved" || request.status === "connected") {
        setMicApproved(true);
        setMicStatus("连麦中");
        return;
      }

      if (request.status === "rejected") {
        setMicApproved(false);
        setMicStatus("暂未接通，请稍后再试");
        return;
      }

      if (request.status === "ended" || request.status === "cancelled" || request.status === "kicked") {
        setMicApproved(false);
        setMicRequestId("");
        setMicStatus("未申请");
      }
    }

    void fetchMicStatus();
    const timer = window.setInterval(fetchMicStatus, 3000);
    return () => {
      ignore = true;
      window.clearInterval(timer);
    };
  }, [live.id, micRequestId, viewerId]);

  async function sendComment() {
    if (!content.trim() || !viewerId) return;
    const response = await fetch(`/api/live-sessions/${live.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: viewerId, content }),
    });
    const payload = await response.json();
    if (payload.ok) {
      setComments((items) => sortCommentsByTime([...items, payload.data]));
      setContent("");
    }
  }

  async function applyMic() {
    if (!viewerId || isApplyingMic || micRequestId) return;
    setIsApplyingMic(true);
    setMicStatus("申请中");

    try {
      const response = await fetch(`/api/live-sessions/${live.id}/mic-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: viewerId, reason: "想上麦咨询产品细节" }),
      });
      const payload = await response.json();
      if (payload.ok) {
        setMicStatus("申请中");
        setMicRequestId(payload.data.id);
      } else {
        setMicStatus(`申请失败：${payload.error ?? "请稍后再试"}`);
      }
    } catch {
      setMicStatus("申请失败：网络连接异常");
    } finally {
      setIsApplyingMic(false);
    }
  }

  async function endMic() {
    if (!viewerId || !micRequestId) return;

    try {
      const response = await fetch(`/api/live-sessions/${live.id}/mic-requests/${micRequestId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: viewerId }),
      });
      const payload = await response.json();
      if (payload.ok) {
        setMicApproved(false);
        setMicRequestId("");
        setMicStatus("未申请");
      } else {
        setMicStatus(`结束失败：${payload.error ?? "请稍后再试"}`);
      }
    } catch {
      setMicStatus("结束失败：网络连接异常");
    }
  }

  function focusCommentInput() {
    commentInputRef.current?.focus();
    if (typeof commentInputRef.current?.scrollIntoView === "function") {
      commentInputRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  const isMicConnected = micStatus === "连麦中";
  const micButtonText = isApplyingMic || micStatus === "申请中" ? "申请中" : isMicConnected ? "连麦中" : "申请连麦";

  return (
    <main className="mx-auto min-h-screen max-w-md bg-background">
      <section className="video-grid relative aspect-[9/16] min-h-[520px] overflow-hidden">
        <LiveKitAudiencePlayer
          liveId={live.id}
          liveStatus={live.status}
          viewerId={viewerId}
          micApproved={micApproved}
          hostIdentity={`${live.roomName}-${live.hostUserId}`}
        />
        <div className="absolute left-4 top-4 flex gap-2">
          <Badge variant={live.status === "live" ? "success" : "warning"}>{statusText}</Badge>
          <Badge variant="outline">{liveStats.currentOnline} 在线</Badge>
        </div>
        <div className="absolute inset-x-5 bottom-5 space-y-3">
          <p className="text-sm text-muted-foreground">LiveKit Room: {live.roomName}</p>
          <h1 className="text-3xl font-semibold">{live.title}</h1>
        </div>
      </section>

      <section className="grid gap-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={focusCommentInput}>
            <MessageCircle className="h-4 w-4" /> 留言互动
          </Button>
          <Button onClick={applyMic} disabled={!viewerId || isApplyingMic || Boolean(micRequestId)}>
            <Mic className="h-4 w-4" /> {micButtonText}
          </Button>
        </div>
        {isMicConnected ? (
          <Button type="button" variant="outline" onClick={() => void endMic()}>
            结束连麦
          </Button>
        ) : null}
        <section className="grid gap-3 rounded-md bg-card/70 p-3">
          <h3 className="text-sm font-semibold">留言互动</h3>
          <p className="text-xs text-muted-foreground">把想问的问题发给主播，场控会挑选适合的问题展示。</p>
          <div data-testid="audience-comment-compose" className="grid grid-cols-[1fr_auto] items-center gap-2">
            <input
              ref={commentInputRef}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="输入想问主播的问题"
              className="h-10 w-full rounded-md border-0 bg-background/80 px-3 py-2 text-sm outline-none shadow-none transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
            <Button onClick={sendComment} disabled={!viewerId || !content.trim()}>
              <Send className="h-4 w-4" /> 发送
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">连麦状态：{micStatus}</p>
          <div
            ref={commentsPanelRef}
            data-testid="audience-comments-panel"
            className="grid max-h-[132px] overflow-y-auto text-xs"
          >
            {comments.map((comment) => (
              <div
                key={comment.id}
                data-testid="audience-comment-row"
                className="grid grid-cols-[72px_1fr] items-start gap-2 py-1 leading-tight"
              >
                <span className="truncate text-muted-foreground">{commentDisplayName(comment)}</span>
                <span className="line-clamp-1">{comment.content}</span>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
