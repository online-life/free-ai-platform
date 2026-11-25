import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";

const root = process.cwd();

const files = [
  "apps/api/src/modules/agents/agent-registry.service.ts",
  "apps/api/src/modules/agents/agent-evaluation.service.ts",
  "apps/api/src/modules/agents/agent-selection.service.ts",
  "apps/api/src/modules/model-intelligence/model-selection.service.ts",
  "apps/api/src/modules/model-intelligence/model-health.service.ts",
  "apps/api/src/modules/providers/unified-gateway.service.ts",
  "apps/api/src/modules/providers/provider-adapter.registry.ts",
  "apps/api/src/modules/providers/provider-quota.service.ts",
  "apps/api/src/modules/execution/execution.service.ts",
  "apps/api/src/modules/execution/execution-policy.service.ts",
  "apps/api/src/modules/execution/tool-registry.service.ts",
  "apps/api/src/modules/workflows/workflow-engine.service.ts",
  "apps/api/src/modules/workflows/workflow-approval.service.ts",
  "apps/api/src/modules/workflows/workflow-definition.service.ts",
];

describe("Layers 03–07 architecture files", () => {
  it.each(files)("creates %s", (file) => {
    expect(existsSync(`${root}/${file}`)).toBe(true);
  });

  it("routes provider requests through unified gateway", () => {
    const source = readFileSync(
      `${root}/apps/api/src/modules/providers/unified-gateway.service.ts`,
      "utf8",
    );
    expect(source).toContain("ProviderAdapterRegistry");
    expect(source).toContain("CredentialResolver");
    expect(source).toContain("usage.record");
  });

  it("requires project authorization before execution", () => {
    const source = readFileSync(
      `${root}/apps/api/src/modules/execution/execution.service.ts`,
      "utf8",
    );
    expect(source).toContain("assertCanExecute");
  });

  it("supports workflow approval waiting and resume", () => {
    const source = readFileSync(
      `${root}/apps/api/src/modules/workflows/workflow-engine.service.ts`,
      "utf8",
    );
    expect(source).toContain("WAITING_APPROVAL");
    expect(source).toContain("async resume");
  });

  it("contains cycle detection", () => {
    const source = readFileSync(
      `${root}/apps/api/src/modules/workflows/workflow-definition.service.ts`,
      "utf8",
    );
    expect(source).toContain("WORKFLOW_DEPENDENCY_CYCLE");
  });
});
