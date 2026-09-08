import assert from "node:assert/strict";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const sourceRoot = process.cwd();
const fakeKey = `0x${"dead".repeat(16)}`;

function run(cwd, args) {
  return spawnSync(args[0], args.slice(1), { cwd, encoding: "utf8" });
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "task52-secret-scan-"));
  mkdirSync(join(root, "tools"));
  mkdirSync(join(root, "config"));
  mkdirSync(join(root, "scripts"));
  cpSync(join(sourceRoot, "tools", "secret-scan.mjs"), join(root, "tools", "secret-scan.mjs"));
  cpSync(join(sourceRoot, "config", "secrets-scan.json"), join(root, "config", "secrets-scan.json"));
  cpSync(join(sourceRoot, "config", "bip39-english.txt"), join(root, "config", "bip39-english.txt"));
  cpSync(join(sourceRoot, "scripts", "install-secrets-hook.mjs"), join(root, "scripts", "install-secrets-hook.mjs"));
  assert.equal(run(root, ["git", "init", "-q"]).status, 0);
  assert.equal(run(root, ["git", "config", "user.email", "test@example.invalid"]).status, 0);
  assert.equal(run(root, ["git", "config", "user.name", "Task 52 test"]).status, 0);
  return root;
}

test("hook blocks named private key but never echoes it", () => {
  const root = fixture();
  try {
    assert.equal(run(root, ["node", "scripts/install-secrets-hook.mjs"]).status, 0);
    writeFileSync(join(root, "candidate.env"), `PRIVATE_KEY=${fakeKey}\n`);
    assert.equal(run(root, ["git", "add", "candidate.env"]).status, 0);
    const result = run(root, ["git", "commit", "-m", "red fixture"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /named-64-hex/);
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, new RegExp(fakeKey));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("hook allows a public pool id and rejects complete 12 and 24 word phrases", () => {
  const root = fixture();
  try {
    assert.equal(run(root, ["node", "scripts/install-secrets-hook.mjs"]).status, 0);
    writeFileSync(join(root, "pool.js"), `const poolId = "0x${"11".repeat(32)}";\nconst txHash = "0x${"22".repeat(32)}";\nconst publicAddress = "0x${"33".repeat(20)}";\n`);
    assert.equal(run(root, ["git", "add", "pool.js"]).status, 0);
    assert.equal(run(root, ["git", "commit", "-m", "green public id"]).status, 0);
    const phrase12 = Array(11).fill("abandon").concat("about").join(" ");
    const phrase24 = Array(23).fill("abandon").concat("about").join(" ");
    writeFileSync(join(root, "phrase.txt"), `${phrase12}\n${phrase24}\n`);
    assert.equal(run(root, ["git", "add", "phrase.txt"]).status, 0);
    const result = run(root, ["node", "tools/secret-scan.mjs", "--staged"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /bip39-mnemonic/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("scanner blocks bare sensitive names and quoted JSON/YAML keys", () => {
  const root = fixture();
  try {
    const hex = `0x${"dead".repeat(16)}`;
    writeFileSync(join(root, "assignments.txt"), `key = "${hex}"\nsecret: "${hex}"\nprivate = "${hex}"\nseed: "${hex}"\n{"PRIVATE_KEY":"${hex}"}\n"mnemonic": "${hex}"\n`);
    assert.equal(run(root, ["git", "add", "assignments.txt"]).status, 0);
    const result = run(root, ["node", "tools/secret-scan.mjs", "--staged"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /named-64-hex/);
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, new RegExp(hex));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("scanner reads the index, not an unstaged working-tree replacement", () => {
  const root = fixture();
  try {
    writeFileSync(join(root, "index-only.txt"), "ordinary content\n");
    assert.equal(run(root, ["git", "add", "index-only.txt"]).status, 0);
    writeFileSync(join(root, "index-only.txt"), `PRIVATE_KEY=${fakeKey}\n`);
    const result = run(root, ["node", "tools/secret-scan.mjs", "--staged"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /PASS/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("scanner rejects renamed .env and mixed-case secrets paths", () => {
  const root = fixture();
  try {
    writeFileSync(join(root, "plain.txt"), "ordinary content\n");
    assert.equal(run(root, ["git", "add", "plain.txt"]).status, 0);
    assert.equal(run(root, ["git", "commit", "-m", "fixture base"]).status, 0);
    assert.equal(run(root, ["git", "mv", "plain.txt", ".ENV"]).status, 0);
    let result = run(root, ["node", "tools/secret-scan.mjs", "--staged"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /forbidden-path/);
    assert.equal(run(root, ["git", "reset", "--hard", "HEAD"]).status, 0);
    mkdirSync(join(root, "SeCrEtS"));
    writeFileSync(join(root, "SeCrEtS", "value.txt"), "ordinary content\n");
    assert.equal(run(root, ["git", "add", "SeCrEtS/value.txt"]).status, 0);
    result = run(root, ["node", "tools/secret-scan.mjs", "--staged"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /forbidden-path/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("scanner detects direct key text embedded in a binary blob", () => {
  const root = fixture();
  try {
    writeFileSync(join(root, "fixture.bin"), Buffer.from(`\u0000PRIVATE_KEY=${fakeKey}\u0000`, "utf8"));
    assert.equal(run(root, ["git", "add", "fixture.bin"]).status, 0);
    const result = run(root, ["node", "tools/secret-scan.mjs", "--staged"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /named-64-hex/);
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, new RegExp(fakeKey));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("scanner blocks recognizable API tokens, JWTs, and keyed RPC URLs", () => {
  const root = fixture();
  try {
    const apiToken = `sk_${"a".repeat(24)}`;
    const jwt = [`eyJ${"a".repeat(12)}`, "b".repeat(12), "c".repeat(12)].join(".");
    const rpcKey = "a".repeat(32);
    writeFileSync(join(root, "credentials.txt"), `API_TOKEN=${apiToken}\nJWT=${jwt}\nRPC=https://mainnet.infura.io/v3/${rpcKey}\n`);
    assert.equal(run(root, ["git", "add", "credentials.txt"]).status, 0);
    const result = run(root, ["node", "tools/secret-scan.mjs", "--staged"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /named-api-token/);
    assert.match(result.stderr, /jwt/);
    assert.match(result.stderr, /keyed-rpc-url/);
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, new RegExp(apiToken));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("scanner blocks standard token prefixes and quoted API keys without entropy fallback", () => {
  const root = fixture();
  try {
    const values = [
      `sk-${"a".repeat(24)}`,
      `xoxb-${"a".repeat(24)}`,
      `AKIA${"A".repeat(16)}`,
      `AIza${"a".repeat(24)}`,
      `ya29.${"a".repeat(24)}`,
      `ghp_${"a".repeat(24)}`,
    ];
    for (const [index, value] of values.entries()) {
      const file = `token-${index}.json`;
      writeFileSync(join(root, file), `{"API_KEY":"${value}"}\n`);
      assert.equal(run(root, ["git", "add", file]).status, 0);
      const result = run(root, ["node", "tools/secret-scan.mjs", "--staged"]);
      assert.equal(result.status, 1, `prefix ${index} must block`);
      assert.match(result.stderr, /named-api-token/);
      assert.doesNotMatch(`${result.stdout}${result.stderr}`, new RegExp(value));
      assert.equal(run(root, ["git", "rm", "--cached", "--quiet", file]).status, 0);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("primary installer refuses shared hooks and isolates only its worktree after opt-in", () => {
  const root = fixture();
  const linked = `${root}-linked`;
  try {
    assert.equal(run(root, ["git", "add", "tools", "config", "scripts"]).status, 0);
    assert.equal(run(root, ["git", "commit", "-m", "fixture hook base"]).status, 0);
    assert.equal(run(root, ["git", "worktree", "add", "-q", "-b", "linked-hook-fixture", linked]).status, 0);
    let result = run(root, ["node", "scripts/install-secrets-hook.mjs"]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /linked worktrees share hooks/);
    assert.equal(run(root, ["git", "config", "extensions.worktreeConfig", "true"]).status, 0);
    result = run(root, ["node", "scripts/install-secrets-hook.mjs"]);
    assert.equal(result.status, 0);
    const localHookDir = run(root, ["git", "config", "--worktree", "--get", "core.hooksPath"]).stdout.trim();
    assert.ok(localHookDir.endsWith("task52-hooks"));
    writeFileSync(join(root, "candidate.env"), `PRIVATE_KEY=${fakeKey}\n`);
    assert.equal(run(root, ["git", "add", "candidate.env"]).status, 0);
    assert.notEqual(run(root, ["git", "commit", "-m", "primary red fixture"]).status, 0);
    writeFileSync(join(linked, "ordinary.txt"), "ordinary content\n");
    assert.equal(run(linked, ["git", "add", "ordinary.txt"]).status, 0);
    assert.equal(run(linked, ["git", "commit", "-m", "linked green fixture"]).status, 0);
  } finally {
    run(root, ["git", "worktree", "remove", "--force", linked]);
    rmSync(root, { recursive: true, force: true });
  }
});

test("history mode scans deleted blobs and historical forbidden paths", () => {
  const root = fixture();
  try {
    writeFileSync(join(root, "history.txt"), `PRIVATE_KEY=${fakeKey}\n`);
    assert.equal(run(root, ["git", "add", "history.txt"]).status, 0);
    assert.equal(run(root, ["git", "commit", "-m", "secret fixture"]).status, 0);
    assert.equal(run(root, ["git", "rm", "history.txt"]).status, 0);
    assert.equal(run(root, ["git", "commit", "-m", "delete fixture"]).status, 0);
    writeFileSync(join(root, "plain.txt"), "ordinary content\n");
    assert.equal(run(root, ["git", "add", "plain.txt"]).status, 0);
    assert.equal(run(root, ["git", "commit", "-m", "path fixture"]).status, 0);
    assert.equal(run(root, ["git", "mv", "plain.txt", ".env"]).status, 0);
    assert.equal(run(root, ["git", "commit", "-m", "rename fixture"]).status, 0);
    const result = run(root, ["node", "tools/secret-scan.mjs", "--history"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /named-64-hex/);
    assert.match(result.stderr, /forbidden-path/);
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, new RegExp(fakeKey));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
