import { setTimeout as delay } from "node:timers/promises";

export interface RuntimeJob {
  id: string;
  kind: string;
  payload: unknown;
}

export interface RuntimeHeartbeat {
  jobs: RuntimeJob[];
  cancelJobIds: string[];
  serverTime: string;
}

export interface RuntimeIdentity {
  deviceId: string;
  token: string;
  tokenExpiresAt: string;
}

export interface RuntimeTransport {
  pair(pairingCode: string, metadata: { name: string; operatingSystem: string; architecture: string; runtimeVersion: string }): Promise<RuntimeIdentity>;
  heartbeat(token: string, input: { runtimeVersion: string; health: "healthy" | "degraded"; activeJobIds: string[] }): Promise<RuntimeHeartbeat>;
  report(token: string, jobId: string, status: "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED", result?: unknown, errorCode?: string): Promise<void>;
}

/** progress() relays interim, non-final results (for example engine events) while a job is RUNNING. */
export type RuntimeJobHandler = (payload: unknown, signal: AbortSignal, progress: (update: unknown) => void) => Promise<unknown>;
export type RuntimeLog = (entry: { event: string; deviceId?: string; jobId?: string; detail?: string; at: string }) => void;

export class RuntimeRevokedError extends Error {
  constructor() {
    super("RUNTIME_DEVICE_REVOKED");
    this.name = "RuntimeRevokedError";
  }
}

export class FetchRuntimeTransport implements RuntimeTransport {
  private readonly origin: URL;

  constructor(private readonly apiBaseUrl: string, private readonly fetcher: typeof fetch = fetch) {
    this.origin = new URL(apiBaseUrl);
    const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(this.origin.hostname);
    if (this.origin.protocol !== "https:" && !(local && this.origin.protocol === "http:")) {
      throw new Error("RUNTIME_API_REQUIRES_HTTPS");
    }
    if (this.origin.username || this.origin.password || this.origin.search || this.origin.hash) {
      throw new Error("RUNTIME_API_URL_INVALID");
    }
  }

  async pair(pairingCode: string, metadata: { name: string; operatingSystem: string; architecture: string; runtimeVersion: string }): Promise<RuntimeIdentity> {
    return this.request("/api/v1/runtime/enroll", { pairingCode, ...metadata }) as Promise<RuntimeIdentity>;
  }

  async heartbeat(token: string, input: { runtimeVersion: string; health: "healthy" | "degraded"; activeJobIds: string[] }): Promise<RuntimeHeartbeat> {
    return this.request("/api/v1/runtime/heartbeat", input, token) as Promise<RuntimeHeartbeat>;
  }

  async report(token: string, jobId: string, status: "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED", result?: unknown, errorCode?: string): Promise<void> {
    await this.request(`/api/v1/runtime/jobs/${encodeURIComponent(jobId)}/status`, {
      status,
      ...(result !== undefined ? { result } : {}),
      ...(errorCode ? { errorCode } : {}),
    }, token);
  }

  private async request(path: string, body: unknown, token?: string): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetcher(new URL(path, this.origin), {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error("RUNTIME_BACKEND_UNAVAILABLE");
    }
    if (response.status === 401 || response.status === 403) throw new RuntimeRevokedError();
    if (!response.ok) throw new Error(`RUNTIME_BACKEND_HTTP_${response.status}`);
    try {
      return await response.json();
    } catch {
      throw new Error("RUNTIME_BACKEND_RESPONSE_INVALID");
    }
  }
}

/** Stores a device token in an owner-only file. Never writes it to logs. */
export async function saveRuntimeIdentity(filePath: string, identity: RuntimeIdentity): Promise<void> {
  if (process.platform !== "linux" || process.getuid?.() === 0) {
    throw new Error("RUNTIME_CREDENTIAL_STORE_UNSUPPORTED_OR_PRIVILEGED");
  }
  const fs = await import("node:fs/promises");
  const { constants } = await import("node:fs");
  const path = await import("node:path");
  const directory = path.dirname(path.resolve(filePath));
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const directoryStat = await fs.lstat(directory);
  if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory() || directoryStat.uid !== process.getuid?.()) {
    throw new Error("RUNTIME_CREDENTIAL_DIRECTORY_UNSAFE");
  }
  const canonicalDirectory = await fs.realpath(directory);
  const target = path.join(canonicalDirectory, path.basename(filePath));
  const handle = await fs.open(target, constants.O_WRONLY | constants.O_CREAT | constants.O_NOFOLLOW, 0o600);
  try {
    const fileStat = await handle.stat();
    if (!fileStat.isFile() || fileStat.nlink !== 1 || fileStat.uid !== process.getuid?.()) {
      throw new Error("RUNTIME_CREDENTIAL_FILE_UNSAFE");
    }
    await handle.chmod(0o600);
    await handle.truncate(0);
    await handle.writeFile(JSON.stringify(identity), { encoding: "utf8" });
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export class LocalRuntime {
  private readonly handlers = new Map<string, RuntimeJobHandler>();
  private readonly active = new Map<string, AbortController>();
  private stopRequested = false;
  private stopController = new AbortController();
  private health: "healthy" | "degraded" = "healthy";

  constructor(
    private readonly transport: RuntimeTransport,
    private readonly identity: RuntimeIdentity,
    private readonly runtimeVersion: string,
    private readonly log: RuntimeLog = () => undefined,
    private readonly heartbeatMs = 5_000,
  ) {}

  registerHandler(kind: string, handler: RuntimeJobHandler): void {
    if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(kind) || this.handlers.has(kind)) {
      throw new Error("RUNTIME_JOB_HANDLER_INVALID");
    }
    this.handlers.set(kind, handler);
  }

  async run(signal?: AbortSignal): Promise<void> {
    if (process.getuid?.() === 0) throw new Error("RUNTIME_MUST_NOT_RUN_AS_ROOT");
    this.stopRequested = false;
    this.stopController = new AbortController();
    const runSignal = signal ? AbortSignal.any([signal, this.stopController.signal]) : this.stopController.signal;
    let backoffMs = this.heartbeatMs;
    this.writeLog("RUNTIME_START", { deviceId: this.identity.deviceId });

    while (!this.stopRequested && !runSignal.aborted) {
      try {
        const heartbeat = await this.transport.heartbeat(this.identity.token, {
          runtimeVersion: this.runtimeVersion,
          health: this.health,
          activeJobIds: [...this.active.keys()],
        });
        this.health = "healthy";
        backoffMs = this.heartbeatMs;
        this.writeLog("HEARTBEAT_OK", { deviceId: this.identity.deviceId });
        for (const jobId of heartbeat.cancelJobIds) this.active.get(jobId)?.abort(new Error("RUNTIME_JOB_CANCELLED"));
        for (const job of heartbeat.jobs) {
          if (!this.active.has(job.id)) void this.processJob(job);
        }
        await delay(this.heartbeatMs, undefined, { signal: runSignal }).catch(() => undefined);
      } catch (error) {
        if (error instanceof RuntimeRevokedError) {
          this.writeLog("DEVICE_REVOKED", { deviceId: this.identity.deviceId });
          this.stopRequested = true;
          break;
        }
        this.health = "degraded";
        this.writeLog("BACKEND_RECONNECTING", { deviceId: this.identity.deviceId });
        await delay(backoffMs, undefined, { signal: runSignal }).catch(() => undefined);
        backoffMs = Math.min(backoffMs * 2, 60_000);
      }
    }

    for (const controller of this.active.values()) controller.abort(new Error("RUNTIME_STOPPED"));
    await Promise.allSettled([...this.active.keys()].map((jobId) => this.transport.report(this.identity.token, jobId, "CANCELLED")));
    this.writeLog("RUNTIME_STOP", { deviceId: this.identity.deviceId });
  }

  stop(): void {
    this.stopRequested = true;
    this.stopController.abort(new Error("RUNTIME_STOPPED"));
  }

  async processJob(job: RuntimeJob): Promise<void> {
    const handler = this.handlers.get(job.kind);
    if (!handler) {
      await this.transport.report(this.identity.token, job.id, "FAILED", undefined, "RUNTIME_JOB_KIND_UNSUPPORTED");
      this.writeLog("JOB_REJECTED", { jobId: job.id, detail: "UNSUPPORTED_KIND" });
      return;
    }

    const controller = new AbortController();
    this.active.set(job.id, controller);
    try {
      await this.transport.report(this.identity.token, job.id, "RUNNING");
      const progress = (update: unknown) => {
        if (controller.signal.aborted) return;
        void this.transport.report(this.identity.token, job.id, "RUNNING", update).catch(() => undefined);
      };
      const result = await handler(job.payload, controller.signal, progress);
      const status = controller.signal.aborted ? "CANCELLED" : "SUCCEEDED";
      await this.transport.report(this.identity.token, job.id, status, status === "SUCCEEDED" ? result : undefined);
      this.writeLog("JOB_FINISHED", { jobId: job.id, detail: status });
    } catch (error) {
      const cancelled = controller.signal.aborted;
      const errorCode = error instanceof Error && /^[A-Z0-9_]{2,100}$/.test(error.message)
        ? error.message
        : "RUNTIME_JOB_FAILED";
      const failureResult = typeof error === "object" && error !== null && "result" in error
        ? (error as { result: unknown }).result
        : undefined;
      await this.transport.report(this.identity.token, job.id, cancelled ? "CANCELLED" : "FAILED", cancelled ? undefined : failureResult, errorCode).catch(() => undefined);
      this.writeLog(cancelled ? "JOB_CANCELLED" : "JOB_FAILED", { jobId: job.id, detail: errorCode });
    } finally {
      this.active.delete(job.id);
    }
  }

  cancelJob(jobId: string): boolean {
    const controller = this.active.get(jobId);
    if (!controller) return false;
    controller.abort(new Error("RUNTIME_JOB_CANCELLED"));
    return true;
  }

  private writeLog(event: string, fields: { deviceId?: string; jobId?: string; detail?: string }): void {
    this.log({ event, ...fields, at: new Date().toISOString() });
  }
}
