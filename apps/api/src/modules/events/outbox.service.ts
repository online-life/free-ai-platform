import { toPrismaJson } from "../../infrastructure/database/prisma-json";
import { withTenantTransaction } from "../../infrastructure/database/transaction";

export class OutboxService {
  async enqueue(input: {
    tenantId: string;
    projectId?: string;
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    payload: Record<string, unknown>;
  }) {
    // The legacy outbox project_id references UUID Project rows. Layer 02 workspace
    // IDs are CUIDs, so project identity stays in the versioned event payload.
    const projectId = input.projectId;
    return withTenantTransaction({ tenantId: input.tenantId, ...(projectId ? { projectId } : {}) }, (tx) => tx.outboxEvent.create({
      data: {
        tenantId: input.tenantId,
        projectId: projectId ?? null,
        eventType: input.eventType,
        payload: toPrismaJson({
          aggregateType: input.aggregateType,
          aggregateId: input.aggregateId,
          ...input.payload,
        }),
      },
    }));
  }

  async claimBatch(tenantId: string, batchSize = 20) {
    const limit = Math.max(1, Math.min(batchSize, 100));

    return withTenantTransaction({ tenantId }, async (tx) => {
      const events = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM outbox_events
        WHERE tenant_id = ${tenantId}::uuid
          AND status = 'PENDING'
          AND available_at <= NOW()
          AND (locked_at IS NULL OR locked_at < NOW() - INTERVAL '5 minutes')
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      `;

      if (events.length === 0) return [];

      const ids = events.map((event) => event.id);

      await tx.outboxEvent.updateMany({
        where: { id: { in: ids } },
        data: { lockedAt: new Date(), attempts: { increment: 1 } },
      });

      return tx.outboxEvent.findMany({
        where: { id: { in: ids } },
      });
    });
  }

  async markProcessed(id: string, scope: { tenantId: string; projectId?: string }) {
    return withTenantTransaction(scope, (tx) => tx.outboxEvent.updateMany({
      where: { id, tenantId: scope.tenantId, projectId: scope.projectId ?? null },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
        lockedAt: null,
      },
    }));
  }

  async markFailed(id: string, error: string, attempts: number, scope: { tenantId: string; projectId?: string }) {
    const terminal = attempts >= 10;
    const delaySeconds = Math.min(3600, 2 ** Math.min(attempts, 10));

    return withTenantTransaction(scope, (tx) => tx.outboxEvent.updateMany({
      where: { id, tenantId: scope.tenantId, projectId: scope.projectId ?? null },
      data: {
        status: terminal ? "DEAD" : "PENDING",
        lastError: error.slice(0, 2000),
        lockedAt: null,
        availableAt: new Date(Date.now() + delaySeconds * 1000),
      },
    }));
  }
}
