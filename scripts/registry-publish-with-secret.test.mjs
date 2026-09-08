import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { main, publishCommand, registryEnvironment, SUCCESS_MARKER } from "./registry-publish-with-secret.mjs";

test("registry launcher uses canonical token env and rejects inherited endpoint/debug controls", () => {
  const dir = mkdtempSync(join(tmpdir(), "task52-registry-"));
  const file = join(dir, "token");
  try {
    writeFileSync(file, "fixture-registry-token\n", { mode: 0o600 }); chmodSync(file, 0o600);
    const env = registryEnvironment({ SUBSTREAMS_REGISTRY_TOKEN_FILE: file });
    assert.equal(env.SUBSTREAMS_REGISTRY_TOKEN, "fixture-registry-token");
    assert.equal(env.SUBSTREAMS_ENDPOINT, undefined); assert.equal(env.RUST_LOG, undefined);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("registry launcher requires marker and suppresses stderr", () => {
  const dir = mkdtempSync(join(tmpdir(), "task52-registry-")); const file = join(dir, "token");
  try {
    writeFileSync(file, "fixture-registry-token\n", { mode: 0o600 }); chmodSync(file, 0o600);
    const spkg = join(dir, "fixture.spkg"); writeFileSync(spkg, ""); let captured; const ok = (_bin, args, options) => { captured = { args, options }; return { status: 0, stdout: `${SUCCESS_MARKER}\n`, stderr: "fixture-registry-token" }; };
    main([spkg], { PATH: "/usr/bin", HOME: "/tmp", LANG: "C", DEBUG: "1", SUBSTREAMS_ENDPOINT: "bad", SUBSTREAMS_REGISTRY_TOKEN_FILE: file }, ok);
    assert.deepEqual(captured.args, publishCommand(spkg)); assert.equal(captured.options.env.DEBUG, undefined); assert.equal(captured.options.env.SUBSTREAMS_ENDPOINT, undefined);
    assert.throws(() => main([], { SUBSTREAMS_REGISTRY_TOKEN_FILE: file }, ok), /required/); assert.throws(() => main(["https://bad.spkg"], { SUBSTREAMS_REGISTRY_TOKEN_FILE: file }, ok), /required/);
    assert.throws(() => main([spkg], { SUBSTREAMS_REGISTRY_TOKEN_FILE: file }, () => ({ status: 0, stdout: "cancelled\n" })), /failed/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
