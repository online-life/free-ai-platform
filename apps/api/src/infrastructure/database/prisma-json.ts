import type { Prisma } from "@prisma/client";

/**
 * Converts serializable application data into a Prisma JSON input value.
 * JSON serialization also rejects circular references and unsupported
 * top-level values instead of silently passing invalid database input.
 */
export function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  const serialized = JSON.stringify(value);

  if (serialized === undefined) {
    throw new TypeError("Value cannot be represented as JSON");
  }

  return JSON.parse(serialized) as Prisma.InputJsonValue;
}
