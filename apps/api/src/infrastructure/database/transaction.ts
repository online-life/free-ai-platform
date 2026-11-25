import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import {
  applyDatabaseScope,
  type RequestScope,
} from "./tenant-context";

export async function withTenantTransaction<T>(
  scope: RequestScope,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await applyDatabaseScope(tx, scope);
    return operation(tx);
  }, {
    maxWait: 5000,
    timeout: 15000,
    isolationLevel: "ReadCommitted",
  });
}
