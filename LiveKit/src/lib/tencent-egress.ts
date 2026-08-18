import { createHash } from "node:crypto";
import {
  AudioCodec,
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  EncodingOptions,
  StreamOutput,
  StreamProtocol,
  VideoCodec,
} from "livekit-server-sdk";
import type { LiveSession } from "./domain";

function getEgressClient() {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) throw new Error("LIVEKIT_EGRESS_CREDENTIALS_REQUIRED");
  return new EgressClient(process.env.LIVEKIT_EGRESS_URL || "http://livekit:7880", apiKey, apiSecret);
}

export function buildTencentRtmpPushUrl(live: LiveSession, now = new Date()) {
  const pushKey = process.env.TENCENT_RTMP_PUSH_KEY?.trim();
  if (!pushKey) throw new Error("TENCENT_RTMP_PUSH_KEY_REQUIRED");

  const domain = process.env.TENCENT_RTMP_PUSH_DOMAIN?.trim() || "push.fuguilong.cn";
  const appName = process.env.TENCENT_RTMP_APP_NAME?.trim() || "live";
  const streamName = live.tencentStreamName?.trim() || live.id;
  const ttlSeconds = Number.parseInt(process.env.TENCENT_RTMP_URL_TTL_SECONDS || "43200", 10);
  if (!/^[A-Za-z0-9.-]+$/.test(domain) || !/^[A-Za-z0-9_-]+$/.test(appName)) {
    throw new Error("TENCENT_RTMP_CONFIG_INVALID");
  }
  if (!/^[A-Za-z0-9_-]+$/.test(streamName)) throw new Error("TENCENT_STREAM_NAME_INVALID");
  if (!Number.isFinite(ttlSeconds) || ttlSeconds < 300 || ttlSeconds > 604800) {
    throw new Error("TENCENT_RTMP_TTL_INVALID");
  }

  const txTime = Math.floor(now.getTime() / 1000 + ttlSeconds).toString(16).toUpperCase();
  const txSecret = createHash("md5").update(`${pushKey}${streamName}${txTime}`).digest("hex");
  return `rtmp://${domain}/${appName}/${streamName}?txSecret=${txSecret}&txTime=${txTime}`;
}

export function buildTencentEgressEncodingOptions() {
  return new EncodingOptions({
    width: 1280,
    height: 720,
    depth: 24,
    framerate: 30,
    audioCodec: AudioCodec.OPUS,
    audioBitrate: 128,
    audioFrequency: 44100,
    videoCodec: VideoCodec.H264_MAIN,
    videoBitrate: 3000,
    keyFrameInterval: 2,
  });
}

export async function startTencentHostEgress(live: LiveSession) {
  const client = getEgressClient();
  const active = await client.listEgress({ roomName: live.roomName, active: true });
  if (active.length > 0) return active[0];

  const output = new StreamOutput({
    protocol: StreamProtocol.RTMP,
    urls: [buildTencentRtmpPushUrl(live)],
  });
  const file = live.enableRecord
    ? new EncodedFileOutput({
        filepath: `/output/${live.id}.mp4`,
        fileType: EncodedFileType.MP4,
      })
    : undefined;
  const encodingOptions = buildTencentEgressEncodingOptions();
  return client.startParticipantEgress(
    live.roomName,
    `${live.roomName}-${live.hostUserId}`,
    { stream: output, file },
    { encodingOptions },
  );
}

export async function stopTencentHostEgress(live: LiveSession) {
  const client = getEgressClient();
  const active = await client.listEgress({ roomName: live.roomName, active: true });
  await Promise.all(active.map((item) => client.stopEgress(item.egressId)));
}
