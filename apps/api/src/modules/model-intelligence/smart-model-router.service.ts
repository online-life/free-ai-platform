import { z } from "zod";
import type { ProviderRequestScope, ProviderExecutionResult } from "../providers/provider.types";
import type { UnifiedGatewayService } from "../providers/unified-gateway.service";
import { ModelSelectionService } from "./model-selection.service";

const SmartRequestSchema = z.object({
  selection: z.record(z.string(), z.unknown()),
  operation: z.enum(["CHAT", "EMBEDDINGS", "IMAGE", "AUDIO", "STRUCTURED"]),
  messages: z.array(z.object({ role: z.enum(["system", "user", "assistant", "tool"]), content: z.unknown() })).optional(),
  input: z.unknown().optional(),
  parameters: z.record(z.string(), z.unknown()).default({}),
  requestId: z.string().min(1).max(160),
  maxFallbacks: z.number().int().min(0).max(2).default(0),
}).strict();

const RETRYABLE = new Set([
  "PROVIDER_NETWORK_ERROR", "PROVIDER_TIMEOUT", "PROVIDER_UPSTREAM_UNAVAILABLE", "PROVIDER_RATE_LIMITED",
]);

export interface SmartModelRouterResult {
  result: ProviderExecutionResult;
  providerKey: string;
  modelKey: string;
  fallbackCount: number;
  selectionReasons: string[];
}

export class SmartModelRouterService {
  constructor(
    private readonly selection: ModelSelectionService,
    private readonly gateway: UnifiedGatewayService,
  ) {}

  async execute(raw: unknown, scope: ProviderRequestScope): Promise<SmartModelRouterResult> {
    const input = SmartRequestSchema.parse(raw);
    const excludedModels: string[] = [];
    const fallbackReasons: string[] = [];
    const operationCapability: Record<string, string> = {
      CHAT: "TEXT_GENERATION",
      STRUCTURED: "STRUCTURED_OUTPUT",
      EMBEDDINGS: "EMBEDDINGS",
    };
    const requiredCapability = operationCapability[input.operation];
    if (!requiredCapability) throw new Error("MODEL_OPERATION_UNSUPPORTED");
    for (let attempt = 0; attempt <= input.maxFallbacks; attempt += 1) {
      const selection = await this.selection.select({
        ...input.selection,
        capabilities: [
          ...(Array.isArray(input.selection.capabilities)
            ? input.selection.capabilities.filter((item): item is string => typeof item === "string")
            : []),
          requiredCapability,
        ],
        excludedModels: [...new Set([
          ...((Array.isArray(input.selection.excludedModels)
            ? input.selection.excludedModels.filter((item): item is string => typeof item === "string")
            : [])),
          ...excludedModels,
        ])],
      }, scope);
      const providerKey = selection.model.providerKey;
      if (!providerKey) throw new Error("SELECTED_MODEL_PROVIDER_MISSING");
      try {
        const result = await this.gateway.execute({
          providerKey,
          modelKey: selection.model.key,
          operation: input.operation,
          ...(input.messages ? { messages: input.messages } : {}),
          ...(input.input !== undefined ? { input: input.input } : {}),
          parameters: input.parameters,
          requestId: input.requestId,
        }, scope);
        return {
          result,
          providerKey,
          modelKey: selection.model.key,
          fallbackCount: attempt,
          selectionReasons: [...selection.reasons, ...fallbackReasons],
        };
      } catch (error) {
        const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
        if (attempt >= input.maxFallbacks || !RETRYABLE.has(code)) throw error;
        excludedModels.push(`${providerKey}:${selection.model.key}`);
        fallbackReasons.push(`Fallback after ${code} from ${selection.model.key}`);
      }
    }
    throw new Error("NO_COMPATIBLE_MODEL");
  }
}
