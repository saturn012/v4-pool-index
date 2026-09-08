import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { publishCommand, registryEnvironment } from "./registry-publish-with-secret.mjs";

test("registry launcher uses canonical token env and rejects inherited endpoint/debug controls", () => {
  const dir = mkdtempSync(join(tmpdir(), "task52-registry-"));
  const file = join(dir, "token");
  try {
    writeFileSync(file, "fixture-registry-token\n", { mode: 0o600 }); chmodSync(file, 0o600);
    const env = registryEnvironment({ SUBSTREAMS_REGISTRY_TOKEN_FILE: file });
    assert.equal(env.SUBSTREAMS_REGISTRY_TOKEN, "fixture-registry-token");
    assert.equal(env.RUST_LOG, "warn"); assert.deepEqual(publishCommand(), ["registry", "publish"]);
    assert.throws(() => registryEnvironment({ SUBSTREAMS_ENDPOINT: "https://bad", SUBSTREAMS_REGISTRY_TOKEN_FILE: file }), /unsafe/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
