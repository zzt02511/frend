import type { LiveSession } from "./domain";
import { decryptRoomPassword } from "./room-password";

export function toPublicLiveSession(live: LiveSession) {
  const publicLive = { ...live };
  delete publicLive.accessPassword;
  delete publicLive.accessPasswordCiphertext;
  delete publicLive.accessPasswordVersion;

  return {
    ...publicLive,
    hasAccessPassword: Boolean(live.accessPassword || live.accessPasswordCiphertext),
  };
}

export function toManagementLiveSession(live: LiveSession, encryptionKey: string) {
  return {
    ...toPublicLiveSession(live),
    accessPassword: live.accessPasswordCiphertext
      ? decryptRoomPassword(live.accessPasswordCiphertext, encryptionKey)
      : live.accessPassword,
  };
}
