import { withTenantTransaction } from "../../infrastructure/database/transaction";
import type { ProviderConnection, ProviderHealth } from "@prisma/client";
import type {
  ProviderRecord,
  ProviderRepository,
  ProviderRequestScope,
} from "./provider.types";

export class PrismaProviderRepository implements ProviderRepository {
  async findByKey(key: string, scope: ProviderRequestScope): Promise<ProviderRecord | null> {
    const candidates = [
      { tenantId: scope.tenantId, projectId: scope.projectId },
      { tenantId: scope.tenantId, projectId: null },
    ];
    for (const owner of candidates) {
      const row = await withTenantTransaction(scope, (tx) => tx.providerConnection.findFirst({
        where: { key, ...owner },
        include: { healthChecks: { orderBy: { checkedAt: "desc" }, take: 1 } },
      }));
      if (row) return toProviderRecord(row);
    }
    return null;
  }

  async listActive(scope: ProviderRequestScope): Promise<ProviderRecord[]> {
    const rows = await withTenantTransaction(scope, (tx) => tx.providerConnection.findMany({
        where: {
          enabled: true,
          status: "ACTIVE",
          OR: [
            { tenantId: scope.tenantId, projectId: scope.projectId },
            { tenantId: scope.tenantId, projectId: null },
          ],
        },
        orderBy: [{ projectId: "desc" }, { updatedAt: "desc" }],
        include: { healthChecks: { orderBy: { checkedAt: "desc" }, take: 1 } },
      }));
    return rows.map(toProviderRecord);
  }

  async findModel(providerId: string, modelId: string, scope: ProviderRequestScope) {
    const model = await withTenantTransaction(scope, (tx) => tx.providerModel.findFirst({
      where: {
        providerId,
        modelId,
        provider: {
          OR: [
            { tenantId: scope.tenantId, projectId: scope.projectId },
            { tenantId: scope.tenantId, projectId: null },
          ],
        },
      },
      select: {
        modelId: true,
        capabilities: true,
        enabled: true,
        privacyApproved: true,
        billingMode: true,
        freeTierStatus: true,
        contextWindow: true,
        maxOutputTokens: true,
      },
    }));
    if (!model) return null;
    return {
      ...model,
      capabilities: Array.isArray(model.capabilities)
        ? model.capabilities.filter((value): value is string => typeof value === "string")
        : [],
      billingMode: model.billingMode as ProviderRecord["billingMode"],
      freeTierStatus: model.freeTierStatus as ProviderRecord["freeTierStatus"],
    };
  }
}

function toProviderRecord(row: ProviderConnection & { healthChecks: ProviderHealth[] }): ProviderRecord {
  const health = row.healthChecks[0];
  const healthStatus = !health || Date.now() - health.checkedAt.getTime() > 5 * 60_000
    ? "UNKNOWN"
    : health.available ? "AVAILABLE" : "UNAVAILABLE";
  return {
    id: row.id,
    key: row.key,
    name: row.displayName,
    baseUrl: row.baseUrl,
    status: row.enabled ? row.status as ProviderRecord["status"] : "DISABLED",
    billingMode: row.billingMode as ProviderRecord["billingMode"],
    freeTierStatus: row.freeTierStatus as ProviderRecord["freeTierStatus"],
    timeoutMs: row.timeoutMs,
    providerType: row.providerType,
    secretReference: row.credentialId
      ? `provider-secret:/${row.tenantId}/${row.scopeKey}/${row.credentialId}`
      : "",
    authenticationType: row.authenticationType as ProviderRecord["authenticationType"],
    customHeaders: isStringRecord(row.customHeaders) ? row.customHeaders : {},
    healthStatus,
  };
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return typeof value === "object" && value !== null && !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === "string");
}
