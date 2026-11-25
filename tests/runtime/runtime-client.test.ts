import { describe, expect, it, vi } from "vitest";
import { FetchRuntimeTransport, LocalRuntime, type RuntimeIdentity, type RuntimeTransport } from "../../services/ai-runtime/src/runtime-client";

const identity: RuntimeIdentity = { deviceId: "device-a", token: "runtime-secret", tokenExpiresAt: "2030-01-01T00:00:00.000Z" };

describe("Local Runtime transport", () => {
  it("requires TLS for non-loopback backends and sends pairing without a device token", async () => {
    expect(() => new FetchRuntimeTransport("http://backend.example.test")).toThrow("RUNTIME_API_REQUIRES_HTTPS");
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(identity)));
    const transport = new FetchRuntimeTransport("http://127.0.0.1:3000", fetcher);
    await expect(transport.pair("one-time-pair-code", { name: "host", operatingSystem: "linux", architecture: "x64", runtimeVersion: "0.1.0" })).resolves.toEqual(identity);
    expect(fetcher.mock.calls[0]?.[0]?.toString()).toBe("http://127.0.0.1:3000/api/v1/runtime/enroll");
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).has("authorization")).toBe(false);
  });

  it("sends bearer auth for heartbeat and turns revocation into a terminal error", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ jobs: [], cancelJobIds: [], serverTime: new Date().toISOString() })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: "DEVICE_REVOKED" }), { status: 401 }));
    const transport = new FetchRuntimeTransport("https://backend.example.test", fetcher);
    await expect(transport.heartbeat(identity.token, { runtimeVersion: "0.1.0", health: "healthy", activeJobIds: [] }))
      .resolves.toMatchObject({ jobs: [], cancelJobIds: [] });
    await expect(transport.heartbeat(identity.token, { runtimeVersion: "0.1.0", health: "healthy", activeJobIds: [] }))
      .rejects.toThrow("RUNTIME_DEVICE_REVOKED");
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get("authorization")).toBe("Bearer runtime-secret");
  });
});

describe("Local Runtime job handling", () => {
  const transport = (): RuntimeTransport & { report: ReturnType<typeof vi.fn> } => ({
    pair: vi.fn(),
    heartbeat: vi.fn(),
    report: vi.fn(async () => undefined),
  });

  it("fails closed for unsupported jobs and reports sanitized results", async () => {
    const api = transport();
    const logs: Array<{ event: string; detail?: string }> = [];
    const runtime = new LocalRuntime(api, identity, "0.1.0", (entry) => logs.push(entry));
    await runtime.processJob({ id: "job-1", kind: "SHELL", payload: { command: "whoami" } });
    expect(api.report).toHaveBeenCalledWith(identity.token, "job-1", "FAILED", undefined, "RUNTIME_JOB_KIND_UNSUPPORTED");
    expect(logs).toContainEqual(expect.objectContaining({ event: "JOB_REJECTED", detail: "UNSUPPORTED_KIND" }));
  });

  it("reports completed work and does not expose job output in logs", async () => {
    const api = transport();
    const log = vi.fn();
    const runtime = new LocalRuntime(api, identity, "0.1.0", log);
    runtime.registerHandler("HEALTH_CHECK", async () => ({ status: "ok" }));
    await runtime.processJob({ id: "job-2", kind: "HEALTH_CHECK", payload: {} });
    expect(api.report).toHaveBeenNthCalledWith(1, identity.token, "job-2", "RUNNING");
    expect(api.report).toHaveBeenNthCalledWith(2, identity.token, "job-2", "SUCCEEDED", { status: "ok" });
    expect(JSON.stringify(log.mock.calls)).not.toContain("status");
  });

  it("refuses to run as root", async () => {
    if (process.getuid?.() !== 0) return;
    const runtime = new LocalRuntime(transport(), identity, "0.1.0");
    await expect(runtime.run()).rejects.toThrow("RUNTIME_MUST_NOT_RUN_AS_ROOT");
  });
});
