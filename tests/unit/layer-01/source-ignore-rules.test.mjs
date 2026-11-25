import { spawnSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";

const root = process.cwd();

function isIgnored(path) {
  const result = spawnSync("git", ["check-ignore", "--no-index", "-q", path], {
    cwd: root,
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.ok(result.status === 0 || result.status === 1, result.stderr?.toString());
  return result.status === 0;
}

test("secret-management implementation remains visible while runtime secret data stays ignored", () => {
  const sourceFiles = [
    "apps/api/src/modules/secrets/encryption.ts",
    "apps/api/src/modules/secrets/secret-vault.service.ts",
    "packages/contracts/src/secrets/index.ts",
  ];

  for (const path of sourceFiles) {
    assert.equal(isIgnored(path), false, `${path} must not be hidden by Git ignore rules`);
  }
  assert.equal(isIgnored("secrets/test-credential.txt"), true);
});
