import { describe, expect, it } from "vitest";
import { decryptRoomPassword, encryptRoomPassword } from "./room-password";

const key = Buffer.alloc(32, 7).toString("base64");

describe("room password encryption", () => {
  it("round-trips without storing the plaintext", () => {
    const encrypted = encryptRoomPassword("sale-2026", key);

    expect(encrypted).toMatch(/^v1\./);
    expect(encrypted).not.toContain("sale-2026");
    expect(decryptRoomPassword(encrypted, key)).toBe("sale-2026");
  });

  it("uses a new random IV for every encryption", () => {
    expect(encryptRoomPassword("same", key)).not.toBe(encryptRoomPassword("same", key));
  });

  it("rejects an invalid key", () => {
    expect(() => encryptRoomPassword("secret", "short")).toThrow("ROOM_PASSWORD_KEY_INVALID");
  });

  it("rejects tampered ciphertext", () => {
    const encrypted = encryptRoomPassword("secret", key);
    const parts = encrypted.split(".");
    parts[3] = `${parts[3].slice(0, -2)}aa`;

    expect(() => decryptRoomPassword(parts.join("."), key)).toThrow("ROOM_PASSWORD_DECRYPT_FAILED");
  });
});
