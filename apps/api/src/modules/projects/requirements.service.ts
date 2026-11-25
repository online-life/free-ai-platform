import { withProjectTransaction } from "./project-scope";
import { RequirementCreateSchema } from "./project.schemas";
import { assertProjectPermission } from "./project.permissions";
import type { ProjectActor } from "./project.service";
import { ProjectEvents } from "./project.events";
import { OutboxService } from "../events/outbox.service";

export class RequirementsService {
  constructor(private readonly outbox = new OutboxService()) {}

  async create(actor: ProjectActor, projectId: string, raw: unknown) {
    const input = RequirementCreateSchema.parse(raw);
    return withProjectTransaction(actor, projectId, async (tx) => {
    const member = await tx.projectMember.findFirst({
      where: { tenantId: actor.tenantId, projectId, userId: actor.userId },
    });
    if (!member) throw new Error("PROJECT_ACCESS_DENIED");
    assertProjectPermission(member.role, "requirement.manage");

    const duplicate = await tx.projectRequirement.findFirst({
      where: { tenantId: actor.tenantId, projectId, code: input.code },
      select: { id: true },
    });
    if (duplicate) throw new Error("REQUIREMENT_CODE_EXISTS");

    const requirement = await tx.projectRequirement.create({
      data: {
        tenantId: actor.tenantId,
        projectId,
        code: input.code,
        title: input.title,
        description: input.description,
        type: input.type,
        priority: input.priority,
        acceptanceCriteria: input.acceptanceCriteria,
        createdById: actor.userId,
      },
    });

    await this.outbox.enqueue({
      tenantId: actor.tenantId,
      eventType: ProjectEvents.REQUIREMENT_CREATED,
      aggregateType: "ProjectRequirement",
      aggregateId: requirement.id,
      payload: { requirementId: requirement.id, projectId },
    });

    return requirement;
    });
  }

  async list(actor: ProjectActor, projectId: string) {
    return withProjectTransaction(actor, projectId, async (tx) => {
    const member = await tx.projectMember.findFirst({
      where: { tenantId: actor.tenantId, projectId, userId: actor.userId },
    });
    if (!member) throw new Error("PROJECT_ACCESS_DENIED");

    return tx.projectRequirement.findMany({
      where: { tenantId: actor.tenantId, projectId },
      orderBy: { createdAt: "asc" },
    });
    });
  }
}
