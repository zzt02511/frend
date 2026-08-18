"use client";

import { useEffect, useId, useRef, useState } from "react";

const DEFAULT_TENCENT_PLAYER_SDK_URL =
  "https://tcsdk.com/player/tcplayer/release/v5.3.4/tcplayer.v5.3.4.min.js";
const DEFAULT_TENCENT_PLAYER_CSS_URL = "https://tcsdk.com/player/tcplayer/release/v5.3.4/tcplayer.min.css";

type TencentPlayerInstance = {
  dispose?: () => void;
  off?: (eventName: string, handler: () => void) => void;
  on?: (eventName: string, handler: () => void) => void;
  play?: () => Promise<void> | void;
  src?: (source: string) => void;
};

type TencentPlayerConstructor = new (
  elementId: string,
  options: {
    sources: { src: string }[];
    live: boolean;
    autoplay: boolean;
    controls: boolean;
    muted: boolean;
    playsinline: boolean;
    width: string;
    height: string;
  },
) => TencentPlayerInstance;

declare global {
  interface Window {
    TCPlayer?: TencentPlayerConstructor;
  }
}

type Props = {
  playUrl: string;
  forceWebRtc?: boolean;
};

function isAppleMobile(userAgent: string) {
  return /iPhone|iPad|iPod/i.test(userAgent);
}

export function deriveTencentHlsUrl(playUrl: string) {
  const match = playUrl.match(/^webrtc:\/\/([^/]+)\/(.+)$/i);
  if (!match) return "";
  const [, host, path] = match;
  return `https://${host}/${path}.m3u8`;
}

function selectPlaybackUrl(playUrl: string, userAgent: string) {
  const hlsUrl = deriveTencentHlsUrl(playUrl);
  if (hlsUrl && isAppleMobile(userAgent)) return hlsUrl;
  return playUrl;
}

function loadScript(src: string) {
  const existing = document.querySelector<HTMLScriptElement>(`script[data-tencent-player-sdk="${src}"]`);
  if (existing) {
    if (existing.dataset.loaded === "true") return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("TENCENT_PLAYER_SDK_LOAD_FAILED")), { once: true });
    });
  }

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.tencentPlayerSdk = src;
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true },
    );
    script.addEventListener("error", () => reject(new Error("TENCENT_PLAYER_SDK_LOAD_FAILED")), { once: true });
    document.head.appendChild(script);
  });
}

function loadStylesheet(src: string) {
  const existing = document.querySelector<HTMLLinkElement>(`link[data-tencent-player-css="${src}"]`);
  if (existing) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = src;
  link.dataset.tencentPlayerCss = src;
  document.head.appendChild(link);
}

export function TencentCloudLivePlayer({ playUrl, forceWebRtc = false }: Props) {
  const generatedId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const elementId = `tencent-live-player-${generatedId}`;
  const playerRef = useRef<TencentPlayerInstance | undefined>(undefined);
  const [playerState, setPlayerState] = useState("正在连接腾讯云直播…");
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    let disposed = false;
    let player: TencentPlayerInstance | undefined;
    let retryTimer: number | undefined;
    let hasStartedPlaying = false;
    const sdkUrl = process.env.NEXT_PUBLIC_TENCENT_PLAYER_SDK_URL || DEFAULT_TENCENT_PLAYER_SDK_URL;
    const cssUrl = process.env.NEXT_PUBLIC_TENCENT_PLAYER_CSS_URL || DEFAULT_TENCENT_PLAYER_CSS_URL;
    const selectedPlayUrl = forceWebRtc ? playUrl : selectPlaybackUrl(playUrl, window.navigator.userAgent);

    const clearRetryTimer = () => {
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      retryTimer = undefined;
    };

    const requestPlayback = () => {
      if (disposed || !player) return;
      try {
        player.src?.(selectedPlayUrl);
        const playResult = player.play?.();
        if (playResult instanceof Promise) void playResult.catch(() => undefined);
      } catch {
        setRetryNonce((value) => value + 1);
      }
    };

    const scheduleReconnect = (delay = 4_000) => {
      if (disposed) return;
      clearRetryTimer();
      setPlayerState("直播画面连接中，正在自动重试…");
      retryTimer = window.setTimeout(requestPlayback, delay);
    };

    const handlePlaying = () => {
      hasStartedPlaying = true;
      clearRetryTimer();
      setPlayerState("");
    };

    const handleError = () => {
      scheduleReconnect();
    };

    async function startPlayer() {
      try {
        loadStylesheet(cssUrl);
        if (!window.TCPlayer) await loadScript(sdkUrl);
        if (disposed || !window.TCPlayer) return;

        player = new window.TCPlayer(elementId, {
          sources: [{ src: selectedPlayUrl }],
          live: true,
          autoplay: true,
          controls: false,
          muted: true,
          playsinline: true,
          width: "100%",
          height: "100%",
        });
        playerRef.current = player;
        player.on?.("playing", handlePlaying);
        player.on?.("error", handleError);
        setPlayerState("正在连接腾讯云直播…");
        retryTimer = window.setTimeout(() => {
          if (!hasStartedPlaying) scheduleReconnect(0);
        }, 5_000);
      } catch {
        if (!disposed) {
          setPlayerState("直播画面连接中，正在自动重试…");
          retryTimer = window.setTimeout(() => setRetryNonce((value) => value + 1), 4_000);
        }
      }
    }

    void startPlayer();

    return () => {
      disposed = true;
      clearRetryTimer();
      player?.off?.("playing", handlePlaying);
      player?.off?.("error", handleError);
      player?.dispose?.();
      if (playerRef.current === player) playerRef.current = undefined;
    };
  }, [elementId, forceWebRtc, playUrl, retryNonce]);

  const recoverPlayback = () => {
    setPlayerState("正在重新连接腾讯云直播…");
    const playResult = playerRef.current?.play?.();
    if (playResult instanceof Promise) {
      void playResult.catch(() => setRetryNonce((value) => value + 1));
      return;
    }
    setRetryNonce((value) => value + 1);
  };

  return (
    <div
      className="relative h-full w-full bg-black [&_.tcp-controls]:hidden [&_.tcp-logo]:hidden [&_.tcp-loading]:hidden [&_.vjs-big-play-button]:hidden [&_.vjs-control-bar]:hidden [&_.vjs-error-display]:hidden [&_.vjs-modal-dialog]:hidden"
      data-testid="tencent-cloud-live-player"
    >
      <video
        id={elementId}
        className="h-full w-full object-cover"
        data-testid="tencent-cloud-live-player-container"
        preload="auto"
        playsInline
        webkit-playsinline="true"
        x5-playsinline="true"
      />
      {playerState ? (
        <div className="absolute inset-x-5 top-16 flex items-center justify-between gap-3 rounded-md bg-black/55 p-3 text-sm text-white backdrop-blur">
          <span>{playerState}</span>
          <button
            type="button"
            className="shrink-0 rounded-md border border-white/50 px-3 py-1.5 text-white"
            onClick={recoverPlayback}
          >
            点击恢复
          </button>
        </div>
      ) : null}
    </div>
  );
}
