import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

test("Prisma stores encrypted room passwords with a revocation version", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");

  expect(schema).toContain("accessPasswordCiphertext String?");
  expect(schema).toContain("accessPasswordVersion");
  expect(schema).not.toMatch(/\n\s*accessPassword\s+String\?/);
});

test("Prisma client includes the Alpine Linux engine used by production", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");

  expect(schema).toContain('binaryTargets = ["native", "linux-musl-openssl-3.0.x"]');
});
