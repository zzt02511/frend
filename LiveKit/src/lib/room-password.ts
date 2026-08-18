import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const VERSION = "v1";

function decodeKey(encodedKey: string) {
  const key = Buffer.from(encodedKey, "base64");
  if (key.length !== 32 || key.toString("base64") !== encodedKey) {
    throw new Error("ROOM_PASSWORD_KEY_INVALID");
  }
  return key;
}

export function encryptRoomPassword(password: string, encodedKey: string) {
  const key = decodeKey(encodedKey);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptRoomPassword(storedValue: string, encodedKey: string) {
  const key = decodeKey(encodedKey);

  try {
    const [version, encodedIv, encodedTag, encodedCiphertext, extra] = storedValue.split(".");
    if (version !== VERSION || !encodedIv || !encodedTag || !encodedCiphertext || extra) {
      throw new Error("INVALID_FORMAT");
    }

    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(encodedIv, "base64url"));
    decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encodedCiphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("ROOM_PASSWORD_DECRYPT_FAILED");
  }
}
