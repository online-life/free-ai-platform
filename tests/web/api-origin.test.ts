import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("web to API origin configuration", () => {
  it("uses the API's documented loopback default port", () => {
    const web = readFileSync("apps/web/src/main.js", "utf8");
    const api = readFileSync("apps/api/src/main.ts", "utf8");
    const apiDefaultPort = api.match(/process\.env\.API_PORT\s*\?\?\s*(\d+)/)?.[1];

    expect(apiDefaultPort).toBe("3000");
    expect(web).toContain("window.FREE_AI_API_BASE");
  });

  it("allows the configured API origin in the web Content Security Policy", () => {
    const server = readFileSync("apps/web/server.mjs", "utf8");
    expect(server).toContain("process.env.API_BASE_URL");
    expect(server).toContain("connect-src 'self' ${apiOrigin}");
  });
});
