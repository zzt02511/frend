"use client";

import { useEffect, useRef, useState } from "react";
import {
  createLocalTracks,
  Room,
  RoomEvent,
  Track,
  type LocalTrack,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from "livekit-client";
import type { LiveKitAccessToken } from "@/lib/domain";
import { TencentCloudLivePlayer } from "@/components/tencent-cloud-live-player";

type Props = {
  liveId: string;
  liveStatus: string;
  viewerId: string;
  micApproved: boolean;
  hostIdentity: string;
  cdnPlayUrl?: string;
};

type MicVideoTrack = { identity: string; track: RemoteTrack };

function isAppleMobile(userAgent: string) {
  return /iPhone|iPad|iPod/i.test(userAgent);
}

function isAudienceCdnEnabled() {
  return process.env.NEXT_PUBLIC_AUDIENCE_CDN_ENABLED === "true";
}

function prepareInlineVideo(videoElement: HTMLVideoElement, muted: boolean) {
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

function playMedia(videoElement: HTMLVideoElement, onBlocked?: () => void) {
  const playPromise = videoElement.play();
  if (playPromise?.catch) {
    void playPromise.catch(() => {
      onBlocked?.();
      window.setTimeout(() => {
        const retryPromise = videoElement.play();
        if (retryPromise?.catch) void retryPromise.catch(() => undefined);
      }, 250);
    });
  }
}

function MicVideoTile({ track }: { track: RemoteTrack }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    prepareInlineVideo(videoElement, true);
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
      data-testid="audience-mic-tile"
      autoPlay
      muted
      preload="auto"
      playsInline
      className="h-36 w-24 shrink-0 rounded-lg border border-white/70 bg-black object-cover shadow-2xl"
    />
  );
}

export function LiveKitAudiencePlayer({ liveId, liveStatus, viewerId, micApproved, hostIdentity, cdnPlayUrl }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContainerRef = useRef<HTMLDivElement>(null);
  const lastVideoTrackRef = useRef<RemoteTrack | null>(null);
  const localTracksRef = useRef<LocalTrack[]>([]);
  const localPreviewRef = useRef<HTMLVideoElement>(null);
  const [micVideoTracks, setMicVideoTracks] = useState<MicVideoTrack[]>([]);
  const [showMicPreview, setShowMicPreview] = useState(false);
  const [playbackMode] = useState<"cdn" | "livekit">(() => {
    if (typeof window === "undefined") return "livekit";
    return isAudienceCdnEnabled() && Boolean(cdnPlayUrl?.trim()) && !isAppleMobile(window.navigator.userAgent)
      ? "cdn"
      : "livekit";
  });
  const [playerState, setPlayerState] = useState(
    liveStatus === "live" ? "正在准备进入直播间..." : "主播未开播，稍后刷新即可观看。",
  );
  const useCdnPlayback = playbackMode === "cdn";

  function playHostVideo() {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    prepareInlineVideo(videoElement, true);
    playMedia(videoElement, () => {
      setPlayerState("已收到主播画面，点击画面即可播放");
    });
  }

  useEffect(() => {
    if (videoRef.current) prepareInlineVideo(videoRef.current, true);
    if (localPreviewRef.current) prepareInlineVideo(localPreviewRef.current, true);
  }, []);

  useEffect(() => {
    if (liveStatus !== "live") return;
    if (!viewerId) return;

    let room: Room | null = null;
    let isMounted = true;
    const videoElement = videoRef.current;
    const localPreviewElement = localPreviewRef.current;
    const attachedAudio = new Set<HTMLMediaElement>();

    function isHostParticipant(participant?: RemoteParticipant) {
      return !participant || participant.identity === hostIdentity;
    }

    function attachTrack(
      track: RemoteTrack,
      _publication?: RemoteTrackPublication,
      participant?: RemoteParticipant,
    ) {
      const isHostTrack = isHostParticipant(participant);

      if (track.kind === Track.Kind.Video && isHostTrack && videoElement && !useCdnPlayback) {
        lastVideoTrackRef.current = track;
        prepareInlineVideo(videoElement, true);
        track.attach(videoElement);
        playHostVideo();
        setPlayerState("正在播放主播画面");
        return;
      }

      if (track.kind === Track.Kind.Video && isHostTrack && useCdnPlayback) {
        return;
      }

      if (track.kind === Track.Kind.Video) {
        const identity = participant?.identity ?? track.sid ?? `${track.kind}-remote`;
        setMicVideoTracks((tracks) => {
          const next = tracks.filter((item) => item.identity !== identity);
          return [...next, { identity, track }];
        });
      }

      if (track.kind === Track.Kind.Audio && audioContainerRef.current) {
        const audioElement = track.attach();
        audioElement.autoplay = true;
        attachedAudio.add(audioElement);
        audioContainerRef.current.appendChild(audioElement);
      }
    }

    function detachTrack(
      track: RemoteTrack,
      _publication?: RemoteTrackPublication,
      participant?: RemoteParticipant,
    ) {
      const isHostTrack = isHostParticipant(participant);

      if (track.kind === Track.Kind.Video && isHostTrack) {
        if (videoElement) videoElement.srcObject = null;
        lastVideoTrackRef.current = null;
        if (isMounted && !useCdnPlayback) setPlayerState("主播画面已断开，等待重新推流");
        return;
      }

      if (track.kind === Track.Kind.Video) {
        const identity = participant?.identity ?? track.sid ?? `${track.kind}-remote`;
        setMicVideoTracks((tracks) => tracks.filter((item) => item.identity !== identity));
      }
    }

    function handleParticipantDisconnected(participant: RemoteParticipant) {
      if (participant.identity !== hostIdentity) {
        setMicVideoTracks((tracks) => tracks.filter((item) => item.identity !== participant.identity));
      }
    }

    async function connectAudience() {
      try {
        const response = await fetch(`/api/live-sessions/${liveId}/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: viewerId, role: "audience" }),
        });
        const payload = await response.json();

        if (!payload.ok) {
          throw new Error(payload.error ?? "TOKEN_FAILED");
        }

        const token = payload.data as LiveKitAccessToken;
        room = new Room({ adaptiveStream: true, dynacast: true });
        room.on(RoomEvent.TrackSubscribed, attachTrack);
        room.on(RoomEvent.TrackUnsubscribed, detachTrack);
        room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
        room.on(RoomEvent.Disconnected, () => {
          if (isMounted) setPlayerState("直播连接已断开");
        });

        await room.connect(token.serverUrl, token.token);
        if (isMounted) setPlayerState("已进入直播间，等待主播画面...");

        if (micApproved && token.grants.canPublish) {
          const localTracks = await createLocalTracks({
            audio: true,
            video: { facingMode: "user" },
          });
          localTracksRef.current = localTracks;
          for (const track of localTracks) {
            await room.localParticipant.publishTrack(track);
          }
          const localVideoTrack = localTracks.find((track) => track.kind === Track.Kind.Video);
          if (localVideoTrack && localPreviewElement) {
            prepareInlineVideo(localPreviewElement, true);
            localVideoTrack.attach(localPreviewElement);
            setShowMicPreview(true);
            playMedia(localPreviewElement);
          }
        }

        room.remoteParticipants.forEach((participant) => {
          participant.trackPublications.forEach((publication) => {
            if (publication.track) attachTrack(publication.track, publication, participant);
          });
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "直播连接失败";
        if (isMounted) setPlayerState(`直播连接失败：${message}`);
      }
    }

    void connectAudience();

    return () => {
      isMounted = false;
      room?.off(RoomEvent.TrackSubscribed, attachTrack);
      room?.off(RoomEvent.TrackUnsubscribed, detachTrack);
      room?.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      room?.disconnect();
      attachedAudio.forEach((element) => element.remove());
      localTracksRef.current.forEach((track) => {
        track.detach();
        track.stop();
      });
      localTracksRef.current = [];
      if (videoElement) videoElement.srcObject = null;
      if (localPreviewElement) localPreviewElement.srcObject = null;
      lastVideoTrackRef.current = null;
      setShowMicPreview(false);
      setMicVideoTracks([]);
    };
  }, [liveId, liveStatus, viewerId, micApproved, hostIdentity, useCdnPlayback, playbackMode]);

  return (
    <>
      {useCdnPlayback && cdnPlayUrl ? (
        <TencentCloudLivePlayer playUrl={cdnPlayUrl} />
      ) : (
        <video
          ref={videoRef}
          autoPlay
          muted
          preload="auto"
          playsInline
          onClick={() => {
            if (lastVideoTrackRef.current && videoRef.current) {
              lastVideoTrackRef.current.attach(videoRef.current);
            }
            playHostVideo();
          }}
          className="h-full w-full object-cover"
        />
      )}
      <div className="absolute bottom-5 right-5 z-20 flex max-w-[76%] gap-2 overflow-x-auto">
        {micVideoTracks.map((item) => (
          <MicVideoTile key={item.identity} track={item.track} />
        ))}
      </div>
      <video
        ref={localPreviewRef}
        autoPlay
        muted
        preload="auto"
        playsInline
        className={`absolute bottom-5 right-5 z-30 h-36 w-24 rounded-lg border border-primary bg-black object-cover shadow-2xl ${
          showMicPreview && micVideoTracks.length === 0 ? "block" : "hidden"
        }`}
      />
      <div ref={audioContainerRef} className="hidden" />
      {!useCdnPlayback ? (
        <div className="absolute inset-x-5 top-16 rounded-md bg-black/45 p-3 text-sm text-white backdrop-blur">
          {playerState}
        </div>
      ) : null}
    </>
  );
}
