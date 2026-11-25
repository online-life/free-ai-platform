import { withProjectTransaction } from "./project-scope";
import { SpecialistProfileSchema } from "./project.schemas";
import { assertProjectPermission } from "./project.permissions";
import type { ProjectActor } from "./project.service";
import { ProjectEvents } from "./project.events";
import { OutboxService } from "../events/outbox.service";
import { toPrismaJson } from "../../infrastructure/database/prisma-json";

export class ProjectSpecialistService {
  constructor(private readonly outbox = new OutboxService()) {}

  async get(actor: ProjectActor, projectId: string) {
    return withProjectTransaction(actor, projectId, async (tx) => {
    const member = await tx.projectMember.findFirst({
      where: { tenantId: actor.tenantId, projectId, userId: actor.userId },
    });
    if (!member) throw new Error("PROJECT_ACCESS_DENIED");

    return tx.projectSpecialistProfile.findFirst({
      where: { tenantId: actor.tenantId, projectId },
      orderBy: { version: "desc" },
    });
    });
  }

  async save(actor: ProjectActor, projectId: string, raw: unknown) {
    const profile = SpecialistProfileSchema.parse(raw);
    return withProjectTransaction(actor, projectId, async (tx) => {
    const member = await tx.projectMember.findFirst({
      where: { tenantId: actor.tenantId, projectId, userId: actor.userId },
    });
    if (!member) throw new Error("PROJECT_ACCESS_DENIED");
    assertProjectPermission(member.role, "project.manage_settings");

    const latest = await tx.projectSpecialistProfile.findFirst({
      where: { tenantId: actor.tenantId, projectId },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const saved = await tx.projectSpecialistProfile.create({
      data: {
        tenantId: actor.tenantId,
        projectId,
        version: (latest?.version ?? 0) + 1,
        profile: toPrismaJson(profile),
        createdById: actor.userId,
      },
    });

    await this.outbox.enqueue({
      tenantId: actor.tenantId,
      eventType: ProjectEvents.CONTEXT_UPDATED,
      aggregateType: "ProjectWorkspace",
      aggregateId: projectId,
      payload: { projectId, specialistProfileId: saved.id, version: saved.version },
    });

    return saved;
    });
  }
}
