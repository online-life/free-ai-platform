import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { LinuxWorkspaceAccess, type WorkspaceAuditEntry } from "../../services/ai-runtime/src/workspace-access";

const linux = process.platform === "linux";
const permissions = { read: true, write: true, delete: true };
let base = "";
let projectA = "";
let projectB = "";
let workspace: LinuxWorkspaceAccess;
const auditEntries: WorkspaceAuditEntry[] = [];

describe.skipIf(!linux)("Linux workspace filesystem access", () => {
  beforeAll(async () => {
    base = await mkdtemp(path.join(os.tmpdir(), "freeai-workspace-test-"));
    projectA = path.join(base, "project-a");
    projectB = path.join(base, "project-b");
    await mkdir(projectA);
    await mkdir(projectB);
    await mkdir(path.join(projectA, "src"));
    await writeFile(path.join(projectA, "src", "readme.txt"), "inside-a");
    await writeFile(path.join(projectB, "secret.txt"), "inside-b-secret");
    await symlink(projectB, path.join(projectA, "other-project"));
    workspace = await LinuxWorkspaceAccess.open(projectA, permissions, (entry) => auditEntries.push(entry));
  });

  afterAll(async () => {
    await workspace?.close();
    if (base) await rm(base, { recursive: true, force: true });
  });

  it("reads and atomically writes only within the selected project directory", async () => {
    await expect(workspace.readFile("src/readme.txt")).resolves.toEqual(Buffer.from("inside-a"));
    await workspace.writeFile("src/new.txt", "runtime-output");
    await expect(readFile(path.join(projectA, "src", "new.txt"), "utf8")).resolves.toBe("runtime-output");
    await expect(workspace.readFile("../project-b/secret.txt")).rejects.toThrow("WORKSPACE_PATH_TRAVERSAL_DENIED");
    await expect(workspace.readFile("other-project/secret.txt")).rejects.toThrow();
    await expect(readFile(path.join(projectB, "secret.txt"), "utf8")).resolves.toBe("inside-b-secret");
  });

  it("requires separate permissions and explicit approval for deletion", async () => {
    await workspace.writeFile("src/delete-me.txt", "temporary");
    await expect(workspace.deleteFile("src/delete-me.txt", false)).rejects.toThrow("WORKSPACE_DELETE_APPROVAL_REQUIRED");
    await expect(readFile(path.join(projectA, "src", "delete-me.txt"), "utf8")).resolves.toBe("temporary");
    await workspace.deleteFile("src/delete-me.txt", true);
    await expect(readFile(path.join(projectA, "src", "delete-me.txt"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });

    const readOnly = await LinuxWorkspaceAccess.open(projectA, { read: true, write: false, delete: false });
    try {
      await expect(readOnly.writeFile("src/readme.txt", "blocked")).rejects.toThrow("WORKSPACE_WRITE_DENIED");
      await expect(readOnly.deleteFile("src/readme.txt", true)).rejects.toThrow("WORKSPACE_DELETE_DENIED");
    } finally {
      await readOnly.close();
    }
  });

  it("blocks symlink escape on reads and writes and records denied operations", async () => {
    await expect(workspace.readFile("other-project/secret.txt")).rejects.toThrow();
    await expect(workspace.writeFile("other-project/new-secret.txt", "must-not-write")).rejects.toThrow();
    await expect(readFile(path.join(projectB, "new-secret.txt"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });

    const listing = await workspace.list();
    expect(listing.find((entry) => entry.name === "other-project")?.type).toBe("symlink");
    expect(auditEntries.some((entry) => entry.operation === "READ" && !entry.allowed)).toBe(true);
    expect(auditEntries.some((entry) => entry.operation === "WRITE" && !entry.allowed)).toBe(true);
    expect(auditEntries.some((entry) => entry.operation === "DELETE" && !entry.allowed)).toBe(true);
  });

  it("does not read outside data while a parent directory is being swapped", async () => {
    const moving = path.join(projectA, "moving");
    const parked = path.join(projectA, "moving-parked");
    const outside = path.join(projectB, "outside-dir");
    await mkdir(moving);
    await mkdir(outside);
    await writeFile(path.join(moving, "value.txt"), "inside-value");
    await writeFile(path.join(outside, "value.txt"), "OUTSIDE-SECRET");

    let stop = false;
    const attacker = (async () => {
      while (!stop) {
        try {
          await rename(moving, parked);
          await symlink(outside, moving);
          await rm(moving);
          await rename(parked, moving);
        } catch {
          await rm(moving, { force: true }).catch(() => undefined);
          await rename(parked, moving).catch(() => undefined);
        }
      }
    })();

    try {
      const results = await Promise.all(Array.from({ length: 50 }, async () => {
        try {
          return (await workspace.readFile("moving/value.txt")).toString("utf8");
        } catch {
          return "DENIED";
        }
      }));
      expect(results).not.toContain("OUTSIDE-SECRET");
      expect(results.every((result) => result === "inside-value" || result === "DENIED")).toBe(true);
    } finally {
      stop = true;
      await attacker;
      await rm(moving, { recursive: true, force: true });
      await rename(parked, moving).catch(() => undefined);
    }
  });
});
