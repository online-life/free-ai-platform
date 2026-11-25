import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/database/prisma";
import { withTenantTransaction } from "../../infrastructure/database/transaction";
import { toPrismaJson } from "../../infrastructure/database/prisma-json";
import {
  EnrollRuntimeSchema,
  LocalWorkspaceSchema,
  RuntimeHeartbeatSchema,
  RuntimeJobCreateSchema,
  RuntimeJobReportSchema,
  SandboxProcessPayloadSchema,
} from "./runtime.schemas";

const PAIRING_TTL_MS = 10 * 60_000;
const DEVICE_TOKEN_TTL_MS = 30 * 24 * 60 * 60_000;
const ONLINE_WINDOW_MS = 30_000;

export interface RuntimeActor {
  tenantId: string;
  userId: string;
}

export class RuntimeManagementService {
  async createPairing(actor: RuntimeActor) {
    await this.requirePermission(actor, "device.manage");
    const pairingCode = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);
    await withTenantTransaction(actor, (tx) => tx.devicePairing.create({
      data: { tenantId: actor.tenantId, ownerId: actor.userId, codeHash: hashToken(pairingCode), expiresAt },
      select: { id: true },
    }));
    return { pairingCode, expiresAt };
  }

  async enroll(raw: unknown) {
    const input = EnrollRuntimeSchema.parse(raw);
    const codeHash = hashToken(input.pairingCode);
    const pairing = await prisma.devicePairing.findUnique({ where: { codeHash } });
    const now = new Date();
    if (!pairing || pairing.consumedAt || pairing.expiresAt <= now) throw new Error("RUNTIME_PAIRING_CODE_INVALID");

    const token = randomBytes(32).toString("base64url");
    const tokenExpiresAt = new Date(Date.now() + DEVICE_TOKEN_TTL_MS);
    const deviceId = randomUUID();
    const enrolled = await withTenantTransaction({ tenantId: pairing.tenantId, userId: pairing.ownerId }, async (tx) => {
      const consumed = await tx.devicePairing.updateMany({
        where: { id: pairing.id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) throw new Error("RUNTIME_PAIRING_CODE_INVALID");
      await tx.runtimeDevice.create({
        data: {
          id: deviceId,
          tenantId: pairing.tenantId,
          ownerId: pairing.ownerId,
          name: input.name,
          operatingSystem: input.operatingSystem,
          architecture: input.architecture,
          runtimeVersion: input.runtimeVersion,
          tokenHash: hashToken(token),
          tokenExpiresAt,
        },
      });
      await this.log(tx, pairing.tenantId, deviceId, "DEVICE_PAIRED", "" );
      return true;
    });
    if (!enrolled) throw new Error("RUNTIME_ENROLLMENT_FAILED");
    return { deviceId, token, tokenExpiresAt };
  }

  async listDevices(actor: RuntimeActor) {
    await this.requirePermission(actor, "device.manage");
    const now = Date.now();
    const rows = await withTenantTransaction(actor, (tx) => tx.runtimeDevice.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, operatingSystem: true, architecture: true,
        runtimeVersion: true, status: true, lastHeartbeatAt: true,
        tokenExpiresAt: true, revokedAt: true, createdAt: true,
        projects: { select: { projectId: true } },
      },
    }));
    return rows.map((device) => ({
      ...device,
      connectionStatus: device.status === "REVOKED"
        ? "REVOKED"
        : device.lastHeartbeatAt && now - device.lastHeartbeatAt.getTime() <= ONLINE_WINDOW_MS
          ? "ONLINE"
          : "OFFLINE",
      allowedProjectIds: device.projects.map(({ projectId }) => projectId),
      projects: undefined,
    }));
  }

  async revokeDevice(actor: RuntimeActor, deviceId: string) {
    await this.requirePermission(actor, "device.manage");
    const now = new Date();
    const result = await withTenantTransaction(actor, async (tx) => {
      const updated = await tx.runtimeDevice.updateMany({
        where: { id: deviceId, tenantId: actor.tenantId, status: "PAIRED" },
        data: { status: "REVOKED", revokedAt: now, tokenExpiresAt: now, tokenHash: randomBytes(32).toString("hex") },
      });
      if (updated.count !== 1) throw new Error("RUNTIME_DEVICE_NOT_FOUND");
      await tx.runtimeJob.updateMany({
        where: { tenantId: actor.tenantId, deviceId, status: { in: ["QUEUED", "RUNNING"] } },
        data: { status: "CANCEL_REQUESTED" },
      });
      await this.log(tx, actor.tenantId, deviceId, "DEVICE_REVOKED", "");
      return { deviceId, status: "REVOKED" as const };
    });
    return result;
  }

  async grantProject(actor: RuntimeActor, deviceId: string, projectId: string, allowed: boolean) {
    await this.requirePermission(actor, "device.manage");
    return withTenantTransaction(actor, async (tx) => {
      await this.requireProjectMembership(tx, actor, projectId);
      const device = await tx.runtimeDevice.findFirst({ where: { tenantId: actor.tenantId, id: deviceId, status: "PAIRED" }, select: { id: true } });
      if (!device) throw new Error("RUNTIME_DEVICE_NOT_FOUND");
      if (!allowed) {
        await tx.deviceProjectGrant.deleteMany({ where: { tenantId: actor.tenantId, deviceId, projectId } });
        await tx.runtimeJob.updateMany({ where: { tenantId: actor.tenantId, deviceId, projectId, status: "QUEUED" }, data: { status: "CANCEL_REQUESTED" } });
        await this.log(tx, actor.tenantId, deviceId, "DEVICE_PROJECT_REVOKED", "");
        return { deviceId, projectId, allowed: false };
      }
      await tx.deviceProjectGrant.upsert({
        where: { deviceId_projectId: { deviceId, projectId } },
        create: { tenantId: actor.tenantId, deviceId, projectId },
        update: {},
      });
      await this.log(tx, actor.tenantId, deviceId, "DEVICE_PROJECT_GRANTED", "");
      return { deviceId, projectId, allowed: true };
    });
  }

  async createWorkspace(actor: RuntimeActor, raw: unknown) {
    await this.requirePermission(actor, "workspace.manage");
    const input = LocalWorkspaceSchema.parse(raw);
    if (input.canDelete && !input.canWrite) throw new Error("WORKSPACE_DELETE_REQUIRES_WRITE");
    if (input.canExecute && (!input.canRead || !input.canWrite)) throw new Error("WORKSPACE_EXECUTE_REQUIRES_READ_WRITE");
    return withTenantTransaction(actor, async (tx) => {
      await this.requireProjectMembership(tx, actor, input.projectId);
      const [device, grant] = await Promise.all([
        tx.runtimeDevice.findFirst({ where: { id: input.deviceId, tenantId: actor.tenantId, status: "PAIRED" }, select: { id: true } }),
        tx.deviceProjectGrant.findFirst({ where: { tenantId: actor.tenantId, deviceId: input.deviceId, projectId: input.projectId }, select: { id: true } }),
      ]);
      if (!device) throw new Error("RUNTIME_DEVICE_NOT_FOUND");
      if (!grant) throw new Error("RUNTIME_PROJECT_ACCESS_DENIED");
      const result = await tx.localRuntimeWorkspace.create({
        data: {
          tenantId: actor.tenantId,
          deviceId: input.deviceId,
          projectId: input.projectId,
          name: input.name,
          rootAlias: input.rootAlias,
          workspaceKey: input.workspaceKey,
          canRead: input.canRead,
          canWrite: input.canWrite,
          canDelete: input.canDelete,
          canExecute: input.canExecute,
        },
        select: { id: true, deviceId: true, projectId: true, name: true, rootAlias: true, canRead: true, canWrite: true, canDelete: true, canExecute: true, status: true, createdAt: true },
      });
      await this.log(tx, actor.tenantId, input.deviceId, "WORKSPACE_REGISTERED", "");
      return result;
    });
  }

  async listWorkspaces(actor: RuntimeActor, projectId?: string) {
    await this.requirePermission(actor, "workspace.manage");
    if (projectId) await this.requireProjectMembershipOutsideTransaction(actor, projectId);
    return withTenantTransaction(actor, (tx) => tx.localRuntimeWorkspace.findMany({
      where: { tenantId: actor.tenantId, ...(projectId ? { projectId } : {}) },
      select: { id: true, deviceId: true, projectId: true, name: true, rootAlias: true, canRead: true, canWrite: true, canDelete: true, canExecute: true, status: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
    }));
  }

  async enqueueJob(actor: RuntimeActor, raw: unknown) {
    await this.requirePermission(actor, "execution.submit");
    const input = RuntimeJobCreateSchema.parse(raw);
    return withTenantTransaction(actor, async (tx) => {
      await this.requireProjectMembership(tx, actor, input.projectId);
      const workspace = await tx.localRuntimeWorkspace.findFirst({
        where: { tenantId: actor.tenantId, id: input.workspaceId, projectId: input.projectId, deviceId: input.deviceId, status: "ACTIVE" },
        select: { id: true, canRead: true, canWrite: true, canDelete: true, canExecute: true },
      });
      if (!workspace) throw new Error("RUNTIME_WORKSPACE_NOT_FOUND");
      if (!workspace.canRead) throw new Error("WORKSPACE_READ_DENIED");
      if (input.kind === "WORKSPACE_WRITE" && !workspace.canWrite) throw new Error("WORKSPACE_WRITE_DENIED");
      if (input.kind === "WORKSPACE_DELETE" && !workspace.canDelete) throw new Error("WORKSPACE_DELETE_DENIED");
      if (input.kind === "WORKSPACE_DELETE" && input.payload.approved !== true) throw new Error("WORKSPACE_DELETE_APPROVAL_REQUIRED");
      if (input.kind === "SANDBOX_PROCESS") {
        if (!workspace.canExecute) throw new Error("WORKSPACE_EXECUTION_DENIED");
        const processRequest = SandboxProcessPayloadSchema.safeParse(input.payload);
        if (!processRequest.success) throw new Error("SANDBOX_PROCESS_REQUEST_INVALID");
      }
      const grant = await tx.deviceProjectGrant.findFirst({ where: { tenantId: actor.tenantId, deviceId: input.deviceId, projectId: input.projectId }, select: { id: true } });
      if (!grant) throw new Error("RUNTIME_PROJECT_ACCESS_DENIED");
      const device = await tx.runtimeDevice.findFirst({ where: { tenantId: actor.tenantId, id: input.deviceId, status: "PAIRED" }, select: { id: true } });
      if (!device) throw new Error("RUNTIME_DEVICE_NOT_FOUND");
      try {
        return await tx.runtimeJob.create({
          data: {
            tenantId: actor.tenantId,
            deviceId: input.deviceId,
            projectId: input.projectId,
            workspaceId: input.workspaceId,
            requestedById: actor.userId,
            kind: input.kind,
            payload: toPrismaJson(input.payload),
            idempotencyKey: input.idempotencyKey,
          },
          select: { id: true, deviceId: true, projectId: true, workspaceId: true, kind: true, status: true, createdAt: true },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new Error("RUNTIME_JOB_IDEMPOTENCY_CONFLICT");
        throw error;
      }
    });
  }

  async listJobs(actor: RuntimeActor, projectId?: string) {
    await this.requirePermission(actor, "execution.submit");
    if (projectId) await this.requireProjectMembershipOutsideTransaction(actor, projectId);
    return withTenantTransaction(actor, (tx) => tx.runtimeJob.findMany({
      where: { tenantId: actor.tenantId, ...(projectId ? { projectId } : {}) },
      select: { id: true, deviceId: true, projectId: true, workspaceId: true, kind: true, status: true, result: true, errorCode: true, createdAt: true, startedAt: true, finishedAt: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }));
  }

  async cancelJob(actor: RuntimeActor, jobId: string) {
    await this.requirePermission(actor, "execution.submit");
    const updated = await withTenantTransaction(actor, async (tx) => {
      const job = await tx.runtimeJob.findFirst({ where: { tenantId: actor.tenantId, id: jobId }, select: { projectId: true, deviceId: true, status: true } });
      if (!job) throw new Error("RUNTIME_JOB_NOT_FOUND");
      await this.requireProjectMembership(tx, actor, job.projectId);
      if (!["QUEUED", "RUNNING"].includes(job.status)) throw new Error("RUNTIME_JOB_NOT_CANCELLABLE");
      const wasQueued = job.status === "QUEUED";
      const status = wasQueued ? "CANCELLED" as const : "CANCEL_REQUESTED" as const;
      await tx.runtimeJob.update({ where: { id: jobId }, data: { status, ...(wasQueued ? { finishedAt: new Date() } : {}) } });
      await this.log(tx, actor.tenantId, job.deviceId, wasQueued ? "JOB_CANCELLED_BEFORE_START" : "JOB_CANCEL_REQUESTED", "");
      return { jobId, status };
    });
    return updated;
  }

  async heartbeat(token: string, raw: unknown) {
    const input = RuntimeHeartbeatSchema.parse(raw);
    const device = await this.authenticateDevice(token);
    return withTenantTransaction({ tenantId: device.tenantId }, async (tx) => {
      await tx.runtimeDevice.update({ where: { id: device.id }, data: { lastHeartbeatAt: new Date(), runtimeVersion: input.runtimeVersion } });
      await this.log(tx, device.tenantId, device.id, "HEARTBEAT", input.health === "healthy" ? "" : "DEGRADED");
      const queued = await tx.runtimeJob.findMany({ where: { tenantId: device.tenantId, deviceId: device.id, status: "QUEUED" }, orderBy: { createdAt: "asc" }, take: 5, include: { workspace: { select: { id: true, rootAlias: true, workspaceKey: true, canRead: true, canWrite: true, canDelete: true, canExecute: true } } } });
      const jobs: Array<{ id: string; kind: string; payload: Prisma.JsonValue }> = [];
      for (const job of queued) {
        const claimed = await tx.runtimeJob.updateMany({ where: { id: job.id, tenantId: device.tenantId, status: "QUEUED" }, data: { status: "RUNNING", startedAt: new Date() } });
        if (claimed.count === 1) jobs.push({ id: job.id, kind: job.kind, payload: {
          workspaceBinding: { workspaceId: job.workspace.id, rootAlias: job.workspace.rootAlias, workspaceKey: job.workspace.workspaceKey, canRead: job.workspace.canRead, canWrite: job.workspace.canWrite, canDelete: job.workspace.canDelete, canExecute: job.workspace.canExecute },
          operation: job.payload,
        } });
      }
      const cancellations = await tx.runtimeJob.findMany({ where: { tenantId: device.tenantId, deviceId: device.id, status: "CANCEL_REQUESTED" }, select: { id: true }, take: 100 });
      return { jobs, cancelJobIds: cancellations.map(({ id }) => id), serverTime: new Date().toISOString() };
    });
  }

  async reportJob(token: string, jobId: string, raw: unknown) {
    const input = RuntimeJobReportSchema.parse(raw);
    const device = await this.authenticateDevice(token);
    return withTenantTransaction({ tenantId: device.tenantId }, async (tx) => {
      const job = await tx.runtimeJob.findFirst({ where: { tenantId: device.tenantId, id: jobId, deviceId: device.id }, select: { status: true } });
      if (!job) throw new Error("RUNTIME_JOB_NOT_FOUND");
      if (input.status === "RUNNING") {
        if (!["RUNNING", "QUEUED"].includes(job.status)) throw new Error("RUNTIME_JOB_STATE_CONFLICT");
        await tx.runtimeJob.update({ where: { id: jobId }, data: { status: "RUNNING", ...(job.status === "QUEUED" ? { startedAt: new Date() } : {}), ...(input.result !== undefined ? { result: toPrismaJson({ progress: input.result }) } : {}) } });
      } else {
        if (job.status === "CANCEL_REQUESTED" && input.status !== "CANCELLED") throw new Error("RUNTIME_JOB_CANCEL_PENDING");
        if (!["RUNNING", "CANCEL_REQUESTED"].includes(job.status)) throw new Error("RUNTIME_JOB_STATE_CONFLICT");
        await tx.runtimeJob.update({
          where: { id: jobId },
          data: {
            status: input.status,
            ...(input.result !== undefined ? { result: toPrismaJson(input.result) } : {}),
            ...(input.errorCode ? { errorCode: input.errorCode } : {}),
            finishedAt: new Date(),
          },
        });
      }
      await this.log(tx, device.tenantId, device.id, `JOB_${input.status}`, "");
      return { jobId, status: input.status };
    });
  }

  async listLogs(actor: RuntimeActor, deviceId?: string) {
    await this.requirePermission(actor, "device.manage");
    if (deviceId) {
      const owned = await withTenantTransaction(actor, (tx) => tx.runtimeDevice.findFirst({ where: { tenantId: actor.tenantId, id: deviceId }, select: { id: true } }));
      if (!owned) throw new Error("RUNTIME_DEVICE_NOT_FOUND");
    }
    return withTenantTransaction(actor, (tx) => tx.runtimeLog.findMany({
      where: { tenantId: actor.tenantId, ...(deviceId ? { deviceId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, deviceId: true, event: true, detail: true, createdAt: true },
    }));
  }


  private async authenticateDevice(token: string) {
    if (token.length < 40 || token.length > 200) throw new Error("RUNTIME_DEVICE_UNAUTHORIZED");
    const device = await prisma.runtimeDevice.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!device || device.status !== "PAIRED" || device.revokedAt || device.tokenExpiresAt <= new Date()) {
      throw new Error("RUNTIME_DEVICE_UNAUTHORIZED");
    }
    return device;
  }

  private async requirePermission(actor: RuntimeActor, permission: string): Promise<void> {
    const allowed = await withTenantTransaction(actor, (tx) => tx.userRole.findMany({
      where: { tenantId: actor.tenantId, userId: actor.userId },
      select: { role: { select: { permissions: { where: { tenantId: actor.tenantId }, select: { effect: true, permission: { select: { key: true } } } } } } },
    }));
    const grants = allowed.flatMap(({ role }) => role.permissions.filter((item) => item.permission.key === permission).map((item) => item.effect));
    if (grants.includes("DENY") || !grants.includes("ALLOW")) throw new Error("FORBIDDEN");
  }

  private async requireProjectMembership(tx: Prisma.TransactionClient, actor: RuntimeActor, projectId: string): Promise<void> {
    const membership = await tx.projectMember.findFirst({ where: { tenantId: actor.tenantId, projectId, userId: actor.userId }, select: { id: true } });
    if (!membership) throw new Error("PROJECT_ACCESS_DENIED");
  }

  private async requireProjectMembershipOutsideTransaction(actor: RuntimeActor, projectId: string): Promise<void> {
    await withTenantTransaction(actor, (tx) => this.requireProjectMembership(tx, actor, projectId));
  }

  private async log(tx: Prisma.TransactionClient, tenantId: string, deviceId: string, event: string, detail: string): Promise<void> {
    await tx.runtimeLog.create({ data: { tenantId, deviceId, event, ...(detail ? { detail: detail.slice(0, 100) } : {}) } });
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
