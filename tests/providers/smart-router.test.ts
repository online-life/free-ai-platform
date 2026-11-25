import { describe, expect, it, vi } from "vitest";
import type { ProviderExecutionResult } from "../../apps/api/src/modules/providers/provider.types";
import { SmartModelRouterService } from "../../apps/api/src/modules/model-intelligence/smart-model-router.service";
import { ModelSelectionService } from "../../apps/api/src/modules/model-intelligence/model-selection.service";

const models = ["first", "second"].map((key, index) => ({
  id: key,
  key,
  displayName: key,
  capabilities: ["TEXT_GENERATION" as const],
  contextWindow: 4096,
  maxOutputTokens: 1024,
  freeTier: true,
  billingMode: "FREE" as const,
  freeTierStatus: "VERIFIED_FREE" as const,
  enabled: true,
  availability: "AVAILABLE" as const,
  privacyApproved: true,
  providerKey: `provider-${key}`,
  qualityScore: 90 - index,
  latencyScore: 80,
  reliabilityScore: 90,
}));

describe("SmartModelRouterService", () => {
  const scope = { tenantId: "tenant-1", projectId: "project-1" };

  function createRouter(execute: (raw: unknown, scope: typeof scope) => Promise<ProviderExecutionResult>) {
    const repository = {
      listAvailable: async () => models,
      findByKey: async () => null,
      saveEvaluation: async () => undefined,
    };
    const selection = new ModelSelectionService(repository as never);
    const gateway = { execute: vi.fn(execute) };
    return { router: new SmartModelRouterService(selection, gateway as never), gateway };
  }

  it("honors an explicit model choice while retaining server-side eligibility policy", async () => {
    const repository = { listAvailable: async () => models, findByKey: async () => null, saveEvaluation: async () => undefined };
    const selection = new ModelSelectionService(repository as never);
    await expect(selection.select({ capabilities: ["TEXT_GENERATION"], modelKey: "second", requireFree: true }, scope)).resolves.toMatchObject({ model: { key: "second" } });
    await expect(selection.select({ capabilities: ["TEXT_GENERATION"], modelKey: "not-authorized", requireFree: true }, scope)).rejects.toThrow("NO_COMPATIBLE_MODEL");
  });

  it("routes by capability and falls back only on bounded transient failures", async () => {
    const execute = vi.fn(async (raw: unknown) => {
      const request = raw as { modelKey: string };
      if (request.modelKey === "first") throw new Error("PROVIDER_TIMEOUT");
      return { output: "ok" };
    });
    const { router, gateway } = createRouter(execute);
    const result = await router.execute({
      selection: { capabilities: ["TEXT_GENERATION"], requireFree: true },
      operation: "CHAT", messages: [{ role: "user", content: "hello" }],
      requestId: "request-1", maxFallbacks: 1,
    }, scope);
    expect(result).toMatchObject({ modelKey: "second", fallbackCount: 1, result: { output: "ok" } });
    expect(gateway.execute).toHaveBeenCalledTimes(2);
  });

  it("does not retry authentication failures", async () => {
    const { router, gateway } = createRouter(async () => { throw new Error("PROVIDER_AUTHENTICATION_FAILED"); });
    await expect(router.execute({
      selection: { capabilities: ["TEXT_GENERATION"], requireFree: true },
      operation: "CHAT", messages: [{ role: "user", content: "hello" }],
      requestId: "request-2", maxFallbacks: 2,
    }, scope)).rejects.toThrow("PROVIDER_AUTHENTICATION_FAILED");
    expect(gateway.execute).toHaveBeenCalledTimes(1);
  });
});
