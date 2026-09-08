#!/usr/bin/env node
/**
 * Deterministic, local Git-content scanner used by the task-52 pre-commit hook.
 * It never evaluates repository content and never prints matched values.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ENGINE_VERSION = "1.0.0";
const args = process.argv.slice(2);
const mode = args.includes("--staged") ? "staged" : args.includes("--history") ? "history" : "all";
const reportIndex = args.indexOf("--report");
const reportPath = reportIndex === -1 ? null : args[reportIndex + 1];

if (reportIndex !== -1 && !reportPath) fail("--report requires a path");
if (args.some((arg) => !["--staged", "--history", "--all", "--report", reportPath].includes(arg))) {
  fail("usage: secret-scan.mjs [--staged|--all|--history] [--report PATH]");
}

function git(args, input) {
  const result = spawnSync("git", args, {
    cwd: process.cwd(),
    input,
    encoding: null,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error("Git command failed");
  return result.stdout;
}

function fail(message) {
  process.stderr.write(`secret scan: ERROR ${message}\n`);
  process.exit(2);
}

let root;
let config;
let wordSet;
let configDigest;
try {
  root = git(["rev-parse", "--show-toplevel"]).toString("utf8").trim();
  const configFile = resolve(root, "config/secrets-scan.json");
  config = JSON.parse(readFileSync(configFile, "utf8"));
  const wordlistFile = resolve(root, config.bip39Wordlist);
  const words = readFileSync(wordlistFile, "utf8").trim().split("\n");
  if (words.length !== 2048 || new Set(words).size !== 2048 || words.some((word) => !/^[a-z]+$/.test(word))) {
    throw new Error("invalid BIP-39 wordlist");
  }
  wordSet = new Set(words);
  configDigest = createHash("sha256")
    .update(readFileSync(configFile))
    .update("\0")
    .update(readFileSync(wordlistFile))
    .digest("hex");
} catch (_) {
  fail("scanner configuration is unavailable or invalid");
}

function nulPaths(buffer) {
  return buffer.toString("utf8").split("\0").filter(Boolean);
}

function forbiddenPath(file) {
  const parts = file.split("/");
  return parts.some((part) => part.toLowerCase() === "secrets") ||
    /^\.env(?:\..+)?$/i.test(parts.at(-1) || "");
}

function excludedPath(file) {
  return (config.excludedPaths || []).includes(file);
}

function scanMnemonicLines(text) {
  for (const line of text.split(/\r?\n/)) {
    const words = line.toLowerCase().match(/[a-z]+/g) || [];
    for (const length of [24, 12]) {
      for (let start = 0; start + length <= words.length; start += 1) {
        if (words.slice(start, start + length).every((word) => wordSet.has(word))) return true;
      }
    }
  }
  return false;
}

function scanText(content) {
  // Decode raw bytes without executing them; direct secret text in a binary blob
  // still matches, while archives/encryption/encoded payloads remain limitations.
  const text = content.toString("utf8");
  const rules = new Set();
  const namedHex = /\b[A-Za-z_][A-Za-z0-9_]*(?:key|secret|private|mnemonic|seed|token)[A-Za-z0-9_]*\b\s*(?:=|:)\s*["'`]?\s*(?:0x)?[0-9a-fA-F]{64}\b/i;
  const namedToken = /\b[A-Za-z_][A-Za-z0-9_]*(?:api[_-]?key|token|secret)[A-Za-z0-9_]*\b\s*(?:=|:)\s*["'`]?\s*[A-Za-z0-9_.-]{20,}\b/i;
  const jwt = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/;
  const keyedRpc = /https?:\/\/[^\s"'`]+\.(?:infura\.io|alchemy\.com)\/(?:v[23])\/[A-Za-z0-9_-]{16,}\b/i;
  if (namedHex.test(text)) rules.add("named-64-hex");
  if (namedToken.test(text)) rules.add("named-api-token");
  if (jwt.test(text)) rules.add("jwt");
  if (keyedRpc.test(text)) rules.add("keyed-rpc-url");
  if (scanMnemonicLines(text)) rules.add("bip39-mnemonic");
  return [...rules].sort();
}

function safeFinding(type, path, commit = null) {
  return { type, path, commit };
}

function scanIndexFiles(files, contentFor) {
  const findings = [];
  for (const file of files) {
    if (forbiddenPath(file)) findings.push(safeFinding("forbidden-path", file));
    if (excludedPath(file)) continue;
    for (const type of scanText(contentFor(file))) findings.push(safeFinding(type, file));
  }
  return findings;
}

function stagedFiles() {
  return nulPaths(git(["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"]));
}

function allFiles() {
  return nulPaths(git(["ls-files", "-z"]));
}

function indexContent(file) {
  return git(["show", `:${file}`]);
}

function historyFindings() {
  const refs = git(["for-each-ref", "--format=%(refname):%(objectname)"]).toString("utf8").trim().split("\n").filter(Boolean);
  const commits = git(["rev-list", "--all"]).toString("utf8").trim().split("\n").filter(Boolean);
  const objects = git(["rev-list", "--objects", "--all"]).toString("utf8").split("\n").filter(Boolean);
  const findings = [];
  const seenBlobs = new Set();

  for (const commit of commits) {
    const message = git(["log", "-1", "--format=%B", commit]);
    for (const type of scanText(message)) findings.push(safeFinding(type, "<commit-message>", commit));
  }

  for (const row of objects) {
    const firstSpace = row.indexOf(" ");
    const object = firstSpace === -1 ? row : row.slice(0, firstSpace);
    const file = firstSpace === -1 ? "<unmapped>" : row.slice(firstSpace + 1);
    if (!/^[0-9a-f]{40,64}$/.test(object) || seenBlobs.has(object)) continue;
    if (git(["cat-file", "-t", object]).toString("utf8").trim() !== "blob") continue;
    seenBlobs.add(object);
    if (forbiddenPath(file)) findings.push(safeFinding("forbidden-path", file));
    if (excludedPath(file)) continue;
    const types = scanText(git(["cat-file", "blob", object]));
    if (types.length === 0) continue;
    const commit = git(["log", "--all", "--format=%H", "--find-object", object]).toString("utf8").trim().split("\n").filter(Boolean).at(0) || null;
    for (const type of types) findings.push(safeFinding(type, file, commit));
  }
  return { findings, refs, commits: commits.length, blobs: seenBlobs.size };
}

let findings;
let metadata;
try {
  if (mode === "history") {
    const result = historyFindings();
    findings = result.findings;
    metadata = { refs: result.refs, commits: result.commits, blobs: result.blobs };
  } else {
    const files = mode === "staged" ? stagedFiles() : allFiles();
    findings = scanIndexFiles(files, indexContent);
    metadata = { files: files.length };
  }
} catch (_) {
  fail("Git content could not be scanned");
}

const report = {
  engineVersion: ENGINE_VERSION,
  mode,
  configDigest,
  scannedAt: new Date().toISOString(),
  metadata,
  findings,
};

if (reportPath) {
  const output = isAbsolute(reportPath) ? reportPath : resolve(process.cwd(), reportPath);
  try {
    mkdirSync(dirname(output), { recursive: true, mode: 0o700 });
    writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  } catch (_) {
    fail("sanitized report could not be written");
  }
}

if (findings.length > 0) {
  const rules = [...new Set(findings.map((finding) => finding.type))].join(",");
  process.stderr.write(`secret scan: BLOCKED findings=${findings.length} rules=${rules}\n`);
  process.exit(1);
}
process.stdout.write(`secret scan: PASS mode=${mode} items=${metadata.files ?? metadata.blobs} findings=0\n`);
