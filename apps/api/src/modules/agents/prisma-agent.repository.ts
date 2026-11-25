import type { AgentCapability as PrismaAgentCapability, Prisma } from "@prisma/client";
import { withProjectTransaction } from "../projects/project-scope";
import type { ProjectActor } from "../projects/project.service";
import { assertProjectPermission } from "../projects/project.permissions";
import { withTenantTransaction } from "../../infrastructure/database/transaction";
import { toPrismaJson } from "../../infrastructure/database/prisma-json";
import type { AgentDefinition } from "./agent.schemas";
import { AgentCapabilitySchema } from "./agent.schemas";
import type { AgentEvaluationInput, AgentEvaluationRepository } from "./agent-evaluation.service";
import type { AgentRecord, AgentRepository, AgentVersionRecord } from "./agent.types";

export class PrismaAgentRepository implements AgentRepository, AgentEvaluationRepository {
  async findByKey(tenantId: string, key: string): Promise<AgentRecord | null> {
    const row = await withTenantTransaction({ tenantId }, (tx) => tx.agent.findFirst({ where: { tenantId, key } }));
    return row ? mapAgent(row) : null;
  }

  async findById(tenantId: string, id: string): Promise<AgentRecord | null> {
    const row = await withTenantTransaction({ tenantId }, (tx) => tx.agent.findFirst({ where: { tenantId, id } }));
    return row ? mapAgent(row) : null;
  }

  async create(tenantId: string, actorId: string, definition: AgentDefinition): Promise<AgentRecord> {
    return withTenantTransaction({ tenantId, userId: actorId }, async (tx) => {
      const agent = await tx.agent.create({
        data: {
          tenantId, key: definition.key, name: definition.name,
          description: definition.description, createdById: actorId,
          versions: { create: { version: "1.0.0", definition: toPrismaJson(definition), createdById: actorId } },
        },
      });
      await writeAudit(tx, tenantId, actorId, "AGENT_CREATED", agent.id, { key: agent.key, version: "1.0.0" });
      return mapAgent(agent);
    });
  }

  async createVersion(tenantId: string, actorId: string, agentId: string, version: string, definition: AgentDefinition, changelog: string): Promise<AgentVersionRecord> {
    return withTenantTransaction({ tenantId, userId: actorId }, async (tx) => {
      const agent = await tx.agent.findFirst({ where: { tenantId, id: agentId }, select: { id: true, createdById: true } });
      if (!agent) throw new Error("AGENT_NOT_FOUND");
      const created = await tx.agentVersion.create({
        data: { tenantId, agentId, version, definition: toPrismaJson(definition), changelog, createdById: actorId },
      });
      await tx.agent.update({ where: { id: agentId }, data: { currentVersion: version, status: "DRAFT" } });
      await writeAudit(tx, tenantId, actorId, "AGENT_VERSION_CREATED", agentId, { version });
      return mapVersion(created);
    });
  }

  async activate(tenantId: string, agentId: string, version: string, actorId: string): Promise<void> {
    await withTenantTransaction({ tenantId, userId: actorId }, async (tx) => {
      const candidate = await tx.agentVersion.findFirst({ where: { tenantId, agentId, version }, select: { id: true } });
      if (!candidate) throw new Error("AGENT_VERSION_NOT_FOUND");
      const passingEvaluations = await tx.agentEvaluation.count({ where: { tenantId, agentId, version, passed: true, score: { gte: 80 } } });
      if (passingEvaluations === 0) throw new Error("AGENT_VERSION_EVALUATION_REQUIRED");
      await tx.agent.update({ where: { id: agentId }, data: { currentVersion: version, status: "ACTIVE" } });
      await writeAudit(tx, tenantId, actorId, "AGENT_ACTIVATED", agentId, { version });
    });
  }

  async setStatus(tenantId: string, agentId: string, actorId: string, status: "DISABLED" | "ARCHIVED"): Promise<void> {
    await withTenantTransaction({ tenantId, userId: actorId }, async (tx) => {
      const changed = await tx.agent.updateMany({ where: { tenantId, id: agentId }, data: { status } });
      if (changed.count !== 1) throw new Error("AGENT_NOT_FOUND");
      await writeAudit(tx, tenantId, actorId, `AGENT_${status}`, agentId, {});
    });
  }

  async list(tenantId: string): Promise<AgentRecord[]> {
    const rows = await withTenantTransaction({ tenantId }, (tx) => tx.agent.findMany({ where: { tenantId }, orderBy: [{ updatedAt: "desc" }, { key: "asc" }] }));
    return rows.map(mapAgent);
  }

  async listCandidates(tenantId: string) {
    return withTenantTransaction({ tenantId }, async (tx) => {
      const currentAgents = await tx.agent.findMany({ where: { tenantId }, orderBy: { key: "asc" } });
      const candidates = await Promise.all(currentAgents.map(async (agent) => {
        const version = await tx.agentVersion.findFirst({ where: { tenantId, agentId: agent.id, version: agent.currentVersion }, select: { definition: true } });
        const evaluations = await tx.agentEvaluation.findMany({ where: { tenantId, agentId: agent.id, version: agent.currentVersion }, select: { score: true }, take: 100 });
        const definition = version?.definition && typeof version.definition === "object" && !Array.isArray(version.definition)
          ? version.definition as Prisma.JsonObject
          : {};
        const capabilities = Array.isArray(definition.capabilities)
          ? definition.capabilities.flatMap((item) => { const parsed = AgentCapabilitySchema.safeParse(item); return parsed.success ? [parsed.data] : []; })
          : [];
        const qualityScore = evaluations.length ? evaluations.reduce((sum, item) => sum + item.score, 0) / evaluations.length : 0;
        return { id: agent.id, key: agent.key, capabilities, status: agent.status, qualityScore };
      }));
      return candidates;
    });
  }

  async save(tenantId: string, input: AgentEvaluationInput): Promise<unknown> {
    return withTenantTransaction({ tenantId, ...(input.evaluatedById ? { userId: input.evaluatedById } : {}) }, async (tx) => {
      const agent = await tx.agent.findFirst({ where: { tenantId, id: input.agentId }, select: { id: true, createdById: true } });
      const version = await tx.agentVersion.findFirst({ where: { tenantId, agentId: input.agentId, version: input.version }, select: { id: true } });
      if (!agent || !version) throw new Error("AGENT_VERSION_NOT_FOUND");
      const evaluation = await tx.agentEvaluation.create({
        data: {
          tenantId, agentId: input.agentId, version: input.version,
          testCaseId: input.testCaseId, score: input.score, passed: input.passed,
          durationMs: Math.trunc(input.durationMs), metrics: toPrismaJson(input.metrics ?? {}),
          ...(input.notes ? { notes: input.notes } : {}),
          ...(input.evaluatedById ? { evaluatedById: input.evaluatedById } : {}),
        },
      });
      await writeAudit(tx, tenantId, input.evaluatedById ?? agent.createdById, "AGENT_EVALUATED", input.agentId, { version: input.version, testCaseId: input.testCaseId, score: input.score, passed: input.passed });
      return evaluation;
    });
  }

  async history(tenantId: string, agentId: string): Promise<unknown[]> {
    return withTenantTransaction({ tenantId }, (tx) => tx.agentEvaluation.findMany({
      where: { tenantId, agentId }, orderBy: { createdAt: "desc" }, take: 200,
    }));
  }
}

export class PrismaAgentMemoryRepository {
  async list(actor: ProjectActor, projectId: string, agentId: string) {
    return withProjectTransaction(actor, projectId, async (tx) => {
      await requireProjectMember(tx, actor, projectId, false);
      const agent = await tx.agent.findFirst({ where: { tenantId: actor.tenantId, id: agentId, status: "ACTIVE" }, select: { id: true } });
      if (!agent) throw new Error("AGENT_NOT_AVAILABLE");
      return tx.agentMemoryEntry.findMany({ where: { tenantId: actor.tenantId, projectId, agentId }, orderBy: { updatedAt: "desc" } });
    });
  }

  async upsert(actor: ProjectActor, projectId: string, agentId: string, key: string, value: unknown) {
    return withProjectTransaction(actor, projectId, async (tx) => {
      await requireProjectMember(tx, actor, projectId, true);
      const agent = await tx.agent.findFirst({ where: { tenantId: actor.tenantId, id: agentId, status: "ACTIVE" }, select: { id: true } });
      if (!agent) throw new Error("AGENT_NOT_AVAILABLE");
      const memory = await tx.agentMemoryEntry.upsert({
        where: { tenantId_projectId_agentId_key: { tenantId: actor.tenantId, projectId, agentId, key } },
        create: { tenantId: actor.tenantId, projectId, agentId, key, value: toPrismaJson(value), createdById: actor.userId },
        update: { value: toPrismaJson(value), version: { increment: 1 } },
      });
      await writeAudit(tx, actor.tenantId, actor.userId, "AGENT_PROJECT_MEMORY_UPDATED", memory.id, { projectId, agentId, key });
      return memory;
    });
  }
}

async function requireProjectMember(tx: Prisma.TransactionClient, actor: ProjectActor, projectId: string, write: boolean) {
  const member = await tx.projectMember.findFirst({ where: { tenantId: actor.tenantId, projectId, userId: actor.userId } });
  if (!member) throw new Error("PROJECT_ACCESS_DENIED");
  if (write) assertProjectPermission(member.role, "context.manage");
  return member;
}

async function writeAudit(tx: Prisma.TransactionClient, tenantId: string, actorId: string, action: string, resourceId: string, metadata: Record<string, unknown>) {
  await tx.auditLog.create({ data: { tenantId, actorUserId: actorId, action, resourceType: "Agent", resourceId, correlationId: `${action.toLowerCase()}:${resourceId}:${Date.now()}`, metadata: toPrismaJson(metadata) } });
}

function mapAgent(row: { id: string; tenantId: string; key: string; name: string; description: string; status: string; currentVersion: string; createdAt: Date; updatedAt: Date }): AgentRecord {
  return { ...row, status: row.status as AgentRecord["status"] };
}

function mapVersion(row: { id: string; tenantId: string; agentId: string; version: string; definition: Prisma.JsonValue; changelog: string; createdAt: Date }): AgentVersionRecord {
  return { ...row, definition: row.definition as unknown as AgentDefinition };
}

export type StoredAgentCapability = PrismaAgentCapability;
