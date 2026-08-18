import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export function ensurePrismaAliases({
  nftPath = ".next/server/instrumentation.js.nft.json",
  standaloneNodeModules = ".next/standalone/node_modules",
} = {}) {
  const manifest = JSON.parse(readFileSync(nftPath, "utf8"));
  const aliases = [...new Set(
    manifest.files
      .map((file) => file.match(/node_modules[\\/](@prisma[\\/]client-[0-9a-f]+)$/)?.[1])
      .filter(Boolean)
      .map((name) => name.replaceAll("\\", "/")),
  )];

  for (const alias of aliases) {
    const aliasDirectory = join(standaloneNodeModules, ...alias.split("/"));
    mkdirSync(aliasDirectory, { recursive: true });
    writeFileSync(
      join(aliasDirectory, "package.json"),
      `${JSON.stringify({ name: alias, private: true, main: "index.js" }, null, 2)}\n`,
    );
    writeFileSync(join(aliasDirectory, "index.js"), "module.exports = require('@prisma/client');\n");
  }

  return aliases;
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  const aliases = ensurePrismaAliases();
  if (aliases.length === 0) throw new Error("PRISMA_TURBOPACK_ALIAS_NOT_FOUND");
  console.log(`Created Prisma standalone aliases: ${aliases.join(", ")}`);
}
