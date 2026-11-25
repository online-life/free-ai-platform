import {
  ProjectRole,
  ProjectStatus,
  Prisma,
} from "@prisma/client";
import { withTenantTransaction } from "../../infrastructure/database/transaction";
import { applyDatabaseScope } from "../../infrastructure/database/tenant-context";
import { withProjectTransaction } from "./project-scope";
import { ProjectCreateSchema, ProjectUpdateSchema } from "./project.schemas";
import { assertProjectPermission } from "./project.permissions";
import { ProjectEvents } from "./project.events";
import { AuditService } from "../audit/audit.service";
import { OutboxService } from "../events/outbox.service";

export interface ProjectActor {
  tenantId: string;
  userId: string;
}

export class ProjectService {
  constructor(
    private readonly audit = new AuditService(),
    private readonly outbox = new OutboxService(),
  ) {}

  async create(actor: ProjectActor, raw: unknown) {
    const input = ProjectCreateSchema.parse(raw);

    const project = await withTenantTransaction({ tenantId: actor.tenantId, userId: actor.userId }, async (tx) => {
    const duplicate = await tx.projectWorkspace.findFirst({
      where: { tenantId: actor.tenantId, key: input.key },
      select: { id: true },
    });
    if (duplicate) throw new Error("PROJECT_KEY_ALREADY_EXISTS");

    const created = await tx.projectWorkspace.create({
      data: {
        tenantId: actor.tenantId,
        name: input.name,
        key: input.key,
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.domain !== undefined ? { domain: input.domain } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        status: "DRAFT",
        ownerId: actor.userId,
        createdById: actor.userId,
        ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
        ...(input.targetDate !== undefined ? { targetDate: input.targetDate } : {}),
        settings: (input.settings ?? {}) as Prisma.InputJsonValue,
      },
    });
    // project_members rows are only writable inside their own project scope
    // (FORCE RLS). Re-scope this same transaction to the new project before
    // inserting the owner membership so creation works under a least-privilege
    // database role, not only under a superuser that bypasses RLS.
    await applyDatabaseScope(tx, { tenantId: actor.tenantId, userId: actor.userId, projectId: created.id });
    await tx.projectMember.create({
      data: { tenantId: actor.tenantId, projectId: created.id, userId: actor.userId, role: "OWNER" },
    });
    return created;
    });

    await this.audit.record({
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      action: "PROJECT_CREATED",
      resourceType: "ProjectWorkspace",
      resourceId: project.id,
      metadata: { key: project.key },
    });

    await this.outbox.enqueue({
      tenantId: actor.tenantId,
      eventType: ProjectEvents.CREATED,
      aggregateType: "ProjectWorkspace",
      aggregateId: project.id,
      payload: { projectId: project.id, key: project.key },
    });

    return project;
  }

  async get(actor: ProjectActor, projectId: string) {
    const membership = await this.getMembership(actor, projectId);
    assertProjectPermission(membership.role, "project.read");

    return withProjectTransaction(actor, projectId, (tx) => tx.projectWorkspace.findFirst({
      where: { id: projectId, tenantId: actor.tenantId },
      include: {
        members: true,
        _count: { select: { tasks: true, requirements: true } },
      },
    }));
  }

  async update(
    actor: ProjectActor,
    projectId: string,
    raw: unknown,
  ) {
    const input = ProjectUpdateSchema.parse(raw);
    const membership = await this.getMembership(actor, projectId);
    assertProjectPermission(membership.role, "project.update");

    const updated = await withProjectTransaction(actor, projectId, async (tx) => {
    const existing = await tx.projectWorkspace.findFirst({
      where: { id: projectId, tenantId: actor.tenantId },
      select: { id: true },
    });
    if (!existing) throw new Error("PROJECT_NOT_FOUND");

    return tx.projectWorkspace.update({
      where: { id: projectId },
      data: {
        ...Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)),
        ...(input.settings !== undefined
          ? { settings: input.settings as Prisma.InputJsonValue }
          : {}),
      },
    });
    });

    await this.audit.record({
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      action: "PROJECT_UPDATED",
      resourceType: "ProjectWorkspace",
      resourceId: projectId,
      metadata: { fields: Object.keys(input) },
    });

    await this.outbox.enqueue({
      tenantId: actor.tenantId,
      eventType: ProjectEvents.UPDATED,
      aggregateType: "ProjectWorkspace",
      aggregateId: projectId,
      payload: { projectId, changedFields: Object.keys(input) },
    });

    return updated;
  }

  async changeStatus(
    actor: ProjectActor,
    projectId: string,
    status: ProjectStatus,
  ) {
    const membership = await this.getMembership(actor, projectId);
    assertProjectPermission(membership.role, "project.update");

    const result = await withProjectTransaction(actor, projectId, (tx) => tx.projectWorkspace.updateMany({
      where: { id: projectId, tenantId: actor.tenantId },
      data: { status },
    }));
    if (result.count !== 1) throw new Error("PROJECT_NOT_FOUND");

    await this.outbox.enqueue({
      tenantId: actor.tenantId,
      eventType: ProjectEvents.STATUS_CHANGED,
      aggregateType: "ProjectWorkspace",
      aggregateId: projectId,
      payload: { projectId, status },
    });

    return { projectId, status };
  }

  async addMember(
    actor: ProjectActor,
    projectId: string,
    userId: string,
    role: Exclude<ProjectRole, "OWNER">,
  ) {
    const membership = await this.getMembership(actor, projectId);
    assertProjectPermission(membership.role, "project.manage_members");

    const member = await withProjectTransaction(actor, projectId, async (tx) => {
    const project = await tx.projectWorkspace.findFirst({
      where: { id: projectId, tenantId: actor.tenantId },
      select: { id: true },
    });
    if (!project) throw new Error("PROJECT_NOT_FOUND");

    return tx.projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      create: { tenantId: actor.tenantId, projectId, userId, role },
      update: { role },
    });
    });

    await this.outbox.enqueue({
      tenantId: actor.tenantId,
      eventType: ProjectEvents.MEMBER_ADDED,
      aggregateType: "ProjectWorkspace",
      aggregateId: projectId,
      payload: { projectId, userId, role },
    });

    return member;
  }

  async removeMember(
    actor: ProjectActor,
    projectId: string,
    userId: string,
  ) {
    const membership = await this.getMembership(actor, projectId);
    assertProjectPermission(membership.role, "project.manage_members");
    if (userId === actor.userId) throw new Error("CANNOT_REMOVE_SELF");

    const result = await withProjectTransaction(actor, projectId, (tx) => tx.projectMember.deleteMany({
      where: { tenantId: actor.tenantId, projectId, userId },
    }));
    if (result.count !== 1) throw new Error("PROJECT_MEMBER_NOT_FOUND");

    await this.outbox.enqueue({
      tenantId: actor.tenantId,
      eventType: ProjectEvents.MEMBER_REMOVED,
      aggregateType: "ProjectWorkspace",
      aggregateId: projectId,
      payload: { projectId, userId },
    });

    return { removed: true };
  }

  async list(actor: ProjectActor, cursor?: string, limit = 20) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    return withTenantTransaction({ tenantId: actor.tenantId, userId: actor.userId }, (tx) => tx.projectWorkspace.findMany({
      where: {
        tenantId: actor.tenantId,
        members: { some: { userId: actor.userId } },
      },
      take: safeLimit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: "desc" },
    }));
  }

  private async getMembership(actor: ProjectActor, projectId: string) {
    const membership = await withProjectTransaction(actor, projectId, (tx) => tx.projectMember.findFirst({
      where: {
        tenantId: actor.tenantId,
        projectId,
        userId: actor.userId,
        project: { tenantId: actor.tenantId },
      },
    }));
    if (!membership) throw new Error("PROJECT_ACCESS_DENIED");
    return membership;
  }
}
