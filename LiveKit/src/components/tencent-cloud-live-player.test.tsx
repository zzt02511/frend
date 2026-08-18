/**
 * @vitest-environment jsdom
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TencentCloudLivePlayer } from "./tencent-cloud-live-player";

describe("TencentCloudLivePlayer", () => {
  afterEach(() => {
    delete (window as typeof window & { TCPlayer?: unknown }).TCPlayer;
    document.head.innerHTML = "";
    vi.restoreAllMocks();
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
});
