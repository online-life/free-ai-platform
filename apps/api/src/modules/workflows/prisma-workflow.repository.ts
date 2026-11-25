import type { Prisma } from "@prisma/client";
import { withProjectTransaction } from "../projects/project-scope";
import type { ProjectActor } from "../projects/project.service";
import { withTenantTransaction } from "../../infrastructure/database/transaction";
import { toPrismaJson } from "../../infrastructure/database/prisma-json";
import type { WorkflowDefinition } from "./workflow.schemas";
import type { WorkflowRecord, WorkflowRepository, WorkflowRunRecord } from "./workflow.types";
import type { ApprovalRepository } from "./workflow-approval.service";

export class PrismaWorkflowRepository implements WorkflowRepository {
  async findWorkflow(tenantId: string, workflowId: string, projectId?: string): Promise<WorkflowRecord | null> {
    const scope = projectId ? { tenantId, projectId } : { tenantId };
    return withTenantTransaction(scope, async (tx) => {
      const row = await tx.workflow.findFirst({
        where: { tenantId, id: workflowId, ...(projectId ? { OR: [{ projectId }, { projectId: null }] } : {}) },
        orderBy: { projectId: "desc" }, include: { versions: true },
      });
      if (!row) return null;
      const version = row.versions.find((item) => item.version === row.currentVersion);
      if (!version) throw new Error("WORKFLOW_VERSION_MISSING");
      return { id: row.id, tenantId: row.tenantId, key: row.key, version: row.currentVersion, status: row.status, projectId: row.projectId, definition: version.definition as unknown as WorkflowDefinition };
    });
  }

  async listWorkflows(tenantId: string, projectId: string) {
    return withTenantTransaction({ tenantId, projectId }, async (tx) => {
      const rows = await tx.workflow.findMany({ where: { tenantId, OR: [{ projectId }, { projectId: null }] }, include: { versions: true }, orderBy: [{ projectId: "desc" }, { key: "asc" }] });
      return rows.flatMap((row) => {
        const version = row.versions.find((item) => item.version === row.currentVersion);
        return version ? [{ id: row.id, tenantId: row.tenantId, key: row.key, version: row.currentVersion, status: row.status, projectId: row.projectId, definition: version.definition as unknown as WorkflowDefinition }] : [];
      });
    });
  }

  async createWorkflow(tenantId: string, actorId: string, definition: WorkflowDefinition, projectId?: string): Promise<WorkflowRecord> {
    const scope = { tenantId, userId: actorId, ...(projectId ? { projectId } : {}) };
    return withTenantTransaction(scope, async (tx) => {
      const workflow = await tx.workflow.create({
        data: { tenantId, ...(projectId ? { projectId, scopeKey: projectId } : {}), key: definition.key, name: definition.name, status: "DRAFT", currentVersion: definition.version, createdById: actorId },
      });
      await tx.workflowVersion.create({ data: { tenantId, workflowId: workflow.id, version: definition.version, definition: toPrismaJson(definition), createdById: actorId } });
      await audit(tx, tenantId, actorId, "WORKFLOW_CREATED", workflow.id, { projectId, version: definition.version });
      return { id: workflow.id, tenantId, key: workflow.key, version: definition.version, status: workflow.status, projectId: workflow.projectId, definition };
    });
  }

  async createVersion(tenantId: string, actorId: string, workflowId: string, definition: WorkflowDefinition, projectId?: string): Promise<WorkflowRecord> {
    const scope = { tenantId, userId: actorId, ...(projectId ? { projectId } : {}) };
    return withTenantTransaction(scope, async (tx) => {
      const workflow = await tx.workflow.findFirst({ where: { tenantId, id: workflowId, ...(projectId ? { OR: [{ projectId }, { projectId: null }] } : {}) } });
      if (!workflow) throw new Error("WORKFLOW_NOT_FOUND");
      if (workflow.key !== definition.key) throw new Error("WORKFLOW_KEY_IMMUTABLE");
      const version = await tx.workflowVersion.create({ data: { tenantId, workflowId, version: definition.version, definition: toPrismaJson(definition), createdById: actorId } });
      await tx.workflow.update({ where: { id: workflowId }, data: { currentVersion: version.version, name: definition.name, status: "DRAFT" } });
      await audit(tx, tenantId, actorId, "WORKFLOW_VERSION_CREATED", workflowId, { version: version.version });
      return { id: workflowId, tenantId, key: workflow.key, version: version.version, status: "DRAFT", projectId: workflow.projectId, definition };
    });
  }

  async setStatus(tenantId: string, actorId: string, workflowId: string, status: "ACTIVE" | "DISABLED" | "ARCHIVED", projectId?: string): Promise<void> {
    const scope = { tenantId, userId: actorId, ...(projectId ? { projectId } : {}) };
    await withTenantTransaction(scope, async (tx) => {
      const result = await tx.workflow.updateMany({ where: { tenantId, id: workflowId, ...(projectId ? { OR: [{ projectId }, { projectId: null }] } : {}) }, data: { status } });
      if (result.count !== 1) throw new Error("WORKFLOW_NOT_FOUND");
      await audit(tx, tenantId, actorId, `WORKFLOW_${status}`, workflowId, { projectId });
    });
  }

  async createRun(input: { tenantId: string; workflowId: string; projectId: string; requestedById: string; idempotencyKey: string; input: unknown }): Promise<WorkflowRunRecord> {
    return withTenantTransaction({ tenantId: input.tenantId, projectId: input.projectId, userId: input.requestedById }, async (tx) => {
      const existing = await tx.workflowRun.findFirst({ where: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey } });
      if (existing) {
        if (existing.projectId !== input.projectId || existing.workflowId !== input.workflowId) throw new Error("IDEMPOTENCY_KEY_SCOPE_MISMATCH");
        return mapRun(existing);
      }
      const workflow = await tx.workflow.findFirst({ where: { tenantId: input.tenantId, id: input.workflowId, status: "ACTIVE", OR: [{ projectId: input.projectId }, { projectId: null }] } });
      if (!workflow) throw new Error("WORKFLOW_NOT_AVAILABLE");
      const run = await tx.workflowRun.create({ data: { tenantId: input.tenantId, workflowId: input.workflowId, workflowVersion: workflow.currentVersion, projectId: input.projectId, requestedById: input.requestedById, idempotencyKey: input.idempotencyKey, state: toPrismaJson({ input: input.input, completedSteps: [], stepAttempts: {} }) } });
      await trace(tx, input.tenantId, run.id, "RUN_CREATED", { workflowId: input.workflowId });
      return mapRun(run);
    });
  }

  async findRun(tenantId: string, runId: string, projectId: string): Promise<WorkflowRunRecord | null> {
    const row = await withTenantTransaction({ tenantId, projectId }, (tx) => tx.workflowRun.findFirst({ where: { tenantId, id: runId, projectId } }));
    return row ? mapRun(row) : null;
  }

  async updateRun(tenantId: string, runId: string, projectId: string, update: Partial<WorkflowRunRecord>): Promise<void> {
    await withTenantTransaction({ tenantId, projectId }, async (tx) => {
      const data: Prisma.WorkflowRunUpdateManyMutationInput = {
        ...(update.status !== undefined ? { status: update.status } : {}),
        ...(update.currentStepId !== undefined ? { currentStepId: update.currentStepId } : {}),
        ...(update.state !== undefined ? { state: toPrismaJson(update.state) } : {}),
        ...(update.status === "RUNNING" ? { startedAt: new Date() } : {}),
        ...(update.status === "SUCCEEDED" || update.status === "FAILED" || update.status === "CANCELLED" ? { completedAt: new Date() } : {}),
      };
      const changed = await tx.workflowRun.updateMany({ where: { tenantId, id: runId, projectId }, data });
      if (changed.count !== 1) throw new Error("WORKFLOW_RUN_NOT_FOUND");
      const metadata: Record<string, unknown> = {};
      if (update.status) metadata.status = update.status;
      if (update.currentStepId !== undefined) metadata.stepId = update.currentStepId;
      await trace(tx, tenantId, runId, update.status ? `RUN_${update.status}` : "RUN_STATE_UPDATED", metadata, update.currentStepId ?? undefined);
    });
  }

  async createApproval(input: { tenantId: string; projectId: string; runId: string; stepId: string; requestedById: string }) {
    return withTenantTransaction({ tenantId: input.tenantId, projectId: input.projectId, userId: input.requestedById }, async (tx) => {
      const run = await tx.workflowRun.findFirst({ where: { tenantId: input.tenantId, projectId: input.projectId, id: input.runId }, select: { id: true } });
      if (!run) throw new Error("WORKFLOW_RUN_NOT_FOUND");
      return tx.workflowApproval.upsert({
        where: { tenantId_runId_stepId: { tenantId: input.tenantId, runId: input.runId, stepId: input.stepId } },
        create: { tenantId: input.tenantId, runId: input.runId, stepId: input.stepId, requestedById: input.requestedById },
        update: {},
      });
    });
  }

  async findApprovalForStep(tenantId: string, projectId: string, runId: string, stepId: string) {
    return withTenantTransaction({ tenantId, projectId }, (tx) => tx.workflowApproval.findFirst({ where: { tenantId, runId, stepId } }));
  }

  async findApproval(tenantId: string, projectId: string, approvalId: string) {
    return withTenantTransaction({ tenantId, projectId }, (tx) => tx.workflowApproval.findFirst({ where: { tenantId, id: approvalId } }));
  }

  async decideApproval(input: { tenantId: string; projectId: string; approvalId: string; actorId: string; decision: "APPROVED" | "REJECTED"; comment?: string }) {
    return withTenantTransaction({ tenantId: input.tenantId, projectId: input.projectId, userId: input.actorId }, async (tx) => {
      const approval = await tx.workflowApproval.findFirst({ where: { tenantId: input.tenantId, id: input.approvalId, status: "PENDING" } });
      if (!approval) throw new Error("APPROVAL_ALREADY_DECIDED");
      const changed = await tx.workflowApproval.updateMany({
        where: { tenantId: input.tenantId, id: input.approvalId, status: "PENDING" },
        data: { status: input.decision, decision: input.decision, decidedById: input.actorId, decidedAt: new Date(), ...(input.comment !== undefined ? { comment: input.comment } : {}) },
      });
      if (changed.count !== 1) throw new Error("APPROVAL_ALREADY_DECIDED");
      await tx.workflowRun.update({ where: { id: approval.runId }, data: { status: input.decision === "APPROVED" ? "PENDING" : "FAILED", ...(input.decision === "REJECTED" ? { completedAt: new Date() } : {}) } });
      await trace(tx, input.tenantId, approval.runId, `APPROVAL_${input.decision}`, { approvalId: approval.id, actorId: input.actorId }, approval.stepId);
      await audit(tx, input.tenantId, input.actorId, `WORKFLOW_APPROVAL_${input.decision}`, input.approvalId, { runId: approval.runId, projectId: input.projectId });
      return { approvalId: approval.id, runId: approval.runId, stepId: approval.stepId, status: input.decision };
    });
  }

  async listApprovals(tenantId: string, projectId: string, runId: string) {
    return withTenantTransaction({ tenantId, projectId }, (tx) => tx.workflowApproval.findMany({ where: { tenantId, runId }, orderBy: { requestedAt: "asc" } }));
  }

  async listTraces(tenantId: string, projectId: string, runId: string) {
    return withTenantTransaction({ tenantId, projectId }, (tx) => tx.workflowTrace.findMany({ where: { tenantId, runId }, orderBy: { createdAt: "asc" }, take: 1000 }));
  }
}

export class PrismaWorkflowApprovalRepository implements ApprovalRepository {
  constructor(private readonly repository: PrismaWorkflowRepository) {}
  async create(input: { tenantId: string; projectId: string; runId: string; stepId: string; requestedById: string }) {
    const row = await this.repository.createApproval(input);
    return { id: row.id };
  }
  async find(tenantId: string, projectId: string, approvalId: string) {
    const row = await this.repository.findApproval(tenantId, projectId, approvalId);
    return row ? { id: row.id, runId: row.runId, stepId: row.stepId, status: row.status } : null;
  }
  async findForStep(tenantId: string, projectId: string, runId: string, stepId: string) {
    const row = await this.repository.findApprovalForStep(tenantId, projectId, runId, stepId);
    return row ? { id: row.id, status: row.status } : null;
  }
  async decide(tenantId: string, projectId: string, approvalId: string, actorId: string, decision: "APPROVED" | "REJECTED", comment?: string) {
    await this.repository.decideApproval({ tenantId, projectId, approvalId, actorId, decision, ...(comment !== undefined ? { comment } : {}) });
  }
}

export class PersistedWorkflowStepExecutor {
  constructor(private readonly repository: PrismaWorkflowRepository) {}

  async execute(input: { tenantId: string; runId: string; stepId: string; projectId: string; requestedById: string; type: string; config: Record<string, unknown>; state: Record<string, unknown>; timeoutMs: number; signal: AbortSignal }) {
    if (input.type === "APPROVAL") {
      const approval = await this.repository.findApprovalForStep(input.tenantId, input.projectId, input.runId, input.stepId);
      if (approval?.status === "APPROVED") return { output: { approved: true } };
      if (approval?.status === "REJECTED") throw new Error("WORKFLOW_APPROVAL_REJECTED");
      await this.repository.createApproval({ tenantId: input.tenantId, projectId: input.projectId, runId: input.runId, stepId: input.stepId, requestedById: input.requestedById });
      return { waitingApproval: true };
    }
    if (input.type === "CONDITION") {
      const stateKey = input.config.stateKey;
      if (typeof stateKey !== "string") throw new Error("WORKFLOW_CONDITION_CONFIG_INVALID");
      return { output: { matched: Object.is(input.state[stateKey], input.config.equals) } };
    }
    if (input.type === "WAIT") {
      const waitMs = input.config.waitMs;
      if (!Number.isSafeInteger(waitMs) || (waitMs as number) < 0 || (waitMs as number) > Math.min(60_000, input.timeoutMs)) throw new Error("WORKFLOW_WAIT_LIMIT_INVALID");
      await abortableDelay(waitMs as number, input.signal);
      return { output: { waitedMs: waitMs } };
    }
    throw new Error("WORKFLOW_STEP_NOT_CONNECTED");
  }
}

function abortableDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(new Error("WORKFLOW_STEP_CANCELLED"));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, milliseconds);
    const onAbort = () => { clearTimeout(timer); reject(new Error("WORKFLOW_STEP_CANCELLED")); };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function mapRun(row: { id: string; tenantId: string; workflowId: string; projectId: string; status: string; currentStepId: string | null; state: Prisma.JsonValue }): WorkflowRunRecord {
  const state = row.state && typeof row.state === "object" && !Array.isArray(row.state) ? row.state as Record<string, unknown> : {};
  return { id: row.id, tenantId: row.tenantId, workflowId: row.workflowId, projectId: row.projectId, status: row.status, currentStepId: row.currentStepId, state };
}

async function trace(tx: Prisma.TransactionClient, tenantId: string, runId: string, event: string, metadata: Record<string, unknown>, stepId?: string) {
  await tx.workflowTrace.create({ data: { tenantId, runId, event, ...(stepId ? { stepId } : {}), metadata: toPrismaJson(metadata) } });
}

async function audit(tx: Prisma.TransactionClient, tenantId: string, actorId: string, action: string, resourceId: string, metadata: Record<string, unknown>) {
  await tx.auditLog.create({ data: { tenantId, actorUserId: actorId, action, resourceType: "Workflow", resourceId, correlationId: `${action.toLowerCase()}:${resourceId}:${Date.now()}`, metadata: toPrismaJson(metadata) } });
}

export async function requireWorkflowProjectAccess(actor: ProjectActor, projectId: string, allowWrite: boolean) {
  return withProjectTransaction(actor, projectId, async (tx) => {
    const member = await tx.projectMember.findFirst({ where: { tenantId: actor.tenantId, projectId, userId: actor.userId } });
    if (!member) throw new Error("PROJECT_ACCESS_DENIED");
    if (allowWrite && member.role !== "OWNER" && member.role !== "MANAGER") throw new Error("FORBIDDEN");
    return member;
  });
}
