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
    writeFileSync(join(root, "pool.js"), `const poolId = "0x${"11".repeat(32)}";\n`);
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
