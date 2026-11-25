import { withTenantTransaction } from "../../infrastructure/database/transaction";

export class AuthorizationService {
  async hasPermission(
    tenantId: string,
    userId: string,
    permissionKey: string,
  ): Promise<boolean> {
    const assignments = await withTenantTransaction({ tenantId, userId }, (tx) =>
      tx.userRole.findMany({
        where: { tenantId, userId },
        select: {
          role: {
            select: {
              permissions: {
                where: { tenantId },
                select: {
                  effect: true,
                  permission: {
                    select: { key: true },
                  },
                },
              },
            },
          },
        },
      }),
    );

    const matching = assignments.flatMap((assignment) =>
      assignment.role.permissions
        .filter((item) => item.permission.key === permissionKey)
        .map((item) => item.effect),
    );

    if (matching.includes("DENY")) return false;
    return matching.includes("ALLOW");
  }

  async assertPermission(
    tenantId: string,
    userId: string,
    permissionKey: string,
  ): Promise<void> {
    if (!(await this.hasPermission(tenantId, userId, permissionKey))) {
      throw new Error("FORBIDDEN");
    }
  }
}
