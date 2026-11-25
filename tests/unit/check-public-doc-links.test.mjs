import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkMarkdownFiles } from "../../scripts/check-public-doc-links.mjs";

const temporaryRoots = [];

function createFixture(files) {
  const root = mkdtempSync(path.join(os.tmpdir(), "public-doc-links-"));
  temporaryRoots.push(root);
  for (const [filePath, content] of Object.entries(files)) {
    const absolutePath = path.join(root, filePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content);
  }
  return root;
}

test.after(() => {
  for (const root of temporaryRoots) rmSync(root, { recursive: true, force: true });
});

test("accepts a relative document link", () => {
  const root = createFixture({
    "README.md": "[Guide](guide.md)\n",
    "guide.md": "# Guide\n",
  });

  const result = checkMarkdownFiles(["README.md"], root);

  assert.deepEqual(result.diagnostics, []);
});

test("accepts a relative image link", () => {
  const root = createFixture({
    "README.md": "![Mark](assets/mark.png)\n",
    "assets/mark.png": "png",
  });

  const result = checkMarkdownFiles(["README.md"], root);

  assert.deepEqual(result.diagnostics, []);
});

test("reports a missing local image in an HTML tag", () => {
  const root = createFixture({
    "README.md": '<img src="assets/missing.png" alt="Mark">\n',
  });

  const result = checkMarkdownFiles(["README.md"], root);

  assert.deepEqual(result.diagnostics, [
    { path: "README.md", line: 1, kind: "missing-file", target: "assets/missing.png" },
  ]);
});

test("reports a missing local file with source path and line", () => {
  const root = createFixture({ "README.md": "First line\n[Guide](missing.md)\n" });

  const result = checkMarkdownFiles(["README.md"], root);

  assert.deepEqual(result.diagnostics, [
    { path: "README.md", line: 2, kind: "missing-file", target: "missing.md" },
  ]);
});

test("accepts a link to an existing heading anchor", () => {
  const root = createFixture({
    "README.md": "[Setup](guide.md#first-run)\n",
    "guide.md": "# First Run\n",
  });

  const result = checkMarkdownFiles(["README.md"], root);

  assert.deepEqual(result.diagnostics, []);
});

test("reports a missing heading anchor", () => {
  const root = createFixture({
    "README.md": "[Setup](guide.md#missing-section)\n",
    "guide.md": "# First Run\n",
  });

  const result = checkMarkdownFiles(["README.md"], root);

  assert.deepEqual(result.diagnostics, [
    {
      path: "README.md",
      line: 1,
      kind: "missing-anchor",
      target: "guide.md#missing-section",
    },
  ]);
});

test("reports malformed percent-encoding without crashing", () => {
  const root = createFixture({
    "README.md": "[Guide](guide.md#bad%ZZ)\n",
    "guide.md": "# Guide\n",
  });

  const result = checkMarkdownFiles(["README.md"], root);

  assert.deepEqual(result.diagnostics, [
    { path: "README.md", line: 1, kind: "invalid-encoding", target: "guide.md#bad%ZZ" },
  ]);
});

test("resolves duplicate heading slugs with a numeric suffix", () => {
  const root = createFixture({
    "README.md": "[Second section](guide.md#repeat-1)\n",
    "guide.md": "# Repeat\n# Repeat\n",
  });

  const result = checkMarkdownFiles(["README.md"], root);

  assert.deepEqual(result.diagnostics, []);
});

test("tracks external URLs separately without treating them as local files", () => {
  const root = createFixture({ "README.md": "[Project](https://example.com/docs)\n" });

  const result = checkMarkdownFiles(["README.md"], root);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.externalLinks, [
    { path: "README.md", line: 1, url: "https://example.com/docs" },
  ]);
});

test("tracks external URLs in HTML links separately", () => {
  const root = createFixture({
    "README.md": '<a href="https://example.com">Project</a>\n',
  });

  const result = checkMarkdownFiles(["README.md"], root);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.externalLinks, [
    { path: "README.md", line: 1, url: "https://example.com" },
  ]);
});

test("ignores links inside fenced code blocks", () => {
  const root = createFixture({
    "README.md": "```md\n[Missing](missing.md)\n```\n[Present](guide.md)\n",
    "guide.md": "# Guide\n",
  });

  const result = checkMarkdownFiles(["README.md"], root);

  assert.deepEqual(result.diagnostics, []);
});
