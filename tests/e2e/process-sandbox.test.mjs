import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile, chown } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("bubblewrap process sandbox confines files, network, runtime, and output", {
  skip: process.platform !== "linux" || process.getuid?.() !== 0,
  timeout: 30_000,
}, async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), "freeai-sandbox-e2e-"));
  const workspace = path.join(base, "workspace");
  const outside = path.join(base, "outside-secret.txt");
  await import("node:fs/promises").then(({ mkdir }) => mkdir(workspace));
  await writeFile(outside, "host-only-secret", { mode: 0o600 });
  await chown(base, 65534, 65534);
  await chown(workspace, 65534, 65534);
  let hits = 0;
  const server = createServer((_request, response) => { hits++; response.end("host network reached"); });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(base, { recursive: true, force: true });
  });

  async function runScenario(scenario) {
    const child = spawn("/usr/bin/setpriv", [
      "--reuid=65534", "--regid=65534", "--clear-groups", process.execPath,
      path.resolve("tests/e2e/process-sandbox-worker.mjs"), scenario,
    ], {
      env: { PATH: process.env.PATH, HOME: "/tmp", NODE_EXECUTABLE: process.execPath, WORKSPACE_PATH: workspace,
        OUTSIDE_PATH: outside, PROBE_PORT: String(address.port) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    const [code] = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (exitCode, signal) => resolve([exitCode, signal]));
    });
    assert.equal(code, 0, stderr);
    return JSON.parse(stdout);
  }

  const confined = await runScenario("escape");
  assert.equal(confined.code, 0, confined.stderr);
  assert.deepEqual(JSON.parse(confined.stdout), { host: "blocked", etc: "blocked", network: "blocked" });
  assert.equal(await readFile(path.join(workspace, "inside.txt"), "utf8"), "sandbox-write");
  assert.equal(hits, 0);
  assert.equal(await readFile(outside, "utf8"), "host-only-secret");

  const timeout = await runScenario("timeout");
  assert.equal(timeout.timedOut, true);
  assert.notEqual(timeout.code, 0);
  const output = await runScenario("output");
  assert.equal(output.outputLimitExceeded, true);
  assert.notEqual(output.code, 0);
});
