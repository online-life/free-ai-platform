import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync, execFileSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";

test("source release package is reproducible and excludes local secrets and build caches", async () => {
  const root = resolve(".");
  const builder = join(root, "scripts/build-release-package.sh");
  const outputRoot = await mkdtemp(join(tmpdir(), "free-ai-release-package-test-"));
  try {
    const firstDir = join(outputRoot, "first");
    const secondDir = join(outputRoot, "second");
    for (const outputDir of [firstDir, secondDir]) {
      const build = spawnSync(builder, [outputDir], { cwd: root, encoding: "utf8" });
      assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);
    }
    const archiveName = "free-ai-platform-0.1.0.tar.gz";
    const first = await readFile(join(firstDir, archiveName));
    const second = await readFile(join(secondDir, archiveName));
    assert.equal(createHash("sha256").update(first).digest("hex"), createHash("sha256").update(second).digest("hex"));
    const entries = execFileSync("tar", ["-tzf", join(firstDir, archiveName)], { encoding: "utf8" }).split("\n");
    assert.ok(entries.includes("scripts/install-local.sh"));
    assert.ok(entries.includes("pnpm-lock.yaml"));
    assert.ok(entries.includes("apps/api/src/main.ts"));
    assert.ok(!entries.some((entry) => entry.includes("node_modules/") || entry.includes(".env") || entry.endsWith("/dist/")));
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});
