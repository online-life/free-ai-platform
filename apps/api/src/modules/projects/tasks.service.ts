import type { Prisma } from "@prisma/client";
import { withProjectTransaction } from "./project-scope";
import { DependencyCreateSchema, TaskCreateSchema, TaskUpdateSchema } from "./project.schemas";
import { assertProjectPermission } from "./project.permissions";
import type { ProjectActor } from "./project.service";
import { ProjectEvents } from "./project.events";
import { OutboxService } from "../events/outbox.service";

export class TasksService {
  constructor(private readonly outbox = new OutboxService()) {}

  private async membership(tx: Prisma.TransactionClient, actor: ProjectActor, projectId: string) {
    const member = await tx.projectMember.findFirst({
      where: { tenantId: actor.tenantId, projectId, userId: actor.userId },
    });
    if (!member) throw new Error("PROJECT_ACCESS_DENIED");
    return member;
  }

  async create(actor: ProjectActor, projectId: string, raw: unknown) {
    const input = TaskCreateSchema.parse(raw);
    return withProjectTransaction(actor, projectId, async (tx) => {
    const member = await this.membership(tx, actor, projectId);
    assertProjectPermission(member.role, "task.create");

    if (input.parentTaskId) {
      const parent = await tx.projectTask.findFirst({
        where: {
          id: input.parentTaskId,
          tenantId: actor.tenantId,
          projectId,
        },
        select: { id: true },
      });
      if (!parent) throw new Error("PARENT_TASK_NOT_FOUND");
    }

    if (input.requirementId) {
      const requirement = await tx.projectRequirement.findFirst({
        where: {
          id: input.requirementId,
          tenantId: actor.tenantId,
          projectId,
        },
        select: { id: true },
      });
      if (!requirement) throw new Error("REQUIREMENT_NOT_FOUND");
    }

    const task = await tx.projectTask.create({
      data: {
        tenantId: actor.tenantId,
        projectId,
        title: input.title,
        ...(input.description !== undefined ? { description: input.description } : {}),
        type: input.type,
        priority: input.priority,
        status: input.status,
        ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
        ...(input.parentTaskId !== undefined ? { parentTaskId: input.parentTaskId } : {}),
        ...(input.requirementId !== undefined ? { requirementId: input.requirementId } : {}),
        ...(input.estimateMinutes !== undefined ? { estimateMinutes: input.estimateMinutes } : {}),
        ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
        position: input.position,
        createdById: actor.userId,
      },
    });

    await this.outbox.enqueue({
      tenantId: actor.tenantId,
      eventType: ProjectEvents.TASK_CREATED,
      aggregateType: "ProjectTask",
      aggregateId: task.id,
      payload: { taskId: task.id, projectId },
    });

    return task;
    });
  }

  async update(
    actor: ProjectActor,
    projectId: string,
    taskId: string,
    raw: unknown,
  ) {
    const input = TaskUpdateSchema.parse(raw);
    return withProjectTransaction(actor, projectId, async (tx) => {
    const member = await this.membership(tx, actor, projectId);
    assertProjectPermission(member.role, "task.update");

    const existing = await tx.projectTask.findFirst({
      where: { id: taskId, tenantId: actor.tenantId, projectId },
      select: { id: true },
    });
    if (!existing) throw new Error("TASK_NOT_FOUND");

    const updated = await tx.projectTask.update({
      where: { id: taskId },
      data: Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined),
      ) as Prisma.ProjectTaskUncheckedUpdateInput,
    });

    await this.outbox.enqueue({
      tenantId: actor.tenantId,
      eventType: ProjectEvents.TASK_UPDATED,
      aggregateType: "ProjectTask",
      aggregateId: taskId,
      payload: { taskId, projectId, changedFields: Object.keys(input) },
    });

    return updated;
    });
  }

  async addDependency(
    actor: ProjectActor,
    projectId: string,
    raw: unknown,
  ) {
    const input = DependencyCreateSchema.parse(raw);
    return withProjectTransaction(actor, projectId, async (tx) => {
    const member = await this.membership(tx, actor, projectId);
    assertProjectPermission(member.role, "task.update");

    const ids = [input.predecessorId, input.successorId];
    const tasks = await tx.projectTask.findMany({
      where: { tenantId: actor.tenantId, projectId, id: { in: ids } },
      select: { id: true },
    });
    if (tasks.length !== 2) throw new Error("TASK_DEPENDENCY_SCOPE_INVALID");

    if (input.type !== "RELATES_TO") {
      const reversePath = await this.hasPath(
        tx,
        actor.tenantId,
        projectId,
        input.successorId,
        input.predecessorId,
      );
      if (reversePath) throw new Error("TASK_DEPENDENCY_CYCLE");
    }

    const dependency = await tx.projectTaskDependency.create({
      data: {
        tenantId: actor.tenantId,
        projectId,
        predecessorId: input.predecessorId,
        successorId: input.successorId,
        type: input.type,
        createdById: actor.userId,
      },
    });

    await this.outbox.enqueue({
      tenantId: actor.tenantId,
      eventType: ProjectEvents.TASK_DEPENDENCY_CREATED,
      aggregateType: "ProjectTask",
      aggregateId: input.predecessorId,
      payload: { projectId, ...input },
    });

    return dependency;
    });
  }

  async list(actor: ProjectActor, projectId: string) {
    return withProjectTransaction(actor, projectId, async (tx) => {
    await this.membership(tx, actor, projectId);
    return tx.projectTask.findMany({
      where: { tenantId: actor.tenantId, projectId },
      include: { dependenciesFrom: true, dependenciesTo: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    });
  }

  private async hasPath(
    tx: Prisma.TransactionClient,
    tenantId: string,
    projectId: string,
    fromId: string,
    toId: string,
  ): Promise<boolean> {
    const visited = new Set<string>();
    const queue = [fromId];

    while (queue.length) {
      const current = queue.shift()!;
      if (current === toId) return true;
      if (visited.has(current)) continue;
      visited.add(current);

      const edges = await tx.projectTaskDependency.findMany({
        where: {
          tenantId,
          projectId,
          predecessorId: current,
          type: { in: ["BLOCKS", "REQUIRES"] },
        },
        select: { successorId: true },
      });
      for (const edge of edges) {
        if (!visited.has(edge.successorId)) queue.push(edge.successorId);
      }
    }
    return false;
  }
}
