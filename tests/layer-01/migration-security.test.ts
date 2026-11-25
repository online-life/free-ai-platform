import { describe, expect, it } from "vitest";
import fs from "node:fs";

const migration = fs.readFileSync(
  "apps/api/prisma/migrations/0001_layer01_security/migration.sql",
  "utf8",
);

describe("Database migration security", () => {
  it("enables row level security", () => {
    expect(migration).toMatch(/ENABLE ROW LEVEL SECURITY/i);
  });

  it("forces row level security", () => {
    expect(migration).toMatch(/FORCE ROW LEVEL SECURITY/i);
  });

  it("uses tenant context", () => {
    expect(migration).toContain("app.tenant_id");
  });

  it("uses project context", () => {
    expect(migration).toContain("app.project_id");
  });

  it("defines policies", () => {
    expect(migration).toMatch(/CREATE POLICY/i);
  });

  it("protects audit records against update and delete", () => {
    expect(migration).toContain("audit_logs_immutable");
    expect(migration).toContain("prevent_audit_mutation");
  });
});
