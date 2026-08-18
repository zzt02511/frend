import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

test("creates standalone forwarders for Prisma aliases emitted by Turbopack", async () => {
  const scriptPath = join(process.cwd(), "scripts", "fix-standalone-prisma-alias.mjs");
  expect(existsSync(scriptPath)).toBe(true);

  const root = mkdtempSync(join(tmpdir(), "prisma-alias-"));
  tempDirs.push(root);
  const nftPath = join(root, "instrumentation.js.nft.json");
  const nodeModules = join(root, "standalone", "node_modules");
  mkdirSync(nodeModules, { recursive: true });
  writeFileSync(nftPath, JSON.stringify({ files: ["../node_modules/@prisma/client-deadbeef"] }));

  const { ensurePrismaAliases } = await import("../../scripts/fix-standalone-prisma-alias.mjs");
  const aliases = ensurePrismaAliases({ nftPath, standaloneNodeModules: nodeModules });

  expect(aliases).toEqual(["@prisma/client-deadbeef"]);
  expect(readFileSync(join(nodeModules, "@prisma", "client-deadbeef", "index.js"), "utf8"))
    .toContain("require('@prisma/client')");
});
