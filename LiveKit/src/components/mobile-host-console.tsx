"use client";

import { useEffect, useRef, useState } from "react";
import {
  createLocalTracks,
  LocalVideoTrack,
  Room,
  RoomEvent,
  Track,
  type LocalTrack,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from "livekit-client";
import { Camera, Mic, RefreshCw, RotateCcw } from "lucide-react";
import type { LiveComment, LiveKitAccessToken, LiveSession, LiveStats, LiveStatus, MicRequest } from "@/lib/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const liveStatusText: Record<LiveStatus, string> = {
  draft: "草稿",
  scheduled: "未开播",
  live: "直播中",
  ended: "已结束",
  closed: "已关闭",
};

type LiveAction = "start" | "end";
type HostMicVideoTrack = { identity: string; track: RemoteTrack };

function prepareInlineVideo(videoElement: HTMLVideoElement, muted = true) {
  videoElement.autoplay = true;
  videoElement.muted = muted;
  videoElement.defaultMuted = muted;
  videoElement.preload = "auto";
  videoElement.playsInline = true;
  videoElement.setAttribute("preload", "auto");
  videoElement.setAttribute("playsinline", "true");
  videoElement.setAttribute("webkit-playsinline", "true");
  videoElement.setAttribute("x-webkit-airplay", "allow");
}

function playMedia(videoElement: HTMLVideoElement) {
  prepareInlineVideo(videoElement);
  const playPromise = videoElement.play();
  if (playPromise?.catch) {
    void playPromise.catch(() => undefined);
  }
}

function sortCommentsByTime(comments: LiveComment[]) {
  return [...comments].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function commentDisplayName(comment: LiveComment) {
  return comment.userName || comment.userId;
}

function HostMicVideoTile({
  track,
  testId,
  visible,
}: {
  track?: RemoteTrack;
  testId: string;
  visible: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    prepareInlineVideo(videoElement);
    if (!track) {
      videoElement.srcObject = null;
      return;
    }

    track.attach(videoElement);
    playMedia(videoElement);
    return () => {
      if (typeof track.detach === "function") track.detach(videoElement);
      videoElement.srcObject = null;
    };
  }, [track]);

  return (
    <video
      ref={videoRef}
      data-testid={testId}
      autoPlay
      muted
      preload="auto"
      playsInline
      className={`h-28 w-20 shrink-0 rounded-lg border border-white/70 bg-black object-cover shadow-2xl ${
        visible ? "block" : "hidden"
      }`}
    />
  );
}

export function MobileHostConsole({
  live,
  comments,
  stats,
  micRequests,
}: {
  live: LiveSession;
  comments: LiveComment[];
  stats: LiveStats;
  micRequests: MicRequest[];
}) {
  const hostIdentity = `${live.roomName}-${live.hostUserId}`;
  const videoRef = useRef<HTMLVideoElement>(null);
  const commentsPanelRef = useRef<HTMLDivElement>(null);
  const audioContainerRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<Room | null>(null);
  const localTracksRef = useRef<LocalTrack[]>([]);
  const remoteAudioRef = useRef<Set<HTMLMediaElement>>(new Set());
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [cameraState, setCameraState] = useState("未开启设备");
  const [liveStatus, setLiveStatus] = useState(live.status);
  const [actionMessage, setActionMessage] = useState("");
  const [isDeviceLoading, setIsDeviceLoading] = useState(false);
  const [isLiveMutating, setIsLiveMutating] = useState(false);
  const [hasMicGuest, setHasMicGuest] = useState(false);
  const [micVideoTracks, setMicVideoTracks] = useState<HostMicVideoTrack[]>([]);
  const [hostComments, setHostComments] = useState(sortCommentsByTime(comments));
  const [liveStats, setLiveStats] = useState(stats);
  const [pendingMicRequests, setPendingMicRequests] = useState(
    micRequests.filter((request) => request.status === "applied"),
  );
  const [connectedMicRequests, setConnectedMicRequests] = useState(
    micRequests.filter((request) => request.status === "approved" || request.status === "connected"),
  );
  const [micActionMessage, setMicActionMessage] = useState("");

  useEffect(() => {
    if (videoRef.current) prepareInlineVideo(videoRef.current);
  }, []);

  useEffect(() => {
    if (!commentsPanelRef.current) return;
    commentsPanelRef.current.scrollTop = commentsPanelRef.current.scrollHeight;
  }, [hostComments.length]);

  useEffect(() => {
    const sendHeartbeat = () => {
      void Promise.resolve(
        fetch(`/api/live-sessions/${live.id}/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: live.hostUserId, role: "host" }),
          keepalive: true,
        }),
      ).catch(() => undefined);
    };

    sendHeartbeat();
    const timer = window.setInterval(sendHeartbeat, 15000);
    return () => window.clearInterval(timer);
  }, [live.hostUserId, live.id]);

  useEffect(() => {
    let ignore = false;

    async function fetchLiveStats() {
      try {
        const response = await fetch(`/api/live-sessions/${live.id}/stats`);
        const payload = await response.json();
        if (!ignore && payload.ok && typeof payload.data?.currentOnline === "number") {
          setLiveStats(payload.data);
        }
      } catch {
        // Keep the current online number visible if polling fails.
      }
    }

    const timer = window.setInterval(fetchLiveStats, 3000);
    return () => {
      ignore = true;
      window.clearInterval(timer);
    };
  }, [live.id]);

  useEffect(() => {
    let ignore = false;

    async function fetchPendingMicRequests() {
      try {
        const response = await fetch(`/api/live-sessions/${live.id}/mic-requests`);
        const payload = await response.json();
        if (ignore || !payload.ok || !Array.isArray(payload.data)) return;

        const requests = payload.data as MicRequest[];
        setPendingMicRequests(requests.filter((request) => request.status === "applied"));
        setConnectedMicRequests(
          requests.filter((request) => request.status === "approved" || request.status === "connected"),
        );
      } catch {
        // Keep the current list visible if polling fails.
      }
    }

    void fetchPendingMicRequests();
    const timer = window.setInterval(fetchPendingMicRequests, 3000);
    return () => {
      ignore = true;
      window.clearInterval(timer);
    };
  }, [live.id]);

  useEffect(() => {
    let ignore = false;

    async function fetchHostComments() {
      try {
        const response = await fetch(`/api/live-sessions/${live.id}/comments`);
        const payload = await response.json();
        if (ignore || !payload.ok || !Array.isArray(payload.data)) return;

        setHostComments(sortCommentsByTime((payload.data as LiveComment[]).filter((comment) => comment.status === "approved")));
      } catch {
        // Keep the current comments visible if polling fails.
      }
    }

    const timer = window.setInterval(fetchHostComments, 3000);
    return () => {
      ignore = true;
      window.clearInterval(timer);
    };
  }, [live.id]);

  function isHostParticipant(participant?: RemoteParticipant) {
    return participant?.identity === hostIdentity;
  }

  function attachRemoteTrack(
    track: RemoteTrack,
    _publication?: RemoteTrackPublication,
    participant?: RemoteParticipant,
  ) {
    if (isHostParticipant(participant)) return;

    if (track.kind === Track.Kind.Video) {
      const identity = participant?.identity ?? track.sid ?? `${track.kind}-remote`;
      setMicVideoTracks((tracks) => {
        const next = tracks.filter((item) => item.identity !== identity);
        return [...next, { identity, track }];
      });
      setHasMicGuest(true);
    }

    if (track.kind === Track.Kind.Audio && audioContainerRef.current) {
      const audioElement = track.attach();
      audioElement.autoplay = true;
      remoteAudioRef.current.add(audioElement);
      audioContainerRef.current.appendChild(audioElement);
    }
  }

  function detachRemoteTrack(
    track: RemoteTrack,
    _publication?: RemoteTrackPublication,
    participant?: RemoteParticipant,
  ) {
    if (isHostParticipant(participant)) return;

    if (track.kind === Track.Kind.Video) {
      const identity = participant?.identity ?? track.sid ?? `${track.kind}-remote`;
      setMicVideoTracks((tracks) => {
        const next = tracks.filter((item) => item.identity !== identity);
        setHasMicGuest(next.length > 0);
        return next;
      });
    }
  }

  function handleRemoteParticipantDisconnected(participant: RemoteParticipant) {
    if (isHostParticipant(participant)) return;

    setMicVideoTracks((tracks) => {
      const next = tracks.filter((item) => item.identity !== participant.identity);
      setHasMicGuest(next.length > 0);
      return next;
    });
  }

  function stopCurrentStream() {
    localTracksRef.current.forEach((track) => {
      track.detach();
      track.stop();
    });
    localTracksRef.current = [];
    remoteAudioRef.current.forEach((element) => element.remove());
    remoteAudioRef.current.clear();
    roomRef.current?.off(RoomEvent.TrackSubscribed, attachRemoteTrack);
    roomRef.current?.off(RoomEvent.TrackUnsubscribed, detachRemoteTrack);
    roomRef.current?.off(RoomEvent.ParticipantDisconnected, handleRemoteParticipantDisconnected);
    roomRef.current?.disconnect();
    roomRef.current = null;
    setMicVideoTracks([]);
    setHasMicGuest(false);
  }

  async function fetchHostToken(): Promise<LiveKitAccessToken> {
    const response = await fetch(`/api/live-sessions/${live.id}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: live.hostUserId, role: "host" }),
    });
    const payload = await response.json();

    if (!payload.ok) {
      throw new Error(payload.error ?? "TOKEN_FAILED");
    }

    return payload.data;
  }

  async function openCamera(nextFacing = facingMode) {
    if (!navigator.mediaDevices?.getUserMedia) {
      const secureContextMessage =
        typeof window !== "undefined" && !window.isSecureContext
          ? "当前是 HTTP 访问，手机浏览器会拦截摄像头和麦克风；请使用 HTTPS 域名开播。"
          : "当前浏览器不支持摄像头和麦克风调用，请换系统浏览器或最新版微信。";
      setCameraState(secureContextMessage);
      return;
    }

    setIsDeviceLoading(true);
    setCameraState("正在连接 LiveKit 并请求设备权限...");

    try {
      stopCurrentStream();
      const token = await fetchHostToken();
      const room = new Room({ adaptiveStream: true, dynacast: true });
      room.on(RoomEvent.TrackSubscribed, attachRemoteTrack);
      room.on(RoomEvent.TrackUnsubscribed, detachRemoteTrack);
      room.on(RoomEvent.ParticipantDisconnected, handleRemoteParticipantDisconnected);
      room.on(RoomEvent.Disconnected, () => setCameraState("已断开推流"));
      await room.connect(token.serverUrl, token.token);

      const tracks = await createLocalTracks({
        audio: true,
        video: { facingMode: nextFacing },
      });

      for (const track of tracks) {
        await room.localParticipant.publishTrack(track);
      }

      const videoTrack = tracks.find((track) => track.kind === Track.Kind.Video);
      if (videoRef.current && videoTrack) {
        prepareInlineVideo(videoRef.current);
        videoTrack.attach(videoRef.current);
        playMedia(videoRef.current);
      }

      room.remoteParticipants.forEach((participant) => {
        participant.trackPublications.forEach((publication) => {
          if (publication.track) attachRemoteTrack(publication.track, publication, participant);
        });
      });

      roomRef.current = room;
      localTracksRef.current = tracks;
      setCameraState("已连接 LiveKit，正在推流");
    } catch (error) {
      stopCurrentStream();
      const message = error instanceof Error ? error.message : "设备权限或推流连接失败";
      setCameraState(`设备开启失败：${message}`);
    } finally {
      setIsDeviceLoading(false);
    }
  }

  async function switchCamera() {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);

    const videoTrack = localTracksRef.current.find(
      (track): track is LocalVideoTrack => track instanceof LocalVideoTrack,
    );

    if (!videoTrack) {
      await openCamera(next);
      return;
    }

    setIsDeviceLoading(true);
    setCameraState("正在切换镜头...");
    try {
      await videoTrack.restartTrack({ facingMode: next });
      if (videoRef.current) {
        prepareInlineVideo(videoRef.current);
        videoTrack.attach(videoRef.current);
      }
      setCameraState("镜头已切换，正在推流");
    } catch (error) {
      const message = error instanceof Error ? error.message : "切换镜头失败";
      setCameraState(`切换镜头失败：${message}`);
    } finally {
      setIsDeviceLoading(false);
    }
  }

  async function mutateLive(action: LiveAction) {
    setIsLiveMutating(true);
    setActionMessage(action === "start" ? "正在开播..." : "正在结束直播...");

    try {
      const response = await fetch(`/api/live-sessions/${live.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payload = await response.json();

      if (!payload.ok) {
        setActionMessage(`操作失败：${payload.error ?? "未知错误"}`);
        return;
      }

      setLiveStatus(payload.data.status);
      if (action === "end") {
        stopCurrentStream();
      }
      setActionMessage(action === "start" ? "已开播" : "已结束直播");
    } catch (error) {
      const message = error instanceof Error ? error.message : "网络请求失败";
      setActionMessage(`操作失败：${message}`);
    } finally {
      setIsLiveMutating(false);
    }
  }

  async function mutateMicRequest(requestId: string, action: "approve" | "reject" | "end") {
    setMicActionMessage(
      action === "approve" ? "正在接通观众..." : action === "reject" ? "正在拒绝连麦..." : "正在结束连麦...",
    );

    try {
      const response = await fetch(`/api/live-sessions/${live.id}/mic-requests/${requestId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payload = await response.json();

      if (!payload.ok) {
        setMicActionMessage(`连麦处理失败：${payload.error ?? "未知错误"}`);
        return;
      }

      setPendingMicRequests((items) => items.filter((item) => item.id !== requestId));
      setConnectedMicRequests((items) => items.filter((item) => item.id !== requestId));
      setMicActionMessage(
        action === "approve" ? "已通过连麦，等待观众接入" : action === "reject" ? "已拒绝连麦" : "已结束连麦",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "网络请求失败";
      setMicActionMessage(`连麦处理失败：${message}`);
    }
  }

  const statusMessages = [cameraState, actionMessage, micActionMessage].filter(Boolean);

  return (
    <main className="mx-auto h-screen max-w-md overflow-hidden bg-background p-2">
      <section className="flex h-full min-h-0 flex-col gap-1.5">
        <div
          data-testid="host-video-surface"
          className="video-grid relative min-h-[340px] flex-1 overflow-hidden rounded-lg bg-black"
        >
          <video ref={videoRef} autoPlay muted preload="auto" playsInline className="h-full w-full object-cover" />
          <div className="absolute left-3 top-3 max-w-[68%] rounded-md bg-black/55 px-3 py-2 text-white backdrop-blur">
            <p className="truncate text-xs opacity-80">当前直播</p>
            <p className="line-clamp-2 text-sm font-medium">{live.title}</p>
          </div>
          <Badge
            variant={liveStatus === "live" ? "success" : "warning"}
            className="absolute right-3 top-3 bg-background/90"
          >
            状态：{liveStatusText[liveStatus]}
          </Badge>
          <Badge variant="outline" className="absolute right-3 top-10 bg-background/90">
            {liveStats.currentOnline} 在线
          </Badge>
          <div className="absolute bottom-3 right-3 z-20 flex max-w-[74%] gap-2 overflow-x-auto">
            <HostMicVideoTile track={micVideoTracks[0]?.track} testId="host-mic-preview" visible={hasMicGuest} />
            {micVideoTracks.slice(1).map((item) => (
              <HostMicVideoTile key={item.identity} track={item.track} testId="host-mic-preview-extra" visible />
            ))}
          </div>
          <div ref={audioContainerRef} className="hidden" />
        </div>

        <div
          data-testid="first-screen-mic-requests"
          className="max-h-20 overflow-y-auto rounded-md bg-secondary/70 px-2 py-1.5 text-xs"
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="font-medium">连麦申请</span>
            <span className="text-muted-foreground">{pendingMicRequests.length}</span>
          </div>
          {pendingMicRequests.length === 0 ? <p className="text-muted-foreground">暂无申请</p> : null}
          {pendingMicRequests.map((request) => (
            <div key={request.id} className="mb-1 grid grid-cols-[1fr_auto] items-center gap-2 last:mb-0">
              <div className="min-w-0">
                <p className="truncate font-medium">{request.userId}</p>
                <p className="truncate text-muted-foreground">{request.reason}</p>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  type="button"
                  className="h-6 px-2 text-xs"
                  onClick={() => void mutateMicRequest(request.id, "approve")}
                >
                  通过
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  className="h-6 px-2 text-xs"
                  onClick={() => void mutateMicRequest(request.id, "reject")}
                >
                  拒绝
                </Button>
              </div>
            </div>
          ))}
          <div data-testid="host-connected-mic-guests" className="mt-1 grid gap-1">
            {connectedMicRequests.map((request) => (
              <div key={request.id} className="grid grid-cols-[1fr_auto] items-center gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{request.userId}</p>
                  <p className="truncate text-muted-foreground">连麦中</p>
                </div>
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  className="h-6 px-2 text-xs"
                  onClick={() => void mutateMicRequest(request.id, "end")}
                >
                  结束连麦
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <Button className="h-9 px-2 text-xs" type="button" onClick={() => void openCamera()} disabled={isDeviceLoading}>
            <Camera className="h-3.5 w-3.5" /> {isDeviceLoading ? "开启中" : "开启设备"}
          </Button>
          <Button className="h-9 px-2 text-xs" type="button" variant="secondary" onClick={() => void switchCamera()} disabled={isDeviceLoading}>
            <RotateCcw className="h-3.5 w-3.5" /> 切镜头
          </Button>
          <Button className="h-9 px-2 text-xs" type="button" variant="secondary" onClick={() => void mutateLive("start")} disabled={isLiveMutating}>
            <Mic className="h-3.5 w-3.5" /> 开播
          </Button>
          <Button className="h-9 px-2 text-xs" type="button" variant="destructive" onClick={() => void mutateLive("end")} disabled={isLiveMutating}>
            <RefreshCw className="h-3.5 w-3.5" /> 结束
          </Button>
        </div>

        <div
          data-testid="host-status-line"
          className="flex h-8 items-center gap-2 overflow-x-auto whitespace-nowrap rounded-md bg-secondary/50 px-3 text-xs text-muted-foreground"
        >
          {statusMessages.map((message, index) => (
            <span key={`${message}-${index}`} className="shrink-0">
              {index > 0 ? "· " : ""}
              {message}
            </span>
          ))}
        </div>

        <section className="overflow-hidden rounded-md bg-card/70">
          <div className="px-2 pb-1 pt-2">
            <h3 className="text-sm font-semibold">观众互动</h3>
          </div>
          <div
            ref={commentsPanelRef}
            data-testid="host-first-screen-comments"
            className="grid max-h-[108px] overflow-y-auto px-2 pb-2 pt-0 text-xs"
          >
            {hostComments.length === 0 ? <p className="py-1 text-muted-foreground">暂无观众发言</p> : null}
            {hostComments.map((item) => (
              <div
                key={item.id}
                data-testid="host-comment-row"
                className="grid grid-cols-[72px_1fr] items-start gap-2 py-1 leading-tight"
              >
                <span className="truncate text-muted-foreground">{commentDisplayName(item)}</span>
                <span className="line-clamp-1">{item.content}</span>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
