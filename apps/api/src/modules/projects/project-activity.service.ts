import { withProjectTransaction } from "./project-scope";
import { assertProjectPermission } from "./project.permissions";
import type { ProjectActor } from "./project.service";
import { ProjectEvents } from "./project.events";
import { OutboxService } from "../events/outbox.service";

export class ProjectActivityService {
  constructor(private readonly outbox = new OutboxService()) {}

  async comment(
    actor: ProjectActor,
    projectId: string,
    input: { body: string; taskId?: string },
  ) {
    const body = input.body.trim();
    if (!body || body.length > 20000) throw new Error("COMMENT_INVALID");

    return withProjectTransaction(actor, projectId, async (tx) => {
    const member = await tx.projectMember.findFirst({
      where: { tenantId: actor.tenantId, projectId, userId: actor.userId },
    });
    if (!member) throw new Error("PROJECT_ACCESS_DENIED");
    assertProjectPermission(member.role, "activity.create");

    if (input.taskId) {
      const task = await tx.projectTask.findFirst({
        where: { id: input.taskId, tenantId: actor.tenantId, projectId },
        select: { id: true },
      });
      if (!task) throw new Error("TASK_NOT_FOUND");
    }

    const comment = await tx.projectComment.create({
      data: {
        tenantId: actor.tenantId,
        projectId,
        ...(input.taskId ? { taskId: input.taskId } : {}),
        body,
        authorId: actor.userId,
      },
    });

    await this.outbox.enqueue({
      tenantId: actor.tenantId,
      eventType: ProjectEvents.COMMENT_CREATED,
      aggregateType: "ProjectComment",
      aggregateId: comment.id,
      payload: { projectId, commentId: comment.id, taskId: input.taskId },
    });

    return comment;
    });
  }

  async timeline(actor: ProjectActor, projectId: string, limit = 50) {
    return withProjectTransaction(actor, projectId, async (tx) => {
    const member = await tx.projectMember.findFirst({
      where: { tenantId: actor.tenantId, projectId, userId: actor.userId },
    });
    if (!member) throw new Error("PROJECT_ACCESS_DENIED");

    return tx.projectComment.findMany({
      where: { tenantId: actor.tenantId, projectId },
      take: Math.min(Math.max(limit, 1), 100),
      orderBy: { createdAt: "desc" },
    });
    });
  }
}
