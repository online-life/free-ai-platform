import { describe, expect, it, vi } from "vitest";
import { OpenAICompatibleAdapter } from "../../apps/api/src/modules/providers/openai-compatible.adapter";
import { ModelSelectionService } from "../../apps/api/src/modules/model-intelligence/model-selection.service";
import { FreeOnlyProviderPolicy, UnifiedGatewayService } from "../../apps/api/src/modules/providers/unified-gateway.service";
import { ProviderAdapterRegistry } from "../../apps/api/src/modules/providers/provider-adapter.registry";
import type { ProviderRecord } from "../../apps/api/src/modules/providers/provider.types";
import { createServer } from "node:http";

const publicDns = async () => ["93.184.216.34"];

describe("OpenAI-compatible adapter", () => {
  it("normalizes chat responses and reports usage without exposing credentials", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      id: "req-1",
      choices: [{ message: { content: "hello" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
    }), { status: 200 }));
    const adapter = new OpenAICompatibleAdapter("test-provider", "https://example.test/v1", fetcher, {}, publicDns);
    const result = await adapter.execute({
      model: "model-a", operation: "CHAT", messages: [{ role: "user", content: "hi" }],
      parameters: {}, requestId: "req-1",
    }, "secret-value");

    expect(result).toMatchObject({ output: "hello", providerRequestId: "req-1", usage: { totalTokens: 5 } });
    expect(fetcher.mock.calls[0]?.[0]?.toString()).toBe("https://example.test/v1/chat/completions");
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get("authorization")).toBe("Bearer secret-value");
  });

  it("supports model discovery and embeddings, but rejects unsupported modalities", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: "alpha" }, { id: "beta" }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2] }] })));
    const adapter = new OpenAICompatibleAdapter("test-provider", "https://example.test/v1", fetcher, {}, publicDns);
    await expect(adapter.listModels("credential")).resolves.toEqual(["alpha", "beta"]);
    await expect(adapter.execute({
      model: "embed", operation: "EMBEDDINGS", input: "text", parameters: {}, requestId: "r2",
    }, "credential")).resolves.toMatchObject({ output: [[0.1, 0.2]] });
    await expect(adapter.execute({
      model: "image", operation: "IMAGE", parameters: {}, requestId: "r3",
    }, "credential")).rejects.toThrow("PROVIDER_OPERATION_UNSUPPORTED");
  });

  it("normalizes provider errors and rejects insecure remote endpoints", async () => {
    const adapter = new OpenAICompatibleAdapter("test-provider", "https://example.test/v1", vi.fn<typeof fetch>().mockResolvedValue(
      new Response("private upstream details", { status: 401 }),
    ), {}, publicDns);
    await expect(adapter.execute({
      model: "alpha", operation: "CHAT", messages: [{ role: "user", content: "x" }],
      parameters: {}, requestId: "r4",
    }, "credential")).rejects.toThrow("PROVIDER_AUTHENTICATION_FAILED");
    expect(() => new OpenAICompatibleAdapter("bad-provider", "http://example.test/v1")).toThrow("PROVIDER_URL_MUST_USE_HTTPS");
  });

  it("rejects a DNS answer that mixes public and private addresses before sending credentials", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const adapter = new OpenAICompatibleAdapter(
      "mixed-dns-provider", "https://provider.example/v1", fetcher, {},
      async () => ["93.184.216.34", "169.254.169.254"],
    );
    await expect(adapter.listModels("credential-value")).rejects.toThrow("PROVIDER_DESTINATION_NOT_ALLOWED");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    "0.0.0.1", "10.1.2.3", "100.64.1.1", "127.0.0.1", "169.254.169.254", "172.16.0.1",
    "192.168.1.1", "198.18.0.1", "224.0.0.1", "255.255.255.255", "::1", "fc00::1",
    "fe80::1", "::ffff:127.0.0.1", "ff02::1", "2001:db8::1",
  ])("rejects non-public provider address %s", async (address) => {
    const fetcher = vi.fn<typeof fetch>();
    const adapter = new OpenAICompatibleAdapter("private-address-provider", "https://provider.example/v1", fetcher, {}, async () => [address]);
    await expect(adapter.listModels("credential-value")).rejects.toThrow("PROVIDER_DESTINATION_NOT_ALLOWED");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("uses a locally pinned socket for an explicitly trusted local endpoint", async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ data: [{ id: "local-model" }] }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("LOCAL_PROVIDER_TEST_SERVER_START_FAILED");
    try {
      const adapter = new OpenAICompatibleAdapter(
        "local-pinned-provider", `http://127.0.0.1:${address.port}/v1`, undefined,
        { authenticationType: "NONE", allowLocal: true },
      );
      await expect(adapter.listModels("")).resolves.toEqual(["local-model"]);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("does not follow provider redirects", async () => {
    let requests = 0;
    const server = createServer((_request, response) => {
      requests += 1;
      response.writeHead(302, { location: "/redirect-target" });
      response.end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("LOCAL_PROVIDER_TEST_SERVER_START_FAILED");
    try {
      const adapter = new OpenAICompatibleAdapter(
        "local-redirect-provider", `http://127.0.0.1:${address.port}/v1`, undefined,
        { authenticationType: "NONE", allowLocal: true },
      );
      await expect(adapter.listModels("")).rejects.toThrow("PROVIDER_REQUEST_REJECTED");
      expect(requests).toBe(1);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});

describe("gateway cost policy and model selection", () => {
  const provider = (overrides: Partial<ProviderRecord> = {}): ProviderRecord => ({
    id: "p1", key: "test-provider", name: "Test", baseUrl: "https://example.test/v1",
    status: "ACTIVE", billingMode: "FREE", freeTierStatus: "VERIFIED_FREE",
    timeoutMs: 1000, secretReference: "secret-ref", providerType: "OPENAI_COMPATIBLE", ...overrides,
    authenticationType: "BEARER", customHeaders: {}, healthStatus: "AVAILABLE",
  });

  it("blocks unknown and paid providers before credential access", async () => {
    const resolve = vi.fn(async () => "secret");
    const service = new UnifiedGatewayService(
      { findByKey: async () => provider({ billingMode: "UNKNOWN", freeTierStatus: "UNKNOWN" }), listActive: async () => [] },
      new ProviderAdapterRegistry(), { resolve }, { record: async () => undefined }, new FreeOnlyProviderPolicy(),
    );
    await expect(service.execute({ providerKey: "test-provider", modelKey: "alpha", operation: "CHAT", messages: [{ role: "user", content: "x" }], requestId: "r5" }, { tenantId: "t", projectId: "p" }))
      .rejects.toThrow("PROVIDER_BLOCKED_BY_FREE_ONLY_POLICY");
    expect(resolve).not.toHaveBeenCalled();
  });

  it("runs an authorized free model through the gateway and records scoped usage", async () => {
    const selectedProvider = provider();
    const scope = { tenantId: "tenant-a", projectId: "project-a" };
    const adapter = {
      providerKey: selectedProvider.key,
      supports: (operation: string) => operation === "CHAT",
      execute: vi.fn(async () => ({ output: "ok", usage: { totalTokens: 8 } })),
    };
    const registry = new ProviderAdapterRegistry();
    registry.register(adapter);
    const usageRecord = vi.fn(async () => undefined);
    const credentialResolve = vi.fn(async (reference: string) => {
      expect(reference).toBe("secret-ref");
      return "credential";
    });
    const service = new UnifiedGatewayService(
      {
        findByKey: async (key, actualScope) => key === selectedProvider.key && actualScope === scope ? selectedProvider : null,
        listActive: async () => [selectedProvider],
        findModel: async () => ({
          modelId: "alpha", capabilities: ["TEXT_GENERATION"], enabled: true,
          privacyApproved: true, billingMode: "FREE", freeTierStatus: "VERIFIED_FREE",
          contextWindow: 4096, maxOutputTokens: 1024,
        }),
      },
      registry,
      { resolve: credentialResolve },
      { record: usageRecord },
    );
    await expect(service.execute({
      providerKey: selectedProvider.key,
      modelKey: "alpha",
      operation: "CHAT",
      messages: [{ role: "user", content: "hello" }],
      requestId: "gateway-1",
    }, scope)).resolves.toMatchObject({ output: "ok" });
    expect(credentialResolve).toHaveBeenCalledTimes(1);
    expect(adapter.execute).toHaveBeenCalledTimes(1);
    expect(usageRecord).toHaveBeenCalledWith(expect.objectContaining({
      providerId: selectedProvider.id,
      modelKey: "alpha",
      scope,
      success: true,
    }));
  });

  it("selects a verified free capable model and excludes unknown cost models", async () => {
    const repository = {
      listAvailable: async () => [
        { id: "paid", key: "paid", displayName: "Paid", capabilities: ["TEXT_GENERATION"], contextWindow: 8000, maxOutputTokens: 1000, freeTier: false, billingMode: "PAY_PER_TOKEN", freeTierStatus: "PAID", availability: "AVAILABLE", privacyApproved: true, enabled: true, qualityScore: 99, latencyScore: 99, reliabilityScore: 99 },
        { id: "free", key: "free", displayName: "Free", capabilities: ["TEXT_GENERATION"], contextWindow: 8000, maxOutputTokens: 1000, freeTier: true, billingMode: "FREE", freeTierStatus: "VERIFIED_FREE", availability: "AVAILABLE", privacyApproved: true, providerKey: "provider-a", enabled: true, qualityScore: 70, latencyScore: 70, reliabilityScore: 80 },
        { id: "unknown", key: "unknown", displayName: "Unknown", capabilities: ["TEXT_GENERATION"], contextWindow: 8000, maxOutputTokens: 1000, freeTier: true, billingMode: "UNKNOWN", freeTierStatus: "UNKNOWN", availability: "AVAILABLE", privacyApproved: true, enabled: true, qualityScore: 100, latencyScore: 100, reliabilityScore: 100 },
      ],
      findByKey: async () => null,
      saveEvaluation: async () => undefined,
    } as const;
    const service = new ModelSelectionService(repository);
    const selected = await service.select({ capabilities: ["TEXT_GENERATION"], requireFree: false }, { tenantId: "t", projectId: "p" });
    expect(selected.model.key).toBe("free");
    expect(selected.model.providerKey).toBe("provider-a");
  });
});
