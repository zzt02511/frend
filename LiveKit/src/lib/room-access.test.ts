import { describe, expect, it } from "vitest";
import { issueRoomAccessToken, verifyRoomAccessToken } from "./room-access";

const secret = "test-auth-secret-that-is-long-enough";
const now = 1_800_000_000;

function issue() {
  return issueRoomAccessToken(
    { liveId: "live-1", viewerId: "viewer-1", passwordVersion: 3 },
    { secret, now, ttlSeconds: 600 },
  );
}

describe("room access tokens", () => {
  it("verifies a valid room-scoped token", () => {
    expect(
      verifyRoomAccessToken(issue(), {
        secret,
        now: now + 30,
        liveId: "live-1",
        viewerId: "viewer-1",
        passwordVersion: 3,
      }),
    ).toEqual(expect.objectContaining({ liveId: "live-1", viewerId: "viewer-1", exp: now + 600 }));
  });

  it("rejects an expired token", () => {
    expect(() =>
      verifyRoomAccessToken(issue(), {
        secret,
        now: now + 601,
        liveId: "live-1",
        viewerId: "viewer-1",
        passwordVersion: 3,
      }),
    ).toThrow("ROOM_ACCESS_EXPIRED");
  });

  it.each([
    ["another room", { liveId: "live-2", viewerId: "viewer-1", passwordVersion: 3 }],
    ["another viewer", { liveId: "live-1", viewerId: "viewer-2", passwordVersion: 3 }],
    ["an old password version", { liveId: "live-1", viewerId: "viewer-1", passwordVersion: 4 }],
  ])("rejects a token for %s", (_label, expected) => {
    expect(() => verifyRoomAccessToken(issue(), { secret, now: now + 30, ...expected })).toThrow(
      "ROOM_ACCESS_INVALID",
    );
  });

  it("rejects a tampered token", () => {
    const token = issue();
    const [payload, signature] = token.split(".");
    const tamperedSignature = `${signature[0] === "a" ? "b" : "a"}${signature.slice(1)}`;
    expect(() =>
      verifyRoomAccessToken(`${payload}.${tamperedSignature}`, {
        secret,
        now: now + 30,
        liveId: "live-1",
        viewerId: "viewer-1",
        passwordVersion: 3,
      }),
    ).toThrow("ROOM_ACCESS_INVALID");
  });
});
