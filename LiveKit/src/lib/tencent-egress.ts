import {
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  EncodingOptionsPreset,
  StreamOutput,
  StreamProtocol,
} from "livekit-server-sdk";
import type { LiveSession } from "./domain";

function getEgressClient() {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) throw new Error("LIVEKIT_EGRESS_CREDENTIALS_REQUIRED");
  return new EgressClient(process.env.LIVEKIT_EGRESS_URL || "http://livekit:7880", apiKey, apiSecret);
}

function getTencentRtmpPushUrl() {
  const url = process.env.TENCENT_RTMP_PUSH_URL?.trim();
  if (!url) throw new Error("TENCENT_RTMP_PUSH_URL_REQUIRED");
  if (!url.startsWith("rtmp://")) throw new Error("TENCENT_RTMP_PUSH_URL_INVALID");
  return url;
}

export async function startTencentHostEgress(live: LiveSession) {
  const client = getEgressClient();
  const active = await client.listEgress({ roomName: live.roomName, active: true });
  if (active.length > 0) return active[0];

  const output = new StreamOutput({
    protocol: StreamProtocol.RTMP,
    urls: [getTencentRtmpPushUrl()],
  });
  const file = live.enableRecord
    ? new EncodedFileOutput({
        filepath: `/output/${live.id}.mp4`,
        fileType: EncodedFileType.MP4,
      })
    : undefined;
  return client.startParticipantEgress(
    live.roomName,
    `${live.roomName}-${live.hostUserId}`,
    { stream: output, file },
    { encodingOptions: EncodingOptionsPreset.H264_720P_30 },
  );
}

export async function stopTencentHostEgress(live: LiveSession) {
  const client = getEgressClient();
  const active = await client.listEgress({ roomName: live.roomName, active: true });
  await Promise.all(active.map((item) => client.stopEgress(item.egressId)));
}
