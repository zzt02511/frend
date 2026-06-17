import { AccessToken } from "livekit-server-sdk";
import type { LiveKitAccessToken, LiveKitGrants, UserRole } from "./domain";

const DEFAULT_LIVEKIT_API_KEY = "devkey";
const DEFAULT_LIVEKIT_API_SECRET = "secret";
const DEFAULT_LIVEKIT_URL = "wss://fuguilong.cn";

export function grantsForRole(role: UserRole): LiveKitGrants {
  switch (role) {
    case "audience":
      return {
        roomJoin: true,
        canSubscribe: true,
        canPublish: false,
        canPublishData: true,
        roomAdmin: false,
      };
    case "moderator":
      return {
        roomJoin: true,
        canSubscribe: true,
        canPublish: false,
        canPublishData: true,
        roomAdmin: true,
      };
    case "host":
    case "director":
    case "super_admin":
      return {
        roomJoin: true,
        canSubscribe: true,
        canPublish: true,
        canPublishData: true,
        roomAdmin: role !== "host",
      };
  }
}

export function getLiveKitServerUrl() {
  return process.env.LIVEKIT_URL || DEFAULT_LIVEKIT_URL;
}

function getLiveKitCredentials() {
  const apiKey = process.env.LIVEKIT_API_KEY || DEFAULT_LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET || DEFAULT_LIVEKIT_API_SECRET;

  if (
    process.env.NODE_ENV === "production" &&
    (apiKey === DEFAULT_LIVEKIT_API_KEY ||
      apiSecret === DEFAULT_LIVEKIT_API_SECRET ||
      apiSecret.length < 32)
  ) {
    throw new Error("LIVEKIT_PRODUCTION_SECRET_REQUIRED");
  }

  return { apiKey, apiSecret };
}

export async function createLiveKitToken(input: {
  identity: string;
  roomName: string;
  role: UserRole;
  canPublishOverride?: boolean;
}): Promise<LiveKitAccessToken> {
  const grants = {
    ...grantsForRole(input.role),
    ...(input.canPublishOverride === undefined ? {} : { canPublish: input.canPublishOverride }),
  };
  const { apiKey, apiSecret } = getLiveKitCredentials();
  const accessToken = new AccessToken(apiKey, apiSecret, {
    identity: input.identity,
    name: input.identity,
    ttl: "6h",
  });

  accessToken.addGrant({
    room: input.roomName,
    roomJoin: grants.roomJoin,
    canSubscribe: grants.canSubscribe,
    canPublish: grants.canPublish,
    canPublishData: grants.canPublishData,
    roomAdmin: grants.roomAdmin,
  });

  return {
    token: await accessToken.toJwt(),
    identity: input.identity,
    roomName: input.roomName,
    serverUrl: getLiveKitServerUrl(),
    grants,
  };
}
