/**
 * @vitest-environment jsdom
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
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
});
