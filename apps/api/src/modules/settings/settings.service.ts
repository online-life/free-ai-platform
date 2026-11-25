import { prisma } from "../../infrastructure/database/prisma";

export class SettingsService {
  async get(tenantId: string, projectId: string | null, key: string) {
    return prisma.setting.findFirst({
      where: { tenantId, projectId, key },
      select: { id: true, key: true, value: true, updatedAt: true },
    });
  }

  async upsert(
    tenantId: string,
    projectId: string | null,
    key: string,
    value: unknown,
  ) {
    if (!key || key.length > 150) throw new Error("Invalid setting key");

    if (projectId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, tenantId },
        select: { id: true },
      });
      if (!project) throw new Error("Project not found in tenant");
    }

    const existing = await prisma.setting.findFirst({
      where: { tenantId, projectId, key },
      select: { id: true },
    });

    if (existing) {
      return prisma.setting.updateMany({
        where: { id: existing.id, tenantId, projectId },
        data: { value: value as object },
      });
    }

    return prisma.setting.create({
      data: {
        tenantId,
        projectId,
        key,
        value: value as object,
      },
    });
  }
}
