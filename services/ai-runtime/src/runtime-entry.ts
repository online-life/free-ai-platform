import os from "node:os";
import path from "node:path";
import { registerWorkspaceHandlers } from "./workspace-handlers.js";
import { loadWorkspaceBindings } from "./workspace-bindings-config.js";
import { FetchRuntimeTransport, LocalRuntime, saveRuntimeIdentity, type RuntimeIdentity } from "./runtime-client.js";

const runtimeVersion = "0.1.0";

async function main(): Promise<void> {
  if (process.getuid?.() === 0) throw new Error("RUNTIME_MUST_NOT_RUN_AS_ROOT");
  const apiUrl = process.env.FREEAI_API_URL;
  if (!apiUrl) throw new Error("FREEAI_API_URL_REQUIRED");
  const transport = new FetchRuntimeTransport(apiUrl);
  const identityPath = path.resolve(process.env.FREEAI_RUNTIME_IDENTITY_FILE ?? path.join(os.homedir(), ".config", "free-ai", "runtime-device.json"));
  let identity: RuntimeIdentity;

  if (process.env.FREEAI_PAIRING_CODE) {
    identity = await transport.pair(process.env.FREEAI_PAIRING_CODE, {
      name: os.hostname().slice(0, 120) || "Free AI Platform Runtime",
      operatingSystem: process.platform,
      architecture: process.arch,
      runtimeVersion,
    });
    await saveRuntimeIdentity(identityPath, identity);
    delete process.env.FREEAI_PAIRING_CODE;
    console.log(`Free AI Platform Runtime paired as ${identity.deviceId}.`);
  } else {
    identity = await loadIdentity(identityPath);
  }

  const heartbeatMs = Number(process.env.FREEAI_RUNTIME_HEARTBEAT_MS ?? 5000);
  if (!Number.isSafeInteger(heartbeatMs) || heartbeatMs < 1000 || heartbeatMs > 60_000) throw new Error("RUNTIME_HEARTBEAT_INTERVAL_INVALID");
  const runtime = new LocalRuntime(transport, identity, runtimeVersion, (entry) => {
    const fields = [entry.event, entry.jobId ? `job=${entry.jobId}` : "", entry.detail ?? ""].filter(Boolean);
    console.log(`${entry.at} ${fields.join(" ")}`);
  }, heartbeatMs);
  runtime.registerHandler("RUNTIME_HEALTH_CHECK", async () => ({
    status: "healthy",
    os: process.platform,
    architecture: process.arch,
    node: process.version,
  }));
  const bindingsFile = process.env.FREEAI_WORKSPACE_BINDINGS_FILE;
  if (bindingsFile) {
    const bindings = await loadWorkspaceBindings(path.resolve(bindingsFile));
    registerWorkspaceHandlers(runtime, bindings, (entry) => {
      console.log(`${entry.occurredAt} WORKSPACE_${entry.operation} ${entry.allowed ? "ALLOWED" : entry.reason} alias=${entry.rootAlias}`);
    });
  }

  const controller = new AbortController();
  const stop = () => controller.abort(new Error("RUNTIME_STOPPED"));
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  await runtime.run(controller.signal);
}

async function loadIdentity(filePath: string): Promise<RuntimeIdentity> {
  const fs = await import("node:fs/promises");
  const { constants } = await import("node:fs");
  const handle = await fs.open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.nlink !== 1 || process.getuid?.() !== stat.uid || (stat.mode & 0o077) !== 0) {
      throw new Error("RUNTIME_CREDENTIAL_FILE_UNSAFE");
    }
    const identity = JSON.parse(await handle.readFile("utf8")) as RuntimeIdentity;
    if (!identity.deviceId || identity.token.length < 40 || Date.parse(identity.tokenExpiresAt) <= Date.now()) {
      throw new Error("RUNTIME_IDENTITY_INVALID_OR_EXPIRED");
    }
    return identity;
  } finally {
    await handle.close();
  }
}

main().catch((error: unknown) => {
  const reason = error instanceof Error && /^[A-Z0-9_]{2,100}$/.test(error.message)
    ? error.message
    : "RUNTIME_START_FAILED";
  console.error(reason);
  process.exitCode = 1;
});
