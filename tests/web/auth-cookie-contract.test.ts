import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const browserSource = readFileSync(new URL("../../apps/web/src/main.js", import.meta.url), "utf8");

describe("browser authentication storage contract", () => {
  it("does not persist session tokens or attach bearer tokens", () => {
    expect(browserSource).not.toContain("sessionStorage.getItem");
    expect(browserSource).not.toContain("sessionStorage.setItem");
    expect(browserSource).toContain('sessionStorage.removeItem("freeai-session")');
    expect(browserSource).not.toContain("authState.token");
    expect(browserSource).not.toContain("authorization:");
  });

  it("uses credentialed requests and sends CSRF headers for mutations", () => {
    expect(browserSource).toContain('credentials: "include"');
    expect(browserSource).toContain('"x-csrf-token": csrfToken');
  });
});

describe("project model execution UI contract", () => {
  it("executes through the project gateway with the verified-free policy enabled", () => {
    expect(browserSource).toContain("/api/v1/projects/${encodeURIComponent(projectId)}/ai/execute");
    expect(browserSource).toContain('requireFree: true, requirePrivacyApproved: true');
    expect(browserSource).toContain('operation: "CHAT"');
    expect(browserSource).toContain('maxFallbacks: 0');
  });
});
