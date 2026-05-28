#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const hooksDir = "scripts/git-hooks";
const hooksDirAbs = resolve(repoRoot, hooksDir);

function log(msg) {
  process.stdout.write(`[install-git-hooks] ${msg}\n`);
}

if (process.env.CI || process.env.SKIP_GIT_HOOKS === "1") {
  log("Skipping (CI or SKIP_GIT_HOOKS=1).");
  process.exit(0);
}

if (!existsSync(resolve(repoRoot, ".git"))) {
  log("No .git directory found; nothing to do (likely a tarball install).");
  process.exit(0);
}

if (!existsSync(hooksDirAbs)) {
  log(`Hooks directory ${hooksDir} not found; skipping.`);
  process.exit(0);
}

try {
  const current = execFileSync("git", ["config", "--local", "--get", "core.hooksPath"], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "ignore"],
  })
    .toString()
    .trim();
  if (current === hooksDir) {
    log(`core.hooksPath already set to ${hooksDir}.`);
    process.exit(0);
  }
  if (current && current.length > 0) {
    log(`core.hooksPath is set to "${current}" (custom). Leaving it as-is.`);
    log(`To enable the size guard hook, run: git config core.hooksPath ${hooksDir}`);
    log(`Or set FORCE_GIT_HOOKS=1 and re-run "npm install" to override.`);
    if (process.env.FORCE_GIT_HOOKS !== "1") {
      process.exit(0);
    }
  }
} catch {
  // Not set yet — fall through and set it.
}

try {
  execFileSync("git", ["config", "--local", "core.hooksPath", hooksDir], {
    cwd: repoRoot,
    stdio: "inherit",
  });
  log(`Configured core.hooksPath -> ${hooksDir}.`);
} catch (err) {
  log(`Could not configure git hooks automatically: ${err.message}`);
  log("Run manually: git config core.hooksPath scripts/git-hooks");
  process.exit(0);
}
