#!/usr/bin/env node
/** Install the task-52 hook for this clone without exposing matched content. */
import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";

function git(args) {
  const result = spawnSync("git", args, { cwd: process.cwd(), encoding: "utf8" });
  if (result.status !== 0) throw new Error("Git command failed");
  return result.stdout.trim();
}

try {
  const hookPath = git(["rev-parse", "--git-path", "hooks/pre-commit"]);
  const marker = "# task52-secret-scan-hook";
  const hook = `#!/bin/sh\n${marker}\nset -eu\nroot="$(git rev-parse --show-toplevel)"\nexec node "$root/tools/secret-scan.mjs" --staged\n`;
  if (existsSync(hookPath) && !readFileSync(hookPath, "utf8").includes(marker)) {
    process.stderr.write("secret hook: ERROR existing pre-commit hook is not task52-managed; refusing to overwrite\n");
    process.exit(2);
  }
  writeFileSync(hookPath, hook, { mode: 0o700 });
  chmodSync(hookPath, 0o700);
  process.stdout.write(`secret hook: PASS installed at ${dirname(hookPath)}\n`);
} catch (_) {
  process.stderr.write("secret hook: ERROR installation failed\n");
  process.exit(2);
}
