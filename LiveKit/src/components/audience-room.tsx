"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Mic, Send } from "lucide-react";
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
  hasAccessPassword?: boolean;
};

const VIEWER_NAME_KEY = "wechat-live-viewer-name";
const VIEWER_NAME_SOURCE_KEY = "wechat-live-viewer-name-source";

type WeChatProfilePayload = {
  viewerId: string;
  nickname?: string;
  authUrl?: string;
  source?: string;
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


export function AudienceRoom({ live, comments: initialComments, stats, initialViewerId, hasAccessPassword }: Props) {
  const commentInputRef = useRef<HTMLInputElement>(null);
  const commentsPanelRef = useRef<HTMLDivElement>(null);
  const [viewerId, setViewerId] = useState(initialViewerId && initialViewerId !== "audience-1" ? initialViewerId : "");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isAuthorizingName, setIsAuthorizingName] = useState(false);
  const [authorizationError, setAuthorizationError] = useState("");
  const [comments, setComments] = useState(sortCommentsByTime(initialComments));
  const [content, setContent] = useState("");
  const [micStatus, setMicStatus] = useState("未申请");
  const [micRequestId, setMicRequestId] = useState("");
  const [micApproved, setMicApproved] = useState(false);
  const [isApplyingMic, setIsApplyingMic] = useState(false);
  const [isSendingLike, setIsSendingLike] = useState(false);
  const [liveStats, setLiveStats] = useState(stats);
  const [accessPasswordValue, setAccessPasswordValue] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordVerified, setPasswordVerified] = useState(!hasAccessPassword);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);

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

  const finishWeChatAuthorization = useCallback(async (nextViewerId: string, name: string, source = "fallback") => {
    setViewerId(nextViewerId);

    const joinResponse = await fetch(`/api/live-sessions/${live.id}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: nextViewerId, role: "audience", displayName: name }),
    });
    const joinPayload = await joinResponse.json();
    if (!joinPayload.ok) throw new Error(`进入失败：${joinPayload.error ?? "请稍后重试"}`);

    window.localStorage.setItem(VIEWER_NAME_KEY, name);
    window.localStorage.setItem(VIEWER_NAME_SOURCE_KEY, source);
    setIsAuthorized(true);

    const eventResponse = await fetch(`/api/live-sessions/${live.id}/audience-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: nextViewerId, type: "join" }),
    });
    const eventPayload = await eventResponse.json();
    if (eventPayload.ok) {
      setComments((items) => sortCommentsByTime([...items, eventPayload.data]));
    }
  }, [live.id]);

  const authorizeWeChatName = useCallback(async (explicitViewerId?: string, code?: string) => {
    const nextViewerId = explicitViewerId || viewerId || getOrCreateAudienceViewerId(window.localStorage, initialViewerId);
    setViewerId(nextViewerId);
    setIsAuthorizingName(true);
    setAuthorizationError("");

    try {
      const params = new URLSearchParams({ viewerId: nextViewerId });
      if (code) params.set("code", code);
      else params.set("returnTo", window.location.href);

      const profileResponse = await fetch(`/api/live-sessions/${live.id}/wechat-profile?${params.toString()}`);
      const profilePayload = await profileResponse.json();
      if (!profilePayload.ok) throw new Error(profilePayload.error || "WECHAT_PROFILE_FAILED");

      const profile = profilePayload.data as WeChatProfilePayload;
      if (profile.authUrl) {
        window.location.assign(profile.authUrl);
        return;
      }

      const name = profile.nickname?.trim();
      if (!name) throw new Error("WECHAT_PROFILE_EMPTY");
      await finishWeChatAuthorization(profile.viewerId || nextViewerId, name, profile.source);

      if (code && window.history.replaceState) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    } catch (error) {
      setAuthorizationError(error instanceof Error ? error.message : "暂时无法获取微信昵称，请稍后重试。");
    } finally {
      setIsAuthorizingName(false);
    }
  }, [finishWeChatAuthorization, initialViewerId, live.id, viewerId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextViewerId = getOrCreateAudienceViewerId(window.localStorage, initialViewerId);
      const storedName = window.localStorage.getItem(VIEWER_NAME_KEY)?.trim();
      const storedNameSource = window.localStorage.getItem(VIEWER_NAME_SOURCE_KEY)?.trim();
      setViewerId(nextViewerId);
      if (storedName && (storedNameSource === "wechat" || storedNameSource === "fallback")) {
        setIsAuthorized(true);
        return;
      }

      const query = new URLSearchParams(window.location.search);
      const code = query.get("code")?.trim();
      const state = query.get("state")?.trim();
      if (code) {
        void authorizeWeChatName(state || nextViewerId, code);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [authorizeWeChatName, initialViewerId]);

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

  async function sendLike() {
    if (!viewerId || isSendingLike) return;
    setIsSendingLike(true);
    try {
      const response = await fetch(`/api/live-sessions/${live.id}/audience-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: viewerId, type: "like" }),
      });
      const payload = await response.json();
      if (payload.ok) {
        setComments((items) => sortCommentsByTime([...items, payload.data]));
        setLiveStats((current) => ({ ...current, likeCount: current.likeCount + 1 }));
      }
    } finally {
      setIsSendingLike(false);
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
  async function submitAccessPassword() {
  if (!accessPasswordValue.trim() || isVerifyingPassword) return;
  setIsVerifyingPassword(true);
  setPasswordError("");
  try {
    const response = await fetch(`/api/live-sessions/${live.id}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: `pwd-${Date.now()}`, role: "audience", accessPassword: accessPasswordValue }),
    });
    const payload = await response.json();
    if (payload.ok) {
      setPasswordVerified(true);
    } else if (payload.error === "ACCESS_PASSWORD_INCORRECT") {
      setPasswordError("访问密码错误，请重试");
    } else {
      setPasswordError("验证失败，请稍后重试");
    }
  } catch {
    setPasswordError("网络异常，请稍后重试");
  } finally {
    setIsVerifyingPassword(false);
  }
}

  return (
    <>
    <main className="mx-auto min-h-screen max-w-md bg-background">
    {!passwordVerified && hasAccessPassword ? (
      <section className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-6">
        <div className="grid w-full max-w-xs gap-3 rounded-md bg-background p-4 text-foreground shadow-xl">
      <h2 className="text-base font-semibold">请输入访问密码</h2>
      <p className="text-sm leading-6 text-muted-foreground">该直播房间需要密码才能进入</p>
      <input
        type="password"
        value={accessPasswordValue}
        onChange={(event) => { setAccessPasswordValue(event.target.value); setPasswordError(""); }}
        placeholder="输入密码"
        className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        autoFocus
        disabled={isVerifyingPassword}
        onKeyDown={(event) => { if (event.key === "Enter") void submitAccessPassword(); }}
      />
      {passwordError ? <p className="text-xs text-destructive">{passwordError}</p> : null}
      <Button onClick={() => void submitAccessPassword()}
              disabled={isVerifyingPassword || !accessPasswordValue.trim()}>
        {isVerifyingPassword ? "验证中…" : "确认"}
      </Button>
        </div>
      </section>
    ) : null}
      <section className="video-grid relative aspect-[9/16] min-h-[520px] overflow-hidden bg-black text-white">
        <LiveKitAudiencePlayer
          liveId={live.id}
          liveStatus={live.status}
          viewerId={viewerId}
          micApproved={micApproved}
          hostIdentity={`${live.roomName}-${live.hostUserId}`}
          cdnPlayUrl={live.cdnPlayUrl}
        />
        <div
          data-testid="audience-title-overlay"
          className="absolute left-4 top-4 max-w-[58%] drop-shadow"
        >
          <h1 className="line-clamp-2 text-xl font-semibold leading-tight">{live.title}</h1>
        </div>
        <div
          data-testid="audience-status-overlay"
          className="absolute right-4 top-4 flex flex-col items-end gap-1"
        >
          <Badge variant={live.status === "live" ? "success" : "warning"}>{statusText}</Badge>
          <Badge variant="outline" className="border-white/40 bg-black/25 text-white">
            {liveStats.currentOnline} 在线
          </Badge>
        </div>
        <div
          data-testid="audience-comments-overlay"
          className="absolute inset-x-4 bottom-5 bg-transparent"
        >
          <div
            ref={commentsPanelRef}
            data-testid="audience-comments-panel"
            className="grid max-h-[132px] overflow-y-auto text-xs text-white [scrollbar-width:none]"
          >
            {comments.map((comment) => (
              <div
                key={comment.id}
                data-testid="audience-comment-row"
                className="grid grid-cols-[76px_1fr] items-start gap-2 py-1 leading-tight drop-shadow"
              >
                <span className="truncate text-white/75">{commentDisplayName(comment)}</span>
                <span className="line-clamp-1">{comment.content}</span>
              </div>
            ))}
          </div>
        </div>
        {!isAuthorized ? (
          <div className="absolute inset-0 z-10 grid place-items-center bg-black/55 p-6">
            <section
              data-testid="wechat-auth-panel"
              className="grid w-full max-w-xs gap-3 rounded-md bg-background p-4 text-foreground shadow-xl"
            >
              <h2 className="text-base font-semibold">微信昵称授权</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                同意后将通过微信授权自动获取昵称并进入直播间。
              </p>
              {authorizationError ? <p className="text-xs text-destructive">{authorizationError}</p> : null}
              <Button
                type="button"
                data-testid="wechat-auto-auth-button"
                onClick={() => void authorizeWeChatName()}
                disabled={isAuthorizingName}
              >
                {isAuthorizingName ? "获取中..." : "同意授权并进入"}
              </Button>
            </section>
          </div>
        ) : null}
      </section>

      <section className="grid gap-3 p-4">
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <Button variant="secondary" onClick={focusCommentInput}>
            <MessageCircle className="h-4 w-4" /> 留言互动
          </Button>
          <Button onClick={applyMic} disabled={!viewerId || isApplyingMic || Boolean(micRequestId)}>
            <Mic className="h-4 w-4" /> {micButtonText}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            data-testid="audience-like-button"
            aria-label="点赞主播"
            onClick={() => void sendLike()}
            disabled={!viewerId || isSendingLike}
          >
            <Heart className="h-4 w-4" />
          </Button>
        </div>
        {isMicConnected ? (
          <Button type="button" variant="outline" onClick={() => void endMic()}>
            结束连麦
          </Button>
        ) : null}
        <div data-testid="audience-comment-compose" className="grid grid-cols-[1fr_auto] items-center gap-2">
          <input
            ref={commentInputRef}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="输入想问主播的问题"
            className="h-10 w-full rounded-md border-0 bg-transparent px-3 py-2 text-sm outline-none shadow-none transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
          <Button onClick={sendComment} disabled={!viewerId || !content.trim()}>
            <Send className="h-4 w-4" /> 发送
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">连麦状态：{micStatus}</p>
      </section>
    </main>
    </>
  );
}
