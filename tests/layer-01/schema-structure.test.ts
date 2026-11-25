import { describe, expect, it } from "vitest";
import fs from "node:fs";

const schema = fs.readFileSync(
  "apps/api/prisma/schema.prisma",
  "utf8",
);

describe("Prisma schema", () => {
  for (const model of [
    "Tenant", "Project", "User", "Session",
    "Role", "Permission", "UserRole", "RolePermission",
    "Setting", "AuditLog", "OutboxEvent",
    "Secret", "StoredObject",
  ]) {
    it(`contains model ${model}`, () => {
      expect(schema).toMatch(
        new RegExp(`model\\s+${model}\\s*\\{`),
      );
    });
  }

  it("defines Prisma relations", () => {
    expect(schema).toContain("@relation");
  });

  it("uses PostgreSQL", () => {
    expect(schema).toContain('provider = "postgresql"');
  });

  it("contains tenant and project scopes", () => {
    expect(schema).toContain("tenantId");
    expect(schema).toContain("projectId");
  });
});
