import { withProjectTransaction } from "./project-scope";
import { assertProjectPermission } from "./project.permissions";
import type { ProjectActor } from "./project.service";
import { OutboxService } from "../events/outbox.service";
import { ProjectEvents } from "./project.events";

export class ProjectFilesService {
  constructor(private readonly outbox = new OutboxService()) {}

  async register(
    actor: ProjectActor,
    projectId: string,
    input: {
      storageKey: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      checksum: string;
      classification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
    },
  ) {
    if (!input.storageKey.trim() || !input.fileName.trim()) {
      throw new Error("FILE_METADATA_INVALID");
    }
    if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0) {
      throw new Error("FILE_SIZE_INVALID");
    }

    return withProjectTransaction(actor, projectId, async (tx) => {
    const member = await tx.projectMember.findFirst({
      where: { tenantId: actor.tenantId, projectId, userId: actor.userId },
    });
    if (!member) throw new Error("PROJECT_ACCESS_DENIED");
    assertProjectPermission(member.role, "file.manage");

    const file = await tx.projectFile.create({
      data: {
        tenantId: actor.tenantId,
        projectId,
        storageKey: input.storageKey,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        checksum: input.checksum,
        classification: input.classification,
        uploadedById: actor.userId,
      },
    });

    await this.outbox.enqueue({
      tenantId: actor.tenantId,
      eventType: ProjectEvents.FILE_REGISTERED,
      aggregateType: "ProjectFile",
      aggregateId: file.id,
      payload: { projectId, fileId: file.id },
    });

    return file;
    });
  }

  async list(actor: ProjectActor, projectId: string) {
    return withProjectTransaction(actor, projectId, async (tx) => {
    const member = await tx.projectMember.findFirst({
      where: { tenantId: actor.tenantId, projectId, userId: actor.userId },
    });
    if (!member) throw new Error("PROJECT_ACCESS_DENIED");

    return tx.projectFile.findMany({
      where: { tenantId: actor.tenantId, projectId },
      orderBy: { createdAt: "desc" },
    });
    });
  }
}
