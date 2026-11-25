import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("Free AI Platform product identity", () => {
  it("keeps all shipped interface resources English and left-to-right", async () => {
    const files = [
      "apps/web/index.html",
      "apps/web/src/main.js",
      "apps/web/src/styles.css",
      ...await (async () => (await readdir(join(root, "apps/web/assets"))).map((file) => `apps/web/assets/${file}`))(),
    ];
    for (const file of files) {
      const contents = await readFile(join(root, file), "utf8");
      expect(contents, file).not.toMatch(/[\u0600-\u06ff]/u);
      expect(contents, file).not.toMatch(/dir\s*=\s*["']rtl["']|\[dir\s*=\s*rtl\]/i);
    }
  });

  it("uses the product name and removes language selection", async () => {
    const html = await readFile(join(root, "apps/web/index.html"), "utf8");
    const source = await readFile(join(root, "apps/web/src/main.js"), "utf8");
    expect(html).toContain("<title>Free AI Platform</title>");
    expect(html).toContain("free-ai-platform-symbol.svg");
    expect(html).not.toContain("language-toggle");
    expect(source).not.toContain("data-locale");
    expect(source).not.toContain("freeai-locale");
  });
});
