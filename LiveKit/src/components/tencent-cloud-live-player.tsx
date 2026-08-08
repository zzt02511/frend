"use client";

import { useEffect, useId, useState } from "react";

const DEFAULT_TENCENT_PLAYER_SDK_URL =
  "https://tcsdk.com/player/tcplayer/release/v5.3.4/tcplayer.v5.3.4.min.js";
const DEFAULT_TENCENT_PLAYER_CSS_URL = "https://tcsdk.com/player/tcplayer/release/v5.3.4/tcplayer.min.css";

type TencentPlayerInstance = {
  dispose?: () => void;
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
  const [playerState, setPlayerState] = useState("正在连接腾讯云直播...");

  useEffect(() => {
    let disposed = false;
    let player: TencentPlayerInstance | undefined;
    const sdkUrl = process.env.NEXT_PUBLIC_TENCENT_PLAYER_SDK_URL || DEFAULT_TENCENT_PLAYER_SDK_URL;
    const cssUrl = process.env.NEXT_PUBLIC_TENCENT_PLAYER_CSS_URL || DEFAULT_TENCENT_PLAYER_CSS_URL;
    const selectedPlayUrl = forceWebRtc ? playUrl : selectPlaybackUrl(playUrl, window.navigator.userAgent);

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
        setPlayerState("正在播放腾讯云直播画面");
      } catch {
        if (!disposed) setPlayerState("腾讯云直播连接失败，请稍后重试");
      }
    }

    void startPlayer();

    return () => {
      disposed = true;
      player?.dispose?.();
    };
  }, [elementId, forceWebRtc, playUrl]);

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
      <div className="pointer-events-none absolute inset-x-5 top-16 rounded-md bg-black/35 p-3 text-sm text-white backdrop-blur">
        {playerState}
      </div>
    </div>
  );
}
