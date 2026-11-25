import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const root = process.cwd();
const modulePath = `${root}/apps/api/src/modules/projects`;

describe("Layer 02 architecture", () => {
  const requiredFiles = [
    "project.schemas.ts",
    "project.permissions.ts",
    "project.events.ts",
    "project.service.ts",
    "intake.service.ts",
    "requirements.service.ts",
    "tasks.service.ts",
    "project-specialist.service.ts",
    "project-context.service.ts",
    "project-files.service.ts",
    "project-activity.service.ts",
    "index.ts",
  ];

  it.each(requiredFiles)("contains %s", (file) => {
    expect(existsSync(`${modulePath}/${file}`)).toBe(true);
  });

  it("uses tenant scoping in project service", () => {
    const source = readFileSync(`${modulePath}/project.service.ts`, "utf8");
    expect(source).toContain("tenantId: actor.tenantId");
    expect(source).toContain("PROJECT_ACCESS_DENIED");
  });

  it("validates task dependencies", () => {
    const source = readFileSync(`${modulePath}/tasks.service.ts`, "utf8");
    expect(source).toContain("TASK_DEPENDENCY_CYCLE");
    expect(source).toContain("TASK_DEPENDENCY_SCOPE_INVALID");
  });

  it("does not implement file byte uploads in this layer", () => {
    const source = readFileSync(`${modulePath}/project-files.service.ts`, "utf8");
    expect(source).toContain("storageKey");
    expect(source).not.toContain("writeFile(");
  });
});
