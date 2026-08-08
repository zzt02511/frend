/**
 * @vitest-environment jsdom
 */
import { render, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TencentCloudLivePlayer } from "./tencent-cloud-live-player";

describe("TencentCloudLivePlayer", () => {
  afterEach(() => {
    delete (window as typeof window & { TCPlayer?: unknown }).TCPlayer;
    document.head.innerHTML = "";
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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
});
