import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { createServer as createHttpServer } from "node:http";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const serverScript = fileURLToPath(new URL("../../apps/web/server.mjs", import.meta.url));

async function reservePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("PORT_RESERVATION_FAILED");
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

function start(port, apiBaseUrl = "http://127.0.0.1:3000") {
  const child = spawn(process.execPath, [serverScript], { env: { ...process.env, WEB_PORT: String(port), API_BASE_URL: apiBaseUrl }, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
  child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
  return { child, read: () => ({ stdout, stderr }) };
}

async function waitHealthy(port, child) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && child.exitCode === null) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(300) });
      if (response.ok && (await response.json()).status === "healthy") return;
    } catch { /* wait for bind */ }
    await delay(30);
  }
  throw new Error(`WEB_HEALTH_START_FAILED:${child.exitCode}`);
}

async function stop(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([once(child, "exit"), delay(2000)]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

test("web server serves health and reuses a healthy managed listener", async (t) => {
  const port = await reservePort();
  const first = start(port);
  t.after(() => stop(first.child));
  await waitHealthy(port, first.child);
  const response = await fetch(`http://127.0.0.1:${port}/health`);
  assert.equal(response.headers.get("x-free-ai-platform-server"), "web-preview-v1");

  const second = start(port);
  const [code] = await Promise.race([once(second.child, "exit"), delay(3000).then(() => { throw new Error("DUPLICATE_SERVER_DID_NOT_EXIT"); })]);
  assert.equal(code, 0, second.read().stderr);
  assert.match(second.read().stdout, /already healthy .* reusing it/);
});

test("web server reports an occupied port and leaves its owner running", async (t) => {
  const port = await reservePort();
  const owner = createHttpServer((_request, response) => response.end("unrelated"));
  owner.listen(port, "127.0.0.1");
  await once(owner, "listening");
  t.after(() => new Promise((resolve) => owner.close(() => resolve())));

  const contender = start(port);
  const [code] = await Promise.race([once(contender.child, "exit"), delay(3000).then(() => { throw new Error("PORT_CONFLICT_DID_NOT_EXIT"); })]);
  assert.equal(code, 1);
  assert.match(contender.read().stderr, /already in use by another process/);
  assert.equal(owner.listening, true);
});

test("web server serves runtime API origin config and matching connect-src policy", async (t) => {
  const port = await reservePort();
  const web = start(port, "https://platform-api.example.test");
  t.after(() => stop(web.child));
  await waitHealthy(port, web.child);
  const [config, page] = await Promise.all([
    fetch(`http://127.0.0.1:${port}/config.js`),
    fetch(`http://127.0.0.1:${port}/`),
  ]);
  assert.equal(config.status, 200);
  assert.match(await config.text(), /FREE_AI_API_BASE = "https:\/\/platform-api\.example\.test"/);
  const policy = page.headers.get("content-security-policy");
  assert.ok(policy?.includes("connect-src 'self' https://platform-api.example.test"));
});

import assert from "node:assert/strict";
import test from "node:test";
