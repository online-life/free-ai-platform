const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const { mkdtemp, mkdir, readFile, rm, symlink, writeFile, chown, chmod } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createApiServer } = require("../../apps/api/dist/apps/api/src/main.js");
const { disconnectDatabase } = require("../../apps/api/dist/apps/api/src/infrastructure/database/prisma.js");
const { withTenantTransaction } = require("../../apps/api/dist/apps/api/src/infrastructure/database/transaction.js");
const { createTestTenant } = require("./helpers/identity-fixture.cjs");

const runtimeEntry = path.resolve("services/ai-runtime/dist/runtime-entry.js");
const runtimeUid = 65534;
const runtimeGid = 65534;

test("unprivileged local runtime pairs, executes scoped workspace jobs, cancels, and stops after revocation", {
  skip: !process.env.DATABASE_URL || process.platform !== "linux" || typeof process.getuid !== "function" || process.getuid() !== 0,
  timeout: 90_000,
}, async (t) => {
  process.env.NODE_ENV = "test";
  process.env.SECRETS_MASTER_KEY = randomBytes(32).toString("base64");
  const server = createApiServer();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const suffix = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const baseDir = await mkdtemp(path.join(os.tmpdir(), "freeai-runtime-e2e-"));
  const workspacePath = path.join(baseDir, "workspace");
  const runtimeHome = path.join(baseDir, "runtime-home");
  const configPath = path.join(runtimeHome, "workspace-bindings.json");
  const identityPath = path.join(runtimeHome, "device.json");
  let worker;
  let workerOutput = "";
  let workerError = "";
  let expectedSecret = "";
  t.after(async () => {
    if (worker && worker.exitCode === null) {
      worker.kill("SIGTERM");
      await Promise.race([new Promise((resolve) => worker.once("exit", resolve)), delay(5000)]);
      if (worker.exitCode === null) worker.kill("SIGKILL");
    }
    await new Promise((resolve) => server.close(resolve));
    await disconnectDatabase();
    await rm(baseDir, { recursive: true, force: true });
  });

  async function request(route, { method = "GET", body, token, tenantId } = {}) {
    const response = await fetch(`${baseUrl}${route}`, {
      method,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(tenantId ? { "x-tenant-id": tenantId } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: response.status === 204 ? null : await response.json() };
  }
  async function jobResult(id, status) {
    return waitFor(async () => {
      return withTenantTransaction({ tenantId: auth.tenantId, userId: login.body.user.id }, (tx) => tx.runtimeJob.findFirst({
        where: { tenantId: auth.tenantId, id, status },
        select: { id: true, status: true, result: true, errorCode: true },
      }));
    }, `runtime job ${id} ${status}`);
  }

  const password = "Runtime-Integration-Only-Strong-Password-591!";
  const fixture = await createTestTenant({ name: `Runtime ${suffix}`, slug: `runtime-${suffix}`, username: `owner_${suffix.slice(-8)}`, password });
  const login = { body: { user: fixture.user } };
  const auth = { token: fixture.token, tenantId: fixture.tenant.id };
  const createdProject = await request("/api/v1/projects", {
    method: "POST", ...auth, body: { name: "Runtime workspace integration", key: `RT${suffix.replace(/\D/g, "").slice(-8)}` },
  });
  assert.equal(createdProject.status, 201, JSON.stringify(createdProject.body));
  const project = createdProject.body;
  const pairing = await request("/api/v1/runtime/pairings", { method: "POST", ...auth, body: {} });
  assert.equal(pairing.status, 201, JSON.stringify(pairing.body));

  await mkdir(workspacePath);
  await mkdir(runtimeHome);
  await mkdir(path.join(workspacePath, "nested"));
  await chmod(baseDir, 0o700);
  await chown(baseDir, runtimeUid, runtimeGid);
  await chown(workspacePath, runtimeUid, runtimeGid);
  await chown(path.join(workspacePath, "nested"), runtimeUid, runtimeGid);
  await chown(runtimeHome, runtimeUid, runtimeGid);
  const workspaceKey = randomBytes(24).toString("base64url");
  expectedSecret = "runtime-integration-secret-must-not-be-logged";
  await writeFile(configPath, JSON.stringify({ "project-runtime": { path: workspacePath, workspaceKey, permissions: { read: true, write: true, delete: true, execute: true }, commands: { node: "/usr/bin/node" } } }), { mode: 0o600 });
  await chown(configPath, runtimeUid, runtimeGid);
  await chmod(configPath, 0o600);
  // The actual runtime performs the one-use pairing, under a dedicated unprivileged UID.
  worker = spawn("/usr/bin/setpriv", [
    `--reuid=${runtimeUid}`, `--regid=${runtimeGid}`, "--clear-groups", process.execPath, runtimeEntry,
  ], {
    env: { PATH: process.env.PATH, HOME: runtimeHome, FREEAI_API_URL: baseUrl, FREEAI_PAIRING_CODE: pairing.body.pairingCode,
      FREEAI_RUNTIME_IDENTITY_FILE: identityPath, FREEAI_WORKSPACE_BINDINGS_FILE: configPath, FREEAI_RUNTIME_HEARTBEAT_MS: "5000" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  worker.stdout.setEncoding("utf8").on("data", (chunk) => { workerOutput = (workerOutput + chunk).slice(-32_000); });
  worker.stderr.setEncoding("utf8").on("data", (chunk) => { workerError = (workerError + chunk).slice(-8_000); });
  const pairingDeadline = Date.now() + 15_000;
  while (!workerOutput.includes("paired as") && worker.exitCode === null && Date.now() < pairingDeadline) await delay(50);
  assert.ok(workerOutput.includes("paired as"), `unprivileged runtime did not pair: ${workerError}`);
  assert.ok(!workerOutput.includes(expectedSecret));
  const deviceId = workerOutput.match(/paired as ([a-f0-9-]{36})/)?.[1];
  assert.ok(deviceId, `runtime pairing output has device id: ${workerOutput}`);
  const devices = await request("/api/v1/runtime/devices", auth);
  const device = devices.body.items.find((item) => item.id === deviceId);
  assert.ok(device, `paired runtime is visible: ${workerOutput} ${workerError}`);
  const projectGrant = await request(`/api/v1/runtime/devices/${device.id}/projects/${project.id}/grant`, { method: "POST", ...auth, body: {} });
  assert.equal(projectGrant.status, 200);
  const registeredWorkspace = await request("/api/v1/runtime/workspaces", {
    method: "POST", ...auth,
    body: { deviceId: device.id, projectId: project.id, name: "Runtime E2E workspace", rootAlias: "project-runtime", workspaceKey, canRead: true, canWrite: true, canDelete: true, canExecute: true },
  });
  assert.equal(registeredWorkspace.status, 201, JSON.stringify(registeredWorkspace.body));
  const deniedWorkspace = await request("/api/v1/runtime/workspaces", {
    method: "POST", ...auth,
    body: { deviceId: device.id, projectId: project.id, name: "Execution denied workspace", rootAlias: "project-denied", workspaceKey: randomBytes(24).toString("base64url"), canRead: true, canWrite: true },
  });
  assert.equal(deniedWorkspace.status, 201, JSON.stringify(deniedWorkspace.body));
  const deniedJob = await request("/api/v1/runtime/jobs", {
    method: "POST", ...auth,
    body: { deviceId: device.id, projectId: project.id, workspaceId: deniedWorkspace.body.id, kind: "SANDBOX_PROCESS", payload: { commandKey: "node", args: ["-e", "process.exit(0)"], approved: true }, idempotencyKey: `sandbox-denied-${suffix}` },
  });
  assert.equal(deniedJob.status, 403);
  assert.equal(deniedJob.body.code, "WORKSPACE_EXECUTION_DENIED");
  const createJob = (kind, payload, key) => request("/api/v1/runtime/jobs", {
    method: "POST", ...auth, body: { deviceId: device.id, projectId: project.id, workspaceId: registeredWorkspace.body.id, kind, payload, idempotencyKey: key },
  });
  const queuedCancel = await createJob("WORKSPACE_WRITE", { relativePath: "cancelled.txt", content: "must not appear" }, `cancel-before-${suffix}`);
  assert.equal(queuedCancel.status, 201, JSON.stringify(queuedCancel.body));
  const cancelled = await request(`/api/v1/runtime/jobs/${queuedCancel.body.id}/cancel`, { method: "POST", ...auth, body: {} });
  assert.equal(cancelled.body.status, "CANCELLED");

  const write = await createJob("WORKSPACE_WRITE", { relativePath: "nested/result.txt", content: "written by the live local runtime" }, `write-${suffix}`);
  assert.equal(write.status, 201, JSON.stringify(write.body));
  const writeResult = await jobResult(write.body.id, "SUCCEEDED");
  assert.equal(writeResult.result.written, true);
  assert.equal(writeResult.result.logs[0].operation, "WRITE");
  assert.equal(await readFile(path.join(workspacePath, "nested/result.txt"), "utf8"), "written by the live local runtime");

  const read = await createJob("WORKSPACE_READ", { relativePath: "nested/result.txt" }, `read-${suffix}`);
  assert.equal(read.status, 201);
  const readResult = await jobResult(read.body.id, "SUCCEEDED");
  assert.equal(Buffer.from(readResult.result.contents, "base64").toString("utf8"), "written by the live local runtime");
  assert.equal(readResult.result.logs[0].operation, "READ");

  const traversal = await createJob("WORKSPACE_READ", { relativePath: "../outside.txt" }, `traversal-${suffix}`);
  const traversalResult = await jobResult(traversal.body.id, "FAILED");
  assert.equal(traversalResult.errorCode, "WORKSPACE_PATH_TRAVERSAL_DENIED");
  const outsidePath = path.join(baseDir, "outside.txt");
  await writeFile(outsidePath, "host-only", { mode: 0o600 });
  await symlink(outsidePath, path.join(workspacePath, "escape.txt"));
  const symlinkJob = await createJob("WORKSPACE_READ", { relativePath: "escape.txt" }, `symlink-${suffix}`);
  const symlinkResult = await jobResult(symlinkJob.body.id, "FAILED");
  assert.equal(symlinkResult.errorCode, "WORKSPACE_SYMLINK_DENIED");
  assert.equal(await readFile(outsidePath, "utf8"), "host-only");

  const deleteWithoutApproval = await createJob("WORKSPACE_DELETE", { relativePath: "nested/result.txt" }, `delete-denied-${suffix}`);
  assert.equal(deleteWithoutApproval.status, 409);
  const deleteJob = await createJob("WORKSPACE_DELETE", { relativePath: "nested/result.txt", approved: true }, `delete-${suffix}`);
  assert.equal(deleteJob.status, 201, JSON.stringify(deleteJob.body));
  const deleteResult = await jobResult(deleteJob.body.id, "SUCCEEDED");
  assert.equal(deleteResult.result.deleted, true);
  await assert.rejects(readFile(path.join(workspacePath, "nested/result.txt")));

  const unapprovedProcess = await createJob("SANDBOX_PROCESS", { commandKey: "node", args: ["-e", "process.exit(0)"], timeoutMs: 10_000 }, `sandbox-unapproved-${suffix}`);
  assert.equal(unapprovedProcess.status, 400);
  assert.equal(unapprovedProcess.body.code, "SANDBOX_PROCESS_REQUEST_INVALID");
  const sandboxCode = "const fs=require('node:fs'),net=require('node:net');let outsideRead='blocked',symlinkRead='blocked',etcRead='blocked',outsideWrite='blocked';try{outsideRead=fs.readFileSync(process.argv[1],'utf8')}catch{};try{symlinkRead=fs.readFileSync('escape.txt','utf8')}catch{};try{etcRead=fs.readFileSync('/etc/passwd','utf8')}catch{};try{fs.writeFileSync(process.argv[1],'escaped');outsideWrite='written'}catch{};const u=new URL(process.argv[2]);const network=new Promise(resolve=>{const socket=net.connect({host:u.hostname,port:Number(u.port)},()=>{socket.destroy();resolve('connected')});socket.setTimeout(500,()=>{socket.destroy();resolve('blocked')});socket.on('error',()=>resolve('blocked'))});fs.writeFileSync('sandbox-result.txt','created inside sandbox');network.then(value=>process.stdout.write(JSON.stringify({outsideRead,symlinkRead,etcRead,outsideWrite,network:value})))";
  const sandboxJob = await createJob("SANDBOX_PROCESS", { commandKey: "node", args: ["-e", sandboxCode, outsidePath, baseUrl], timeoutMs: 10_000, approved: true }, `sandbox-execute-${suffix}`);
  assert.equal(sandboxJob.status, 201, JSON.stringify(sandboxJob.body));
  const sandboxResult = await jobResult(sandboxJob.body.id, "SUCCEEDED");
  assert.equal(sandboxResult.result.code, 0);
  assert.deepEqual(JSON.parse(sandboxResult.result.stdout), { outsideRead: "blocked", symlinkRead: "blocked", etcRead: "blocked", outsideWrite: "blocked", network: "blocked" });
  assert.equal(sandboxResult.result.logs.at(-1).operation, "EXECUTE");
  assert.equal(await readFile(path.join(workspacePath, "sandbox-result.txt"), "utf8"), "created inside sandbox");
  assert.equal(await readFile(outsidePath, "utf8"), "host-only");

  const longSandboxJob = await createJob("SANDBOX_PROCESS", { commandKey: "node", args: ["-e", "setInterval(()=>{},1000)"], timeoutMs: 60_000, approved: true }, `sandbox-cancel-${suffix}`);
  assert.equal(longSandboxJob.status, 201, JSON.stringify(longSandboxJob.body));
  await waitFor(() => withTenantTransaction({ tenantId: auth.tenantId, userId: login.body.user.id }, (tx) => tx.runtimeJob.findFirst({ where: { id: longSandboxJob.body.id, status: "RUNNING" }, select: { id: true } })), "sandbox process start");
  const sandboxCancel = await request(`/api/v1/runtime/jobs/${longSandboxJob.body.id}/cancel`, { method: "POST", ...auth, body: {} });
  assert.equal(sandboxCancel.status, 200);
  await jobResult(longSandboxJob.body.id, "CANCELLED");

  assert.equal(await readFile(path.join(workspacePath, "cancelled.txt")).then(() => "exists", () => "absent"), "absent");
  const logs = await request(`/api/v1/runtime/logs?deviceId=${encodeURIComponent(device.id)}`, auth);
  assert.ok(logs.body.items.some((item) => item.event === "JOB_SUCCEEDED"));
  assert.ok(workerOutput.includes("JOB_FINISHED"));
  assert.ok(!workerOutput.includes(expectedSecret));

  const revoked = await request(`/api/v1/runtime/devices/${device.id}/revoke`, { method: "POST", ...auth, body: {} });
  assert.equal(revoked.body.status, "REVOKED");
  const exit = await Promise.race([new Promise((resolve) => worker.once("exit", (code) => resolve(code))), delay(10_000).then(() => "timeout")]);
  assert.notEqual(exit, "timeout", `runtime did not stop after revocation: ${workerError}`);
  const afterRevocation = await createJob("WORKSPACE_WRITE", { relativePath: "after-revoke.txt", content: "denied" }, `after-revoke-${suffix}`);
  assert.equal(afterRevocation.status, 404);
  assert.equal(await readFile(path.join(workspacePath, "after-revoke.txt")).then(() => "exists", () => "absent"), "absent");
});

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function waitFor(read, label, diagnostic = () => "") {
  const expires = Date.now() + 15_000;
  while (Date.now() < expires) {
    const value = await read();
    if (value) return value;
    if (diagnostic && !workerAlive()) throw new Error(`${label} failed: ${diagnostic()}`);
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${label}${diagnostic ? `: ${diagnostic()}` : ""}`);
}
function workerAlive() { return true; }
