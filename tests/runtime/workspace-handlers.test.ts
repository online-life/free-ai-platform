import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { registerWorkspaceHandlers } from "../../services/ai-runtime/src/workspace-handlers.js";
import { loadWorkspaceBindings } from "../../services/ai-runtime/src/workspace-bindings-config.js";
import type { RuntimeJobHandler } from "../../services/ai-runtime/src/runtime-client.js";

const key = "workspace-test-key-123456";
const envelope = (operation: Record<string, unknown>, overrides: Record<string, unknown> = {}) => ({
  workspaceBinding: { rootAlias: "project", workspaceKey: key, canRead: true, canWrite: true, canDelete: true, ...overrides },
  operation,
});

describe("workspace runtime handlers", () => {
it("bind paths locally and enforce permissions and approval", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "freeai-workspace-handler-"));
  const root = path.join(base, "workspace");
  await mkdir(root);
  const handlers = new Map<string, RuntimeJobHandler>();
  const audit: string[] = [];
  registerWorkspaceHandlers({ registerHandler: (kind, handler) => { handlers.set(kind, handler); } }, {
    project: { path: root, workspaceKey: key, permissions: { read: true, write: true, delete: false } },
  }, (entry) => { audit.push(`${entry.operation}:${entry.allowed}`); });
  const run = (kind: string, payload: unknown) => handlers.get(kind)!(payload, new AbortController().signal);
  try {
    await run("WORKSPACE_WRITE", envelope({ relativePath: "notes.txt", content: "inside workspace" }));
    expect(await readFile(path.join(root, "notes.txt"), "utf8")).toBe("inside workspace");
    const listed = await run("WORKSPACE_LIST", envelope({})) as { entries: Array<{ name: string }> };
    expect(listed.entries[0]?.name).toBe("notes.txt");
    await assert.rejects(run("WORKSPACE_READ", envelope({ relativePath: "notes.txt" }, { workspaceKey: "other-workspace-key-123" })), /WORKSPACE_BINDING_NOT_FOUND/);
    await assert.rejects(run("WORKSPACE_DELETE", envelope({ relativePath: "notes.txt", approved: true })), /WORKSPACE_DELETE_DENIED/);
    const deleteCapable = { project: { path: root, workspaceKey: key, permissions: { read: true, write: true, delete: true } } };
    const deleteHandlers = new Map<string, RuntimeJobHandler>();
    registerWorkspaceHandlers({ registerHandler: (kind, handler) => { deleteHandlers.set(kind, handler); } }, deleteCapable);
    await assert.rejects(deleteHandlers.get("WORKSPACE_DELETE")!(envelope({ relativePath: "notes.txt", approved: false }), new AbortController().signal), /WORKSPACE_DELETE_APPROVAL_REQUIRED/);
    expect(audit).toContain("WRITE:true");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

it("requires a private, strict local config file", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "freeai-workspace-config-"));
  const file = path.join(base, "bindings.json");
  try {
    await writeFile(file, JSON.stringify({ project: { path: "/srv/project", workspaceKey: key, permissions: { read: true, write: false, delete: false } } }), { mode: 0o600 });
    expect(await loadWorkspaceBindings(file)).toEqual({ project: { path: "/srv/project", workspaceKey: key, permissions: { read: true, write: false, delete: false, execute: false }, commands: {} } });
    await writeFile(file, JSON.stringify({ project: { path: "/srv/project", workspaceKey: key, permissions: { read: true, write: false, delete: true } } }), { mode: 0o600 });
    await assert.rejects(loadWorkspaceBindings(file), /WORKSPACE_CONFIG_INVALID/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
});
