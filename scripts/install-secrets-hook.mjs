#!/usr/bin/env node
/** Install a clone- or worktree-local task-52 hook without exposing content. */
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";

function git(args, optional = false) {
  const result = spawnSync("git", args, { cwd: process.cwd(), encoding: "utf8" });
  if (result.status !== 0) {
    if (optional) return null;
    throw new Error("Git command failed");
  }
  return result.stdout.trim();
}

function abort(message) {
  process.stderr.write(`secret hook: ERROR ${message}\n`);
  process.exit(2);
}

try {
  const marker = "# task52-secret-scan-hook";
  const hook = `#!/bin/sh\n${marker}\nset -eu\nroot="$(git rev-parse --show-toplevel)"\nexec node "$root/tools/secret-scan.mjs" --staged\n`;
  const worktreeCount = (git(["worktree", "list", "--porcelain"]).match(/^worktree /gm) || []).length;
  let hookDir;
  if (worktreeCount > 1) {
    if (git(["config", "--bool", "extensions.worktreeConfig"], true) !== "true") {
      abort("linked worktrees share hooks; refusing installation. Enable extensions.worktreeConfig, review existing worktree config, then rerun in the intended worktree.");
    }
    hookDir = git(["rev-parse", "--path-format=absolute", "--git-path", "task52-hooks"]);
    const configured = git(["config", "--worktree", "--get", "core.hooksPath"], true);
    if (configured && configured !== hookDir) abort("this worktree already has a different core.hooksPath; refusing to overwrite it.");
    git(["config", "--worktree", "core.hooksPath", hookDir]);
  } else {
    if (git(["config", "--get", "core.hooksPath"], true)) abort("core.hooksPath is already configured; refusing to bypass or overwrite it.");
    hookDir = dirname(git(["rev-parse", "--path-format=absolute", "--git-path", "hooks/pre-commit"]));
  }
  const hookPath = `${hookDir}/pre-commit`;
  if (existsSync(hookPath) && !readFileSync(hookPath, "utf8").includes(marker)) {
    abort("existing pre-commit hook is not task52-managed; refusing to overwrite it.");
  }
  mkdirSync(hookDir, { recursive: true, mode: 0o700 });
  writeFileSync(hookPath, hook, { mode: 0o700 });
  chmodSync(hookPath, 0o700);
  process.stdout.write(`secret hook: PASS installed at ${hookDir}\n`);
} catch (_) {
  abort("installation failed");
}
