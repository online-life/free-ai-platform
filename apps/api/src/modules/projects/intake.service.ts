import { withProjectTransaction } from "./project-scope";
import { IntakeCreateSchema } from "./project.schemas";
import { assertProjectPermission } from "./project.permissions";
import type { ProjectActor } from "./project.service";
import { ProjectEvents } from "./project.events";
import { OutboxService } from "../events/outbox.service";
import { toPrismaJson } from "../../infrastructure/database/prisma-json";

export class IntakeService {
  constructor(private readonly outbox = new OutboxService()) {}

  async submit(actor: ProjectActor, projectId: string, raw: unknown) {
    const input = IntakeCreateSchema.parse(raw);

    return withProjectTransaction(actor, projectId, async (tx) => {
    const member = await tx.projectMember.findFirst({
      where: { tenantId: actor.tenantId, projectId, userId: actor.userId },
    });
    if (!member) throw new Error("PROJECT_ACCESS_DENIED");
    assertProjectPermission(member.role, "intake.create");

    const intake = await tx.projectIntake.create({
      data: {
        tenantId: actor.tenantId,
        projectId,
        title: input.title,
        description: input.description,
        source: input.source,
        priority: input.priority,
        requestedBy: input.requestedBy,
        context: toPrismaJson(input.context ?? {}),
        attachmentIds: input.attachmentIds,
        status: "RECEIVED",
        createdById: actor.userId,
      },
    });

    await this.outbox.enqueue({
      tenantId: actor.tenantId,
      eventType: ProjectEvents.INTAKE_RECEIVED,
      aggregateType: "ProjectIntake",
      aggregateId: intake.id,
      payload: { intakeId: intake.id, projectId },
    });

    return intake;
    });
  }

  async review(
    actor: ProjectActor,
    projectId: string,
    intakeId: string,
    decision: "ACCEPTED" | "REJECTED",
    reviewNotes?: string,
  ) {
    return withProjectTransaction(actor, projectId, async (tx) => {
    const member = await tx.projectMember.findFirst({
      where: { tenantId: actor.tenantId, projectId, userId: actor.userId },
    });
    if (!member) throw new Error("PROJECT_ACCESS_DENIED");
    assertProjectPermission(member.role, "intake.review");

    const result = await tx.projectIntake.updateMany({
      where: { id: intakeId, tenantId: actor.tenantId, projectId },
      data: {
        status: decision,
        ...(reviewNotes !== undefined ? { reviewNotes } : {}),
        reviewedById: actor.userId,
        reviewedAt: new Date(),
      },
    });
    if (result.count !== 1) throw new Error("INTAKE_NOT_FOUND");

    if (decision === "ACCEPTED") {
      await this.outbox.enqueue({
        tenantId: actor.tenantId,
        eventType: ProjectEvents.INTAKE_ACCEPTED,
        aggregateType: "ProjectIntake",
        aggregateId: intakeId,
        payload: { intakeId, projectId },
      });
    }

    return { intakeId, status: decision };
    });
  }

  async list(actor: ProjectActor, projectId: string) {
    return withProjectTransaction(actor, projectId, async (tx) => {
    const member = await tx.projectMember.findFirst({
      where: { tenantId: actor.tenantId, projectId, userId: actor.userId },
    });
    if (!member) throw new Error("PROJECT_ACCESS_DENIED");

    return tx.projectIntake.findMany({
      where: { tenantId: actor.tenantId, projectId },
      orderBy: { createdAt: "desc" },
    });
    });
  }
}
