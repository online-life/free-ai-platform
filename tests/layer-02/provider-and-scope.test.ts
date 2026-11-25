import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { assertProjectScope } from "../../apps/api/src/modules/projects/project-scope";
import { ProviderDefinitionSchema } from "../../apps/api/src/modules/providers/provider.schemas";

describe("project and provider data boundaries", () => {
  const migration = fs.readFileSync("apps/api/prisma/migrations/0002_layer02_providers/migration.sql", "utf8");
  const schema = fs.readFileSync("apps/api/prisma/schema.prisma", "utf8");

  it("rejects cross-tenant and cross-project service access", () => {
    expect(() => assertProjectScope("tenant-b", "project-a", "tenant-a", new Set(["project-a"])))
      .toThrow("Tenant isolation violation");
    expect(() => assertProjectScope("tenant-a", "project-b", "tenant-a", new Set(["project-a"])))
      .toThrow("Project isolation violation");
  });

  it("adds database-enforced composite tenant/project relationships and RLS", () => {
    expect(schema).toContain("references: [tenantId, id]");
    expect(migration).toContain("FORCE ROW LEVEL SECURITY");
    expect(migration).toMatch(/"projectId" = current_setting\(''app\.project_id'', true\)/);
    expect(migration).toContain("provider_connections_scope_isolation");
  });

  it("rejects credentials in provider header configuration and unsafe endpoints", () => {
    expect(() => ProviderDefinitionSchema.parse({
      key: "provider-a",
      name: "Provider A",
      providerType: "OPENAI_COMPATIBLE",
      baseUrl: "https://api.example.test/v1",
      customHeaders: { Authorization: "secret" },
    })).toThrow();
    expect(() => ProviderDefinitionSchema.parse({
      key: "provider-a",
      name: "Provider A",
      providerType: "OPENAI_COMPATIBLE",
      baseUrl: "http://internal.example.test/v1",
    })).toThrow();
  });
});
