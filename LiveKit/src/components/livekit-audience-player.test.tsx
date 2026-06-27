/**
 * @vitest-environment jsdom
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { LiveKitAudiencePlayer } from "./livekit-audience-player";

const liveKitHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => void>());

vi.mock("livekit-client", () => {
  class MockRoom {
    remoteParticipants = new Map();
    localParticipant = { publishTrack: vi.fn() };
    on(event: string, handler: (...args: unknown[]) => void) {
      liveKitHandlers.set(event, handler);
      return this;
    }
    off(event: string) {
      liveKitHandlers.delete(event);
      return this;
    }
    connect = vi.fn().mockResolvedValue(undefined);
    disconnect = vi.fn();
  }

  return {
    createLocalTracks: vi.fn(),
    Room: MockRoom,
    RoomEvent: {
      TrackSubscribed: "TrackSubscribed",
      TrackUnsubscribed: "TrackUnsubscribed",
      ParticipantDisconnected: "ParticipantDisconnected",
      Disconnected: "Disconnected",
    },
    Track: { Kind: { Video: "video", Audio: "audio" } },
  };
});

describe("LiveKitAudiencePlayer", () => {
  afterEach(() => {
    liveKitHandlers.clear();
    if (typeof window !== "undefined") delete (window as typeof window & { TCPlayer?: unknown }).TCPlayer;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("marks the host video for inline iPhone playback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          ok: true,
          data: {
            token: "token",
            serverUrl: "wss://live.fuguilong.cn",
            grants: { canPublish: false },
          },
        }),
      }),
    );
    HTMLMediaElement.prototype.play = vi.fn().mockRejectedValue(new Error("gesture required"));

    render(
      <LiveKitAudiencePlayer
        liveId="demo-live"
        liveStatus="live"
        viewerId="viewer-1"
        micApproved={false}
        hostIdentity="private-demo-live-host-1"
      />,
    );

    await waitFor(() => expect(liveKitHandlers.has("TrackSubscribed")).toBe(true));

    const mainVideo = document.querySelector("video");
    expect(mainVideo).toHaveAttribute("playsinline");
    expect(mainVideo).toHaveAttribute("webkit-playsinline", "true");
    expect(mainVideo).toHaveAttribute("preload", "auto");
    expect(mainVideo).toHaveProperty("defaultMuted", true);

    act(() => {
      liveKitHandlers.get("TrackSubscribed")?.(
        {
          kind: "video",
          attach: vi.fn(),
        },
        undefined,
        { identity: "private-demo-live-host-1" },
      );
    });

    expect(await screen.findByText(/点击画面/)).toBeInTheDocument();
  });

  it("renders multiple remote mic guest video tiles", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          ok: true,
          data: {
            token: "token",
            serverUrl: "wss://live.fuguilong.cn",
            grants: { canPublish: false },
          },
        }),
      }),
    );
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);

    render(
      <LiveKitAudiencePlayer
        liveId="demo-live"
        liveStatus="live"
        viewerId="viewer-1"
        micApproved={false}
        hostIdentity="private-demo-live-host-1"
      />,
    );

    await waitFor(() => expect(liveKitHandlers.has("TrackSubscribed")).toBe(true));

    act(() => {
      liveKitHandlers.get("TrackSubscribed")?.(
        { kind: "video", attach: vi.fn() },
        undefined,
        { identity: "private-demo-live-audience-1" },
      );
      liveKitHandlers.get("TrackSubscribed")?.(
        { kind: "video", attach: vi.fn() },
        undefined,
        { identity: "private-demo-live-audience-2" },
      );
    });

    expect(screen.getAllByTestId("audience-mic-tile")).toHaveLength(2);
  });

  it("uses LiveKit host playback by default even when a CDN URL exists", async () => {
    const tcPlayerMock = vi.fn(() => ({ dispose: vi.fn() }));
    (window as typeof window & { TCPlayer?: unknown }).TCPlayer = tcPlayerMock;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          ok: true,
          data: {
            token: "token",
            serverUrl: "wss://live.fuguilong.cn",
            grants: { canPublish: false },
          },
        }),
      }),
    );

    render(
      <LiveKitAudiencePlayer
        liveId="demo-live"
        liveStatus="live"
        viewerId="viewer-1"
        micApproved={false}
        hostIdentity="private-demo-live-host-1"
        cdnPlayUrl="webrtc://play.fuguilong.cn/live/IHQDAT"
      />,
    );

    await waitFor(() => expect(liveKitHandlers.has("TrackSubscribed")).toBe(true));
    expect(tcPlayerMock).not.toHaveBeenCalled();

    const attach = vi.fn();
    act(() => {
      liveKitHandlers.get("TrackSubscribed")?.(
        {
          kind: "video",
          attach,
        },
        undefined,
        { identity: "private-demo-live-host-1" },
      );
    });

    expect(attach).toHaveBeenCalledWith(expect.any(HTMLVideoElement));
  });

  it("uses Tencent Cloud playback when the audience CDN flag is enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUDIENCE_CDN_ENABLED", "true");
    const tcPlayerMock = vi.fn(() => ({ dispose: vi.fn() }));
    (window as typeof window & { TCPlayer?: unknown }).TCPlayer = tcPlayerMock;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          ok: true,
          data: {
            token: "token",
            serverUrl: "wss://live.fuguilong.cn",
            grants: { canPublish: false },
          },
        }),
      }),
    );

    render(
      <LiveKitAudiencePlayer
        liveId="demo-live"
        liveStatus="live"
        viewerId="viewer-1"
        micApproved={false}
        hostIdentity="private-demo-live-host-1"
        cdnPlayUrl="webrtc://play.fuguilong.cn/live/IHQDAT"
      />,
    );

    await waitFor(() => expect(tcPlayerMock).toHaveBeenCalled());
    expect(tcPlayerMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        live: true,
        autoplay: true,
        sources: [{ src: "webrtc://play.fuguilong.cn/live/IHQDAT" }],
      }),
    );

    const attach = vi.fn();
    act(() => {
      liveKitHandlers.get("TrackSubscribed")?.(
        {
          kind: "video",
          attach,
        },
        undefined,
        { identity: "private-demo-live-host-1" },
      );
    });

    expect(attach).not.toHaveBeenCalled();
  });

  it("uses LiveKit host playback for iPhone WeChat when CDN playback is unreliable", async () => {
    const tcPlayerMock = vi.fn(() => ({ dispose: vi.fn() }));
    (window as typeof window & { TCPlayer?: unknown }).TCPlayer = tcPlayerMock;
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 15_8 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 MicroMessenger/8.0.48",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          ok: true,
          data: {
            token: "token",
            serverUrl: "wss://live.fuguilong.cn",
            grants: { canPublish: false },
          },
        }),
      }),
    );

    render(
      <LiveKitAudiencePlayer
        liveId="demo-live"
        liveStatus="live"
        viewerId="viewer-iphone"
        micApproved={false}
        hostIdentity="private-demo-live-host-1"
        cdnPlayUrl="webrtc://play.fuguilong.cn/live/IHQDAT"
      />,
    );

    await waitFor(() => expect(liveKitHandlers.has("TrackSubscribed")).toBe(true));
    expect(tcPlayerMock).not.toHaveBeenCalled();

    const attach = vi.fn();
    act(() => {
      liveKitHandlers.get("TrackSubscribed")?.(
        {
          kind: "video",
          attach,
        },
        undefined,
        { identity: "private-demo-live-host-1" },
      );
    });

    expect(attach).toHaveBeenCalledWith(expect.any(HTMLVideoElement));
  });

  it("does not read window during the server render path", async () => {
    const originalWindow = globalThis.window;
    try {
      // @ts-expect-error Simulate a server-side render environment for the lazy state initializer.
      delete globalThis.window;

      expect(() =>
        renderToString(
          <LiveKitAudiencePlayer
            liveId="demo-live"
            liveStatus="live"
            viewerId="viewer-ssr"
            micApproved={false}
            hostIdentity="private-demo-live-host-1"
            cdnPlayUrl="webrtc://play.fuguilong.cn/live/IHQDAT"
          />,
        ),
      ).not.toThrow();
    } finally {
      globalThis.window = originalWindow;
    }
  });
});
