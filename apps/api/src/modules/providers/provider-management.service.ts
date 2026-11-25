import { withTenantTransaction } from "../../infrastructure/database/transaction";
import { toPrismaJson } from "../../infrastructure/database/prisma-json";
import { AuthorizationService } from "../authorization/authorization.service";
import { encryptSecret } from "../secrets/encryption";
import { isLocalProviderEndpoint, ProviderDefinitionSchema, ProviderModelDefinitionSchema, ProviderUpdateSchema } from "./provider.schemas";
import type { ProviderRecord, ProviderRequestScope } from "./provider.types";
import { ProviderAdapterRegistry } from "./provider-adapter.registry";
import { SecretVaultService } from "../secrets/secret-vault.service";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

export interface ProviderManagerActor extends ProviderRequestScope {
  userId: string;
}

export interface ModelAvailabilityPolicy {
  freeModelsEnabled: boolean;
  paidModelsEnabled: boolean;
  paidSpendingAuthorized: false;
}

const MODEL_POLICY_KEY = "ai.modelAvailabilityPolicy";
const DEFAULT_MODEL_POLICY: ModelAvailabilityPolicy = {
  freeModelsEnabled: false,
  paidModelsEnabled: false,
  // Paid execution remains blocked until a separate spending policy is approved.
  paidSpendingAuthorized: false,
};

export class ProviderManagementService {
  constructor(
    private readonly authorization = new AuthorizationService(),
    private readonly adapters = new ProviderAdapterRegistry(),
    private readonly credentials = new SecretVaultService(),
  ) {}

  async getModelAvailabilityPolicy(actor: ProviderManagerActor): Promise<ModelAvailabilityPolicy> {
    await this.authorize(actor, "provider.manage");
    const setting = await withTenantTransaction(actor, (tx) => tx.setting.findFirst({
      where: { tenantId: actor.tenantId, projectId: null, key: MODEL_POLICY_KEY },
      select: { value: true },
    }));
    const value = setting?.value;
    if (!value || typeof value !== "object" || Array.isArray(value)) return DEFAULT_MODEL_POLICY;
    const policy = value as Record<string, unknown>;
    return {
      freeModelsEnabled: policy.freeModelsEnabled === true,
      paidModelsEnabled: policy.paidModelsEnabled === true,
      paidSpendingAuthorized: false,
    };
  }

  async setModelAvailabilityPolicy(actor: ProviderManagerActor, raw: unknown): Promise<ModelAvailabilityPolicy> {
    await this.authorize(actor, "provider.manage");
    const input = z.object({
      freeModelsEnabled: z.boolean(),
      paidModelsEnabled: z.boolean(),
    }).strict().parse(raw);
    const value: ModelAvailabilityPolicy = { ...input, paidSpendingAuthorized: false };
    await withTenantTransaction(actor, async (tx) => {
      const existing = await tx.setting.findFirst({
        where: { tenantId: actor.tenantId, projectId: null, key: MODEL_POLICY_KEY },
        select: { id: true },
      });
      if (existing) {
        await tx.setting.update({ where: { id: existing.id }, data: { value: toPrismaJson(value) } });
      } else {
        await tx.setting.create({
          data: { tenantId: actor.tenantId, projectId: null, key: MODEL_POLICY_KEY, value: toPrismaJson(value) },
        });
      }
      await recordAudit(tx, actor, "MODEL_AVAILABILITY_POLICY_UPDATED", actor.tenantId, input);
    });
    return value;
  }

  async getPlatformModelPolicy(actor: ProviderManagerActor) {
    await this.authorize(actor, "platform.manage");
    const policy = await withTenantTransaction(actor, (tx) => tx.globalModelPolicy.findUnique({ where: { id: 1 } }));
    if (!policy) throw new Error("PLATFORM_MODEL_POLICY_MISSING");
    return {
      freeModelsEnabled: policy.freeModelsEnabled,
      paidModelsEnabled: policy.paidModelsEnabled,
      localModelsEnabled: policy.localModelsEnabled,
      customProvidersEnabled: policy.customProvidersEnabled,
      automaticDiscovery: policy.automaticDiscovery,
      automaticRefresh: policy.automaticRefresh,
      paidSpendingAuthorized: false as const,
      monthlyCostLimit: policy.monthlyCostLimit === null ? null : Number(policy.monthlyCostLimit),
    };
  }

  async setPlatformModelPolicy(actor: ProviderManagerActor, raw: unknown) {
    await this.authorize(actor, "platform.manage");
    const input = z.object({
      freeModelsEnabled: z.boolean(),
      paidModelsEnabled: z.boolean(),
      localModelsEnabled: z.boolean(),
      customProvidersEnabled: z.boolean(),
      automaticDiscovery: z.boolean(),
      automaticRefresh: z.boolean(),
      monthlyCostLimit: z.number().nonnegative().max(1_000_000).nullable(),
    }).strict().parse(raw);
    if (input.automaticRefresh && !input.automaticDiscovery) throw new Error("AUTOMATIC_REFRESH_REQUIRES_DISCOVERY");
    const policy = await withTenantTransaction(actor, async (tx) => {
      const updated = await tx.globalModelPolicy.update({
        where: { id: 1 },
        data: { ...input, paidSpendingAuthorized: false, updatedByUserId: actor.userId },
      });
      await recordAudit(tx, actor, "PLATFORM_MODEL_POLICY_UPDATED", "1", input);
      return updated;
    });
    return {
      freeModelsEnabled: policy.freeModelsEnabled,
      paidModelsEnabled: policy.paidModelsEnabled,
      localModelsEnabled: policy.localModelsEnabled,
      customProvidersEnabled: policy.customProvidersEnabled,
      automaticDiscovery: policy.automaticDiscovery,
      automaticRefresh: policy.automaticRefresh,
      paidSpendingAuthorized: false as const,
      monthlyCostLimit: policy.monthlyCostLimit === null ? null : Number(policy.monthlyCostLimit),
    };
  }

  async create(actor: ProviderManagerActor, raw: unknown) {
    await this.authorize(actor, "provider.manage");
    const input = ProviderDefinitionSchema.parse(raw);
    const globalPolicy = await withTenantTransaction(actor, (tx) => tx.globalModelPolicy.findUnique({ where: { id: 1 } }));
    if (!globalPolicy?.customProvidersEnabled) throw new Error("CUSTOM_PROVIDERS_DISABLED");
    if (isLocalProviderEndpoint(input.baseUrl) && !globalPolicy.localModelsEnabled) {
      throw new Error("LOCAL_MODELS_DISABLED");
    }
    if (input.authenticationType === "BEARER" && !input.apiKey) {
      throw new Error("PROVIDER_API_KEY_REQUIRED");
    }
    if (input.authenticationType === "NONE" && !input.providerType.startsWith("LOCAL_")) {
      throw new Error("ANONYMOUS_AUTH_LOCAL_ONLY");
    }
    const secret = input.apiKey ? encryptSecret(input.apiKey) : undefined;
    const { apiKey: _apiKey, metadata, customHeaders, pricingMetadata, privacyMetadata, ...definition } = input;

    return withTenantTransaction(actor, async (tx) => {
      const createdSecret = secret
        ? await tx.providerCredential.create({
            data: {
              tenantId: actor.tenantId,
              projectId: actor.projectId || null,
              scopeKey: actor.projectId || "_",
              name: `provider:${input.key}`,
              ...secret,
            },
            select: { id: true },
          })
        : undefined;
      const connection = await tx.providerConnection.create({
        data: {
          key: definition.key,
          displayName: definition.name,
          providerType: definition.providerType,
          tenantId: actor.tenantId,
          projectId: actor.projectId || null,
          scopeKey: actor.projectId || "_",
          baseUrl: definition.baseUrl,
          authenticationType: definition.authenticationType,
          ...(createdSecret ? { credentialId: createdSecret.id } : {}),
          ...(definition.apiVersion ? { apiVersion: definition.apiVersion } : {}),
          customHeaders: toPrismaJson(customHeaders),
          timeoutMs: definition.timeoutMs,
          maxRetries: definition.maxRetries,
          enabled: false,
          status: "DISABLED",
          billingMode: definition.billingMode,
          freeTierStatus: definition.freeTierStatus,
          metadata: toPrismaJson(metadata),
          pricingMetadata: toPrismaJson(pricingMetadata),
          privacyMetadata: toPrismaJson(privacyMetadata),
        },
        select: safeProviderSelect,
      });
      await recordAudit(tx, actor, "PROVIDER_CREATED", connection.id, { key: connection.key });
      return connection;
    });
  }

  async list(actor: ProviderManagerActor) {
    await this.authorize(actor, "provider.manage");
    return withTenantTransaction(actor, (tx) => tx.providerConnection.findMany({
      where: {
        OR: [
          { tenantId: actor.tenantId, projectId: actor.projectId || null },
          ...(actor.projectId ? [{ tenantId: actor.tenantId, projectId: null }] : []),
        ],
      },
      select: safeProviderSelect,
      orderBy: { updatedAt: "desc" },
    }));
  }

  async listModels(actor: ProviderManagerActor, providerId: string) {
    await this.authorize(actor, "provider.manage");
    return withTenantTransaction(actor, async (tx) => {
      const provider = await tx.providerConnection.findFirst({
        where: { id: providerId, tenantId: actor.tenantId, projectId: actor.projectId || null },
        select: { id: true },
      });
      if (!provider) throw new Error("PROVIDER_NOT_FOUND");
      return tx.providerModel.findMany({
        where: { providerId },
        select: {
          id: true,
          modelId: true,
          displayName: true,
          family: true,
          version: true,
          contextWindow: true,
          maxOutputTokens: true,
          inputModalities: true,
          outputModalities: true,
          capabilities: true,
          features: true,
          billingMode: true,
          freeTierStatus: true,
          inputPricePerMillion: true,
          outputPricePerMillion: true,
          rateLimits: true,
          lifecycle: true,
          availability: true,
          privacyApproved: true,
          officialDocumentationUrl: true,
          lastVerifiedAt: true,
          metadata: true,
          enabled: true,
          visible: true,
        },
        orderBy: { modelId: "asc" },
      });
    });
  }

  async update(actor: ProviderManagerActor, providerId: string, raw: unknown) {
    await this.authorize(actor, "provider.manage");
    const input = ProviderUpdateSchema.parse(raw);
    return withTenantTransaction(actor, async (tx) => {
      const existing = await tx.providerConnection.findFirst({
        where: { id: providerId, tenantId: actor.tenantId, projectId: actor.projectId || null },
        select: { id: true, providerType: true, baseUrl: true },
      });
      if (!existing) throw new Error("PROVIDER_NOT_FOUND");
      const nextProviderType = input.providerType ?? existing.providerType;
      const nextBaseUrl = input.baseUrl ?? existing.baseUrl;
      const localEndpoint = isLocalProviderEndpoint(nextBaseUrl);
      if (nextProviderType === "LOCAL_OPENAI_COMPATIBLE" && !localEndpoint) throw new Error("LOCAL_PROVIDER_ENDPOINT_REQUIRED");
      if (localEndpoint && nextProviderType !== "LOCAL_OPENAI_COMPATIBLE") throw new Error("LOCAL_PROVIDER_CONNECTOR_REQUIRED");
      if (localEndpoint) {
        const policy = await tx.globalModelPolicy.findUnique({ where: { id: 1 }, select: { localModelsEnabled: true } });
        if (!policy?.localModelsEnabled) throw new Error("LOCAL_MODELS_DISABLED");
      }
      const updated = await tx.providerConnection.update({
        where: { id: providerId },
        data: {
          ...(input.name !== undefined ? { displayName: input.name } : {}),
          ...(input.providerType !== undefined ? { providerType: input.providerType } : {}),
          ...(input.baseUrl !== undefined ? { baseUrl: input.baseUrl } : {}),
          ...(input.authenticationType !== undefined ? { authenticationType: input.authenticationType } : {}),
          ...(input.apiVersion !== undefined ? { apiVersion: input.apiVersion } : {}),
          ...(input.timeoutMs !== undefined ? { timeoutMs: input.timeoutMs } : {}),
          ...(input.maxRetries !== undefined ? { maxRetries: input.maxRetries } : {}),
          ...(input.billingMode !== undefined ? { billingMode: input.billingMode } : {}),
          ...(input.freeTierStatus !== undefined ? { freeTierStatus: input.freeTierStatus } : {}),
          ...(input.customHeaders !== undefined ? { customHeaders: toPrismaJson(input.customHeaders) } : {}),
          ...(input.metadata !== undefined ? { metadata: toPrismaJson(input.metadata) } : {}),
          ...(input.pricingMetadata !== undefined ? { pricingMetadata: toPrismaJson(input.pricingMetadata) } : {}),
          ...(input.privacyMetadata !== undefined ? { privacyMetadata: toPrismaJson(input.privacyMetadata) } : {}),
          enabled: false,
          status: "DISABLED",
          lastSuccessfulTest: null,
          lastErrorCode: null,
        },
        select: safeProviderSelect,
      });
      await tx.providerHealth.deleteMany({ where: { providerId } });
      await recordAudit(tx, actor, "PROVIDER_UPDATED", providerId, { fields: Object.keys(input) });
      return updated;
    });
  }

  async rotateKey(actor: ProviderManagerActor, providerId: string, apiKey: string) {
    await this.authorize(actor, "provider.manage");
    if (!apiKey || apiKey.length > 4096) throw new Error("PROVIDER_API_KEY_INVALID");
    const encrypted = encryptSecret(apiKey);
    return withTenantTransaction(actor, async (tx) => {
      const provider = await tx.providerConnection.findFirst({
        where: {
          id: providerId,
          tenantId: actor.tenantId,
          projectId: actor.projectId || null,
        },
        select: { id: true, key: true, credentialId: true },
      });
      if (!provider) throw new Error("PROVIDER_NOT_FOUND");
      const secret = provider.credentialId
        ? await tx.providerCredential.updateMany({
            where: {
              id: provider.credentialId,
              tenantId: actor.tenantId,
              scopeKey: actor.projectId || "_",
            },
            data: encrypted,
          })
        : null;
      let credentialId = provider.credentialId;
      if (!secret || secret.count !== 1) {
        const created = await tx.providerCredential.create({
          data: {
            tenantId: actor.tenantId,
            projectId: actor.projectId || null,
            scopeKey: actor.projectId || "_",
            name: `provider:${provider.key}`,
            ...encrypted,
          },
          select: { id: true },
        });
        credentialId = created.id;
      }
      const updated = await tx.providerConnection.update({
        where: { id: providerId },
        data: { credentialId, enabled: false, status: "DISABLED", lastSuccessfulTest: null },
        select: safeProviderSelect,
      });
      await recordAudit(tx, actor, "PROVIDER_CREDENTIAL_ROTATED", providerId, { key: provider.key });
      return updated;
    });
  }

  async revokeKey(actor: ProviderManagerActor, providerId: string) {
    await this.authorize(actor, "provider.manage");
    return withTenantTransaction(actor, async (tx) => {
      const provider = await tx.providerConnection.findFirst({
        where: { id: providerId, tenantId: actor.tenantId, projectId: actor.projectId || null },
        select: { id: true, key: true, credentialId: true },
      });
      if (!provider) throw new Error("PROVIDER_NOT_FOUND");
      await tx.providerConnection.update({
        where: { id: providerId },
        data: { credentialId: null, enabled: false, status: "DISABLED", lastSuccessfulTest: null },
        select: { id: true },
      });
      if (provider.credentialId) {
        const references = await tx.providerConnection.count({
          where: { credentialId: provider.credentialId },
        });
        if (references === 0) {
          await tx.providerCredential.deleteMany({
            where: {
              id: provider.credentialId,
              tenantId: actor.tenantId,
              scopeKey: actor.projectId || "_",
            },
          });
        }
      }
      await recordAudit(tx, actor, "PROVIDER_CREDENTIAL_REVOKED", providerId, { key: provider.key });
      return { providerId, credentialRevoked: true };
    });
  }

  async addModel(actor: ProviderManagerActor, providerId: string, raw: unknown) {
    await this.authorize(actor, "provider.manage");
    const input = ProviderModelDefinitionSchema.parse(raw);
    const provider = await withTenantTransaction(actor, (tx) => tx.providerConnection.findFirst({
      where: { id: providerId, tenantId: actor.tenantId, projectId: actor.projectId || null },
      select: { id: true },
    }));
    if (!provider) throw new Error("PROVIDER_NOT_FOUND");
    return withTenantTransaction(actor, async (tx) => {
      const model = await tx.providerModel.upsert({
      where: { providerId_modelId: { providerId, modelId: input.modelId } },
      create: {
        providerId,
        modelId: input.modelId,
        displayName: input.displayName,
        ...(input.family ? { family: input.family } : {}),
        ...(input.version ? { version: input.version } : {}),
        ...(input.contextWindow !== undefined ? { contextWindow: input.contextWindow } : {}),
        ...(input.maxOutputTokens !== undefined ? { maxOutputTokens: input.maxOutputTokens } : {}),
        inputModalities: input.inputModalities,
        outputModalities: input.outputModalities,
        capabilities: toPrismaJson(input.capabilities),
        features: toPrismaJson(input.features),
        billingMode: input.billingMode,
        freeTierStatus: input.freeTierStatus,
        ...(input.inputPricePerMillion !== undefined && input.inputPricePerMillion !== null
          ? { inputPricePerMillion: input.inputPricePerMillion }
          : {}),
        ...(input.outputPricePerMillion !== undefined && input.outputPricePerMillion !== null
          ? { outputPricePerMillion: input.outputPricePerMillion }
          : {}),
        privacyApproved: input.privacyApproved,
        ...(input.officialDocumentationUrl ? { officialDocumentationUrl: input.officialDocumentationUrl } : {}),
        metadata: toPrismaJson(input.metadata),
        enabled: false,
      },
      update: {
        displayName: input.displayName,
        ...(input.family ? { family: input.family } : {}),
        ...(input.version ? { version: input.version } : {}),
        ...(input.contextWindow !== undefined ? { contextWindow: input.contextWindow } : {}),
        ...(input.maxOutputTokens !== undefined ? { maxOutputTokens: input.maxOutputTokens } : {}),
        inputModalities: input.inputModalities,
        outputModalities: input.outputModalities,
        capabilities: toPrismaJson(input.capabilities),
        features: toPrismaJson(input.features),
        billingMode: input.billingMode,
        freeTierStatus: input.freeTierStatus,
        inputPricePerMillion: input.inputPricePerMillion ?? null,
        outputPricePerMillion: input.outputPricePerMillion ?? null,
        privacyApproved: input.privacyApproved,
        officialDocumentationUrl: input.officialDocumentationUrl ?? null,
        metadata: toPrismaJson(input.metadata),
        enabled: false,
      },
      select: {
        id: true, providerId: true, modelId: true, displayName: true,
        capabilities: true, enabled: true, billingMode: true, freeTierStatus: true,
      },
      });
      await recordAudit(tx, actor, "PROVIDER_MODEL_CONFIGURED", model.id, {
        providerId,
        modelId: model.modelId,
      });
      return model;
    });
  }

  async setEnabled(actor: ProviderManagerActor, providerId: string, enabled: boolean) {
    await this.authorize(actor, "provider.activate");
    const provider = await withTenantTransaction(actor, (tx) => tx.providerConnection.findFirst({
      where: { id: providerId, tenantId: actor.tenantId, projectId: actor.projectId || null },
      include: { healthChecks: { orderBy: { checkedAt: "desc" }, take: 1 } },
    }));
    if (!provider) throw new Error("PROVIDER_NOT_FOUND");
    if (enabled) {
      const latestHealth = provider.healthChecks[0];
      if (!latestHealth?.available || Date.now() - latestHealth.checkedAt.getTime() > 5 * 60_000) {
        throw new Error("PROVIDER_HEALTH_CHECK_REQUIRED");
      }
      const eligible = provider.billingMode === "SELF_HOSTED" ||
        (provider.billingMode === "FREE" && provider.freeTierStatus === "VERIFIED_FREE");
      if (provider.billingMode === "FREE_LIMITED" || provider.freeTierStatus === "VERIFIED_LIMITED") {
        throw new Error("PROVIDER_QUOTA_ENFORCEMENT_UNAVAILABLE");
      }
      if (!eligible) throw new Error("PROVIDER_BLOCKED_BY_FREE_ONLY_POLICY");
    }
    return withTenantTransaction(actor, async (tx) => {
      const updated = await tx.providerConnection.update({
        where: { id: providerId },
        data: { enabled, status: enabled ? "ACTIVE" : "DISABLED" },
        select: safeProviderSelect,
      });
      await recordAudit(tx, actor, enabled ? "PROVIDER_ENABLED" : "PROVIDER_DISABLED", providerId);
      return updated;
    });
  }

  async testConnection(actor: ProviderManagerActor, providerId: string) {
    await this.authorize(actor, "provider.manage");
    const provider = await withTenantTransaction(actor, (tx) => tx.providerConnection.findFirst({
      where: { id: providerId, tenantId: actor.tenantId, projectId: actor.projectId || null },
    }));
    if (!provider) throw new Error("PROVIDER_NOT_FOUND");
    const record: ProviderRecord = {
      id: provider.id,
      key: provider.key,
      name: provider.displayName,
      baseUrl: provider.baseUrl,
      status: "ACTIVE",
      billingMode: provider.billingMode as ProviderRecord["billingMode"],
      freeTierStatus: provider.freeTierStatus as ProviderRecord["freeTierStatus"],
      timeoutMs: provider.timeoutMs,
      secretReference: provider.credentialId
        ? `provider-secret:/${provider.tenantId}/${provider.scopeKey}/${provider.credentialId}`
        : "",
      providerType: provider.providerType,
      authenticationType: provider.authenticationType as ProviderRecord["authenticationType"],
      customHeaders: isStringRecord(provider.customHeaders) ? provider.customHeaders : {},
      healthStatus: "UNKNOWN",
    };
    const started = Date.now();
    let errorCode: string | undefined;
    let available = false;
    let discoveredModels: string[] = [];
    try {
      const credential = record.secretReference
        ? await this.credentials.resolve(record.secretReference, actor)
        : "";
      const adapter = this.adapters.get(record);
      if (!adapter.discoverModels) throw new Error("PROVIDER_MODEL_DISCOVERY_UNSUPPORTED");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), provider.timeoutMs);
      try {
        discoveredModels = (await adapter.discoverModels(credential, controller.signal))
          .filter((modelId) => modelId.length <= 160)
          .slice(0, 500);
        available = true;
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      errorCode = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
        ? error.message
        : "PROVIDER_CONNECTION_FAILED";
    }

    await withTenantTransaction(actor, async (tx) => {
      await tx.providerHealth.create({
        data: {
          providerId,
          available,
          latencyMs: Date.now() - started,
          ...(errorCode ? { errorCode } : {}),
        },
      });
      await tx.providerConnection.update({
        where: { id: providerId },
        data: {
          lastErrorCode: errorCode ?? null,
          ...(available ? { lastSuccessfulTest: new Date(), lastModelSync: new Date() } : {}),
        },
      });
      await recordAudit(tx, actor, "PROVIDER_CONNECTION_TESTED", providerId, {
        available,
        discoveredModelCount: discoveredModels.length,
        ...(errorCode ? { errorCode } : {}),
      });
      if (available) {
        for (const modelId of discoveredModels) {
          await tx.providerModel.upsert({
            where: { providerId_modelId: { providerId, modelId } },
            create: {
              providerId,
              modelId,
              displayName: modelId,
              capabilities: toPrismaJson([]),
              enabled: false,
              billingMode: "UNKNOWN",
              freeTierStatus: "UNKNOWN",
              availability: "UNKNOWN",
            },
            update: {},
          });
        }
      }
    });
    return {
      available,
      latencyMs: Date.now() - started,
      discoveredModels: discoveredModels.length,
      ...(errorCode ? { errorCode } : {}),
    };
  }

  async setModelEnabled(actor: ProviderManagerActor, providerId: string, modelId: string, enabled: boolean) {
    await this.authorize(actor, "provider.activate");
    const model = await withTenantTransaction(actor, (tx) => tx.providerModel.findFirst({
      where: {
        providerId,
        modelId,
        provider: { tenantId: actor.tenantId, projectId: actor.projectId || null, enabled: true, status: "ACTIVE" },
      },
      include: { provider: { include: { healthChecks: { orderBy: { checkedAt: "desc" }, take: 1 } } } },
    }));
    if (!model) throw new Error("MODEL_NOT_FOUND_IN_SCOPE");
    if (enabled) {
      const latestHealth = model.provider.healthChecks[0];
      if (!latestHealth?.available || Date.now() - latestHealth.checkedAt.getTime() > 5 * 60_000) {
        throw new Error("PROVIDER_HEALTH_CHECK_REQUIRED");
      }
      const freeVerified = model.billingMode === "SELF_HOSTED" ||
        (model.billingMode === "FREE" && model.freeTierStatus === "VERIFIED_FREE");
      if (model.billingMode === "FREE_LIMITED" || model.freeTierStatus === "VERIFIED_LIMITED") {
        throw new Error("MODEL_QUOTA_ENFORCEMENT_UNAVAILABLE");
      }
      if (!freeVerified) throw new Error("MODEL_BLOCKED_BY_FREE_ONLY_POLICY");
      const availableCapabilities = new Set([
        "TEXT_GENERATION", "REASONING", "CODE_GENERATION", "EMBEDDINGS", "STRUCTURED_OUTPUT",
      ]);
      const capabilities = Array.isArray(model.capabilities)
        ? model.capabilities.filter((value): value is string => typeof value === "string")
        : [];
      if (capabilities.some((capability) => !availableCapabilities.has(capability))) {
        throw new Error("MODEL_CAPABILITY_UNSUPPORTED_BY_ADAPTER");
      }
      if (!model.privacyApproved || !model.officialDocumentationUrl ||
          !Array.isArray(model.capabilities) || model.capabilities.length === 0 ||
          !model.contextWindow || !model.maxOutputTokens) {
        throw new Error("MODEL_VERIFICATION_REQUIRED");
      }
    }
    return withTenantTransaction(actor, async (tx) => {
      const updated = await tx.providerModel.update({
        where: { id: model.id },
        data: { enabled, availability: enabled ? "AVAILABLE" : "UNKNOWN", lastVerifiedAt: enabled ? new Date() : null },
        select: { id: true, modelId: true, enabled: true, availability: true, lastVerifiedAt: true },
      });
      await recordAudit(tx, actor, enabled ? "PROVIDER_MODEL_ENABLED" : "PROVIDER_MODEL_DISABLED", model.id, { providerId });
      return updated;
    });
  }

  async setModelVisibility(actor: ProviderManagerActor, providerId: string, modelId: string, visible: boolean) {
    await this.authorize(actor, "provider.manage");
    const model = await withTenantTransaction(actor, (tx) => tx.providerModel.findFirst({
      where: { providerId, modelId, provider: { tenantId: actor.tenantId, projectId: actor.projectId || null } },
      select: { id: true },
    }));
    if (!model) throw new Error("MODEL_NOT_FOUND_IN_SCOPE");
    return withTenantTransaction(actor, async (tx) => {
      const updated = await tx.providerModel.update({
        where: { id: model.id },
        data: { visible },
        select: { id: true, modelId: true, visible: true },
      });
      await recordAudit(tx, actor, visible ? "PROVIDER_MODEL_SHOWN" : "PROVIDER_MODEL_HIDDEN", model.id, { providerId });
      return updated;
    });
  }

  private async authorize(actor: ProviderManagerActor, permission: string) {
    await this.authorization.assertPermission(actor.tenantId, actor.userId, permission);
    if (actor.projectId) {
      const member = await withTenantTransaction(actor, (tx) => tx.projectMember.findFirst({
          where: { tenantId: actor.tenantId, projectId: actor.projectId, userId: actor.userId },
          select: { role: true },
        }));
      if (!member || !["OWNER", "MANAGER"].includes(member.role)) {
        throw new Error("PROJECT_PROVIDER_PERMISSION_DENIED");
      }
    }
  }
}

const safeProviderSelect = {
  id: true,
  key: true,
  displayName: true,
  providerType: true,
  baseUrl: true,
  authenticationType: true,
  apiVersion: true,
  timeoutMs: true,
  maxRetries: true,
  enabled: true,
  status: true,
  billingMode: true,
  freeTierStatus: true,
  pricingMetadata: true,
  privacyMetadata: true,
  metadata: true,
  lastSuccessfulTest: true,
  lastErrorCode: true,
  lastModelSync: true,
  createdAt: true,
  updatedAt: true,
} as const;

function isStringRecord(value: unknown): value is Record<string, string> {
  return typeof value === "object" && value !== null && !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === "string");
}

async function recordAudit(
  tx: Prisma.TransactionClient,
  actor: ProviderManagerActor,
  action: string,
  resourceId: string,
  metadata: Record<string, unknown> = {},
) {
  await tx.auditLog.create({
    data: {
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      action,
      resourceType: "ProviderConfiguration",
      resourceId,
      correlationId: randomUUID(),
      metadata: toPrismaJson({ ...metadata, projectId: actor.projectId || null }),
    },
    select: { id: true },
  });
}
