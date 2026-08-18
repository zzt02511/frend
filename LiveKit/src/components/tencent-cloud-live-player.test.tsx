/**
 * @vitest-environment jsdom
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveTencentPlayerAssets, TencentCloudLivePlayer } from "./tencent-cloud-live-player";

describe("TencentCloudLivePlayer", () => {
  afterEach(() => {
    delete (window as typeof window & { TCPlayer?: unknown }).TCPlayer;
    document.head.innerHTML = "";
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("loads TCPlayer CSS before initializing the player so controls are not rendered as raw text", async () => {
    const tcPlayerMock = vi.fn(() => ({ dispose: vi.fn() }));
    (window as typeof window & { TCPlayer?: unknown }).TCPlayer = tcPlayerMock;

    render(<TencentCloudLivePlayer playUrl="webrtc://play.fuguilong.cn/live/IHQDAT" />);

    await waitFor(() => expect(tcPlayerMock).toHaveBeenCalled());

    const cssLink = document.head.querySelector<HTMLLinkElement>("link[data-tencent-player-css]");
    expect(cssLink).toBeInTheDocument();
    expect(cssLink?.rel).toBe("stylesheet");
    expect(cssLink?.href).toContain("tcplayer.min.css");
    expect(tcPlayerMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        controls: false,
        sources: [{ src: "webrtc://play.fuguilong.cn/live/IHQDAT" }],
      }),
    );
  });

  it("marks the player shell so generated TCPlayer layers fill the live viewport", () => {
    const tcPlayerMock = vi.fn(() => ({ dispose: vi.fn() }));
    (window as typeof window & { TCPlayer?: unknown }).TCPlayer = tcPlayerMock;

    render(<TencentCloudLivePlayer playUrl="webrtc://play.fuguilong.cn/live/room-sized" />);

    expect(screen.getByTestId("tencent-cloud-live-player")).toHaveClass("tencent-player-shell", "h-full", "w-full");
  });

  it("keeps WebRTC playback on iPhone when forceWebRtc is enabled", async () => {
    const tcPlayerMock = vi.fn(() => ({ dispose: vi.fn() }));
    (window as typeof window & { TCPlayer?: unknown }).TCPlayer = tcPlayerMock;
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
    });

    render(
      <TencentCloudLivePlayer
        playUrl="webrtc://play.fuguilong.cn/live/IHQDAT"
        forceWebRtc
      />,
    );

    await waitFor(() => expect(tcPlayerMock).toHaveBeenCalled());
    expect(tcPlayerMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        sources: [{ src: "webrtc://play.fuguilong.cn/live/IHQDAT" }],
      }),
    );
  });

  it("automatically reconnects when TCPlayer reports a playback error", async () => {
    vi.useFakeTimers();
    const handlers = new Map<string, () => void>();
    const src = vi.fn();
    const play = vi.fn();
    const tcPlayerMock = vi.fn(function MockTencentPlayer() {
      return {
        dispose: vi.fn(),
        on: vi.fn((eventName: string, handler: () => void) => handlers.set(eventName, handler)),
        off: vi.fn(),
        play,
        src,
      };
    });
    (window as typeof window & { TCPlayer?: unknown }).TCPlayer = tcPlayerMock;

    render(<TencentCloudLivePlayer playUrl="webrtc://play.fuguilong.cn/live/room-1" />);
    await act(async () => undefined);

    act(() => handlers.get("error")?.());
    expect(screen.getByText("直播画面连接中，正在自动重试…")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(4_000));
    expect(src).toHaveBeenCalledWith("webrtc://play.fuguilong.cn/live/room-1");
    expect(play).toHaveBeenCalled();
  });

  it("does not reset the HLS source while iPhone waits for a user playback gesture", async () => {
    vi.useFakeTimers();
    const tcPlayerMock = vi.fn();
    (window as typeof window & { TCPlayer?: unknown }).TCPlayer = tcPlayerMock;
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 MicroMessenger/8.0.60",
    });

    render(<TencentCloudLivePlayer playUrl="https://play.fuguilong.cn/live/room-hls.m3u8" />);
    await act(async () => undefined);

    act(() => screen.getByTestId("tencent-cloud-live-player-container").dispatchEvent(new Event("error")));
    act(() => vi.advanceTimersByTime(20_000));

    expect(screen.getByText("苹果手机请点击恢复播放")).toBeInTheDocument();
    expect(tcPlayerMock).not.toHaveBeenCalled();
  });

  it("plays iPhone HLS natively without loading TCPlayer", async () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 MicroMessenger/8.0.60",
    });
    const videoPlay = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
    const videoLoad = vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
    const tcPlayerMock = vi.fn();
    (window as typeof window & { TCPlayer?: unknown }).TCPlayer = tcPlayerMock;

    render(<TencentCloudLivePlayer playUrl="webrtc://play.fuguilong.cn/live/room-hls-click" />);
    await waitFor(() => expect(videoPlay).toHaveBeenCalled());

    const video = screen.getByTestId("tencent-cloud-live-player-container");
    expect(video).toHaveAttribute("src", "https://play.fuguilong.cn/live/room-hls-click.m3u8");
    expect(video).toHaveAttribute("autoplay");
    expect(video).toHaveProperty("muted", true);
    expect(videoLoad).toHaveBeenCalled();
    expect(tcPlayerMock).not.toHaveBeenCalled();
    expect(screen.getByText("画面加载中…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "点击恢复" })).not.toBeInTheDocument();

    act(() => video.dispatchEvent(new Event("canplay")));
    expect(videoPlay).toHaveBeenCalledTimes(2);

    act(() => video.dispatchEvent(new Event("error")));
    act(() => screen.getByRole("button", { name: "点击恢复" }).click());

    expect(videoPlay).toHaveBeenCalledTimes(3);
  });

  it("uses the license-free Tencent 4.5.1 player when no Web license is configured", () => {
    expect(resolveTencentPlayerAssets()).toEqual({
      sdkUrl: "https://web.sdk.qcloud.com/player/tcplayer/release/v4.5.1/tcplayer.v4.5.1.min.js",
      cssUrl: "https://web.sdk.qcloud.com/player/tcplayer/release/v4.5.1/tcplayer.min.css",
      dependencies: [
        "https://web.sdk.qcloud.com/player/tcplayer/release/v4.5.1/libs/TXLivePlayer-1.2.0.min.js",
        "https://web.sdk.qcloud.com/player/tcplayer/release/v4.5.1/libs/hls.min.0.13.2m.js",
      ],
    });
  });

  it("passes the Web license URL to Tencent Player 5 when configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_TENCENT_PLAYER_LICENSE_URL", "https://license.example.com/web.license");
    const tcPlayerMock = vi.fn(() => ({ dispose: vi.fn() }));
    (window as typeof window & { TCPlayer?: unknown }).TCPlayer = tcPlayerMock;

    render(<TencentCloudLivePlayer playUrl="webrtc://play.fuguilong.cn/live/room-licensed" />);

    await waitFor(() => expect(tcPlayerMock).toHaveBeenCalled());
    expect(tcPlayerMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        licenseUrl: "https://license.example.com/web.license",
        sources: [{ src: "webrtc://play.fuguilong.cn/live/room-licensed" }],
      }),
    );
  });
});
