import { withProjectTransaction } from "./project-scope";
import { assertProjectPermission } from "./project.permissions";
import type { ProjectActor } from "./project.service";
import { OutboxService } from "../events/outbox.service";
import { ProjectEvents } from "./project.events";

export class ProjectContextService {
  constructor(private readonly outbox = new OutboxService()) {}

  async addEntry(
    actor: ProjectActor,
    projectId: string,
    input: {
      type: "NOTE" | "DECISION" | "CONVENTION" | "RISK" | "GLOSSARY";
      title: string;
      content: string;
      tags?: string[];
    },
  ) {
    if (!input.title.trim() || !input.content.trim()) {
      throw new Error("CONTEXT_TITLE_AND_CONTENT_REQUIRED");
    }

    return withProjectTransaction(actor, projectId, async (tx) => {
    const member = await tx.projectMember.findFirst({
      where: { tenantId: actor.tenantId, projectId, userId: actor.userId },
    });
    if (!member) throw new Error("PROJECT_ACCESS_DENIED");
    assertProjectPermission(member.role, "context.manage");

    const latest = await tx.projectContextEntry.findFirst({
      where: { tenantId: actor.tenantId, projectId, title: input.title },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const entry = await tx.projectContextEntry.create({
      data: {
        tenantId: actor.tenantId,
        projectId,
        type: input.type,
        title: input.title,
        content: input.content,
        tags: input.tags ?? [],
        version: (latest?.version ?? 0) + 1,
        createdById: actor.userId,
      },
    });

    await this.outbox.enqueue({
      tenantId: actor.tenantId,
      eventType: ProjectEvents.CONTEXT_UPDATED,
      aggregateType: "ProjectContextEntry",
      aggregateId: entry.id,
      payload: { projectId, entryId: entry.id, version: entry.version },
    });

    return entry;
    });
  }

  async list(actor: ProjectActor, projectId: string) {
    return withProjectTransaction(actor, projectId, async (tx) => {
    const member = await tx.projectMember.findFirst({
      where: { tenantId: actor.tenantId, projectId, userId: actor.userId },
    });
    if (!member) throw new Error("PROJECT_ACCESS_DENIED");

    return tx.projectContextEntry.findMany({
      where: { tenantId: actor.tenantId, projectId },
      orderBy: [{ title: "asc" }, { version: "desc" }],
    });
    });
  }
}
