import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const SEPARATOR = ":";

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH).toString("hex");
  const derived = scryptSync(password, salt, KEY_LENGTH);
  return `${salt}${SEPARATOR}${derived.toString("hex")}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(SEPARATOR);
  if (!salt || !hash) return false;
  const derived = scryptSync(password, salt, KEY_LENGTH);
  return timingSafeEqual(derived, Buffer.from(hash, "hex"));
}
