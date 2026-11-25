import { GatewayRequestSchema } from "./provider.schemas";
import type {
  CredentialResolver,
  ProviderRepository,
  ProviderExecutionRequest,
  ProviderExecutionResult,
  ProviderRequestScope,
} from "./provider.types";
import { ProviderAdapterRegistry } from "./provider-adapter.registry";

export interface GatewayUsageRecorder {
  record(input: {
    scope: ProviderRequestScope;
    requestId: string;
    providerId: string;
    providerKey: string;
    modelKey: string;
    operation: string;
    taskId?: string;
    success: boolean;
    durationMs: number;
    usage?: ProviderExecutionResult["usage"];
    errorCode?: string;
  }): Promise<void>;
}

export interface ProviderCostPolicy {
  assertAllowed(provider: import("./provider.types").ProviderRecord): void;
}

export class FreeOnlyProviderPolicy implements ProviderCostPolicy {
  assertAllowed(provider: import("./provider.types").ProviderRecord) {
    const verifiedFree = provider.billingMode === "FREE" &&
      provider.freeTierStatus === "VERIFIED_FREE";
    if (provider.billingMode === "FREE_LIMITED" || provider.freeTierStatus === "VERIFIED_LIMITED") {
      throw new Error("PROVIDER_QUOTA_ENFORCEMENT_UNAVAILABLE");
    }
    if (!verifiedFree && provider.billingMode !== "SELF_HOSTED") {
      throw new Error("PROVIDER_BLOCKED_BY_FREE_ONLY_POLICY");
    }
  }
}

export class UnifiedGatewayService {
  constructor(
    private readonly providers: ProviderRepository,
    private readonly adapters: ProviderAdapterRegistry,
    private readonly credentials: CredentialResolver,
    private readonly usage: GatewayUsageRecorder,
    private readonly costPolicy: ProviderCostPolicy = new FreeOnlyProviderPolicy(),
  ) {}

  async execute(raw: unknown, scope: ProviderRequestScope): Promise<ProviderExecutionResult> {
    const input = GatewayRequestSchema.parse(raw);
    if (!scope.tenantId || !scope.projectId) throw new Error("PROVIDER_SCOPE_REQUIRED");
    const started = Date.now();

    const provider = await this.providers.findByKey(input.providerKey, scope);
    if (!provider) throw new Error("PROVIDER_NOT_FOUND");
    if (provider.status !== "ACTIVE") throw new Error("PROVIDER_NOT_ACTIVE");
    if (provider.healthStatus !== "AVAILABLE") throw new Error("PROVIDER_HEALTH_CHECK_REQUIRED");
    this.costPolicy.assertAllowed(provider);
    const adapter = this.adapters.get(provider);
    if (!adapter.supports(input.operation)) throw new Error("PROVIDER_OPERATION_UNSUPPORTED");
    const model = await this.providers.findModel(provider.id, input.modelKey, scope);
    if (!model || !model.enabled) throw new Error("MODEL_NOT_AVAILABLE");
    if (!model.privacyApproved) throw new Error("MODEL_PRIVACY_NOT_APPROVED");
    if (!isFreeModel(model)) throw new Error("MODEL_BLOCKED_BY_FREE_ONLY_POLICY");
    const requiredCapability: Record<string, string[]> = {
      CHAT: ["TEXT_GENERATION"],
      STRUCTURED: ["STRUCTURED_OUTPUT"],
      EMBEDDINGS: ["EMBEDDINGS"],
      IMAGE: ["IMAGE_GENERATION"],
      AUDIO: ["AUDIO", "AUDIO_INPUT", "AUDIO_OUTPUT", "SPEECH_TO_TEXT", "TEXT_TO_SPEECH"],
    };
    const acceptedCapabilities = requiredCapability[input.operation] ?? [];
    if (!acceptedCapabilities.some((capability) => model.capabilities.includes(capability))) {
      throw new Error("MODEL_CAPABILITY_MISMATCH");
    }
    const outputLimit = input.parameters.max_tokens ?? input.parameters.max_completion_tokens;
    if (typeof outputLimit === "number" && model.maxOutputTokens !== null && outputLimit > model.maxOutputTokens) {
      throw new Error("MODEL_OUTPUT_LIMIT_EXCEEDED");
    }

    const credential = await this.credentials.resolve(provider.secretReference, scope);

    const request: ProviderExecutionRequest = {
      model: input.modelKey,
      operation: input.operation,
      ...(input.messages
        ? { messages: input.messages.map((message) => ({
            role: message.role,
            content: message.content ?? null,
          })) }
        : {}),
      ...(input.input !== undefined ? { input: input.input } : {}),
      parameters: input.parameters,
      requestId: input.requestId,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), provider.timeoutMs);
    let result: ProviderExecutionResult;
    try {
      result = await adapter.execute(
        { ...request, signal: controller.signal },
        credential,
      );
    } catch (error) {
      const normalizedError = controller.signal.aborted
        ? new Error("PROVIDER_TIMEOUT")
        : error;
      await this.usage.record({
        scope,
        requestId: input.requestId,
        providerId: provider.id,
        providerKey: provider.key,
        modelKey: input.modelKey,
        operation: input.operation,
        ...(scope.taskId ? { taskId: scope.taskId } : {}),
        success: false,
        durationMs: Date.now() - started,
        errorCode: normalizedError instanceof Error
          ? normalizedError.message
          : "UNKNOWN_ERROR",
      });
      throw normalizedError;
    } finally {
      clearTimeout(timeout);
    }
    await this.usage.record({
      scope,
      requestId: input.requestId,
      providerId: provider.id,
      providerKey: provider.key,
      modelKey: input.modelKey,
      operation: input.operation,
      ...(scope.taskId ? { taskId: scope.taskId } : {}),
      success: true,
      durationMs: Date.now() - started,
      ...(result.usage ? { usage: result.usage } : {}),
    });
    return result;
  }
}

function isFreeModel(model: import("./provider.types").ProviderModelRecord) {
  return model.billingMode === "SELF_HOSTED" ||
    (model.billingMode === "FREE" && model.freeTierStatus === "VERIFIED_FREE");
}
