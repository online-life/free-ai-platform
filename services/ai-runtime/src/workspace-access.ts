import { constants } from "node:fs";
import { lstat, open, realpath, rename, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { FileHandle } from "node:fs/promises";

export interface WorkspacePermissions {
  read: boolean;
  write: boolean;
  delete: boolean;
  execute?: boolean;
}

export interface WorkspaceAuditEntry {
  operation: "READ" | "WRITE" | "DELETE" | "LIST" | "EXECUTE";
  relativePath: string;
  allowed: boolean;
  reason: string;
  occurredAt: string;
}

export type WorkspaceAudit = (entry: WorkspaceAuditEntry) => void | Promise<void>;

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const O_NOFOLLOW = constants.O_NOFOLLOW;
const O_DIRECTORY = constants.O_DIRECTORY;
const FD_ROOT = "/proc/self/fd";

/**
 * Linux-only, descriptor-anchored workspace file access.
 * This prevents path traversal and symlink following for these file operations.
 * It does not create a process sandbox; untrusted commands must use the
 * Runtime's separately enforced OS sandbox handler.
 */
export class LinuxWorkspaceAccess {
  private constructor(
    readonly rootPath: string,
    private readonly root: FileHandle,
    private readonly rootDevice: number,
    private readonly permissions: WorkspacePermissions,
    private readonly audit: WorkspaceAudit,
  ) {}

  static async open(
    selectedPath: string,
    permissions: WorkspacePermissions,
    audit: WorkspaceAudit = () => undefined,
  ): Promise<LinuxWorkspaceAccess> {
    if (process.platform !== "linux" || !O_NOFOLLOW || !O_DIRECTORY) {
      throw new Error("WORKSPACE_SECURE_FILESYSTEM_UNSUPPORTED");
    }

    const selected = path.resolve(selectedPath);
    const initial = await lstat(selected);
    if (initial.isSymbolicLink() || !initial.isDirectory()) {
      throw new Error("WORKSPACE_ROOT_MUST_BE_REAL_DIRECTORY");
    }

    const canonical = await realpath(selected);
    const root = await open(canonical, constants.O_RDONLY | O_DIRECTORY | O_NOFOLLOW);
    try {
      const openedPath = await realpath(`${FD_ROOT}/${root.fd}`);
      const openedStat = await root.stat();
      if (openedPath !== canonical || !openedStat.isDirectory()) {
        throw new Error("WORKSPACE_ROOT_CHANGED_DURING_OPEN");
      }
      return new LinuxWorkspaceAccess(canonical, root, openedStat.dev, permissions, audit);
    } catch (error) {
      await root.close();
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.root.close();
  }

  async readFile(relativePath: string): Promise<Buffer> {
    return this.record("READ", relativePath, async () => {
      this.requirePermission("read");
      const { parent, name } = await this.openParent(relativePath);
      try {
        const file = await open(`${FD_ROOT}/${parent.fd}/${name}`, constants.O_RDONLY | O_NOFOLLOW);
        try {
          await this.assertFileInside(file);
          const stat = await file.stat();
          if (!stat.isFile() || stat.nlink !== 1) throw new Error("WORKSPACE_FILE_TYPE_DENIED");
          if (stat.size > MAX_FILE_BYTES) throw new Error("WORKSPACE_FILE_TOO_LARGE");
          return await file.readFile();
        } finally {
          await file.close();
        }
      } finally {
        await parent.close();
      }
    });
  }

  async writeFile(relativePath: string, content: string | Uint8Array): Promise<void> {
    return this.record("WRITE", relativePath, async () => {
      this.requirePermission("write");
      const bytes = typeof content === "string" ? Buffer.from(content, "utf8") : Buffer.from(content);
      if (bytes.byteLength > MAX_FILE_BYTES) throw new Error("WORKSPACE_FILE_TOO_LARGE");

      const { parent, name } = await this.openParent(relativePath);
      const tempName = `.freeai-${randomUUID()}.tmp`;
      const tempPath = `${FD_ROOT}/${parent.fd}/${tempName}`;
      const destination = `${FD_ROOT}/${parent.fd}/${name}`;
      try {
        const temp = await open(tempPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | O_NOFOLLOW, 0o600);
        try {
          await this.assertFileInside(temp);
          await temp.writeFile(bytes);
          await temp.sync();
        } finally {
          await temp.close();
        }

        // rename is anchored to the already-open parent directory. It replaces
        // a destination symlink itself and never follows it.
        await rename(tempPath, destination);
        const written = await open(destination, constants.O_RDONLY | O_NOFOLLOW);
        try {
          await this.assertFileInside(written);
          const stat = await written.stat();
          if (!stat.isFile() || stat.nlink !== 1) throw new Error("WORKSPACE_FILE_TYPE_DENIED");
        } finally {
          await written.close();
        }
      } catch (error) {
        await unlink(tempPath).catch(() => undefined);
        throw error;
      } finally {
        await parent.close();
      }
    });
  }

  async deleteFile(relativePath: string, explicitlyApproved: boolean): Promise<void> {
    return this.record("DELETE", relativePath, async () => {
      this.requirePermission("delete");
      if (explicitlyApproved !== true) throw new Error("WORKSPACE_DELETE_APPROVAL_REQUIRED");

      const { parent, name } = await this.openParent(relativePath);
      const target = `${FD_ROOT}/${parent.fd}/${name}`;
      try {
        const file = await open(target, constants.O_RDONLY | O_NOFOLLOW);
        try {
          await this.assertFileInside(file);
          const stat = await file.stat();
          if (!stat.isFile() || stat.nlink !== 1) throw new Error("WORKSPACE_FILE_TYPE_DENIED");
        } finally {
          await file.close();
        }
        await unlink(target);
      } finally {
        await parent.close();
      }
    });
  }

  async list(relativePath = "."): Promise<Array<{ name: string; type: "file" | "directory" | "symlink" | "other" }>> {
    return this.record("LIST", relativePath, async () => {
      this.requirePermission("read");
      const directory = relativePath === "." ? await this.duplicateRoot() : await this.openDirectory(relativePath);
      try {
        await this.assertDirectoryInside(directory);
        const { readdir } = await import("node:fs/promises");
        const names = await readdir(`${FD_ROOT}/${directory.fd}`);
        const entries = await Promise.all(names.map(async (name) => {
          const stat = await lstat(`${FD_ROOT}/${directory.fd}/${name}`);
          return {
            name,
            type: stat.isSymbolicLink() ? "symlink" as const : stat.isFile() ? "file" as const : stat.isDirectory() ? "directory" as const : "other" as const,
          };
        }));
        return entries.sort((a, b) => a.name.localeCompare(b.name));
      } finally {
        await directory.close();
      }
    });
  }

  private requirePermission(permission: keyof WorkspacePermissions): void {
    if (!this.permissions[permission]) throw new Error(`WORKSPACE_${permission.toUpperCase()}_DENIED`);
  }

  private async openParent(relativePath: string): Promise<{ parent: FileHandle; name: string }> {
    const parts = validateRelativePath(relativePath);
    if (parts.length === 1) return { parent: await this.duplicateRoot(), name: parts[0]! };
    const parentPath = parts.slice(0, -1).join("/");
    return { parent: await this.openDirectory(parentPath), name: parts.at(-1)! };
  }

  private async openDirectory(relativePath: string): Promise<FileHandle> {
    const parts = validateRelativePath(relativePath);
    let current = await this.duplicateRoot();
    try {
      for (const part of parts) {
        const next = await open(`${FD_ROOT}/${current.fd}/${part}`, constants.O_RDONLY | O_DIRECTORY | O_NOFOLLOW);
        await current.close();
        current = next;
        await this.assertDirectoryInside(current);
      }
      return current;
    } catch (error) {
      await current.close().catch(() => undefined);
      throw normalizePathError(error);
    }
  }

  private async duplicateRoot(): Promise<FileHandle> {
    await this.assertDirectoryInside(this.root);
    // The /proc/self/fd entry is itself a kernel-managed symlink to our pinned
    // descriptor. Do not apply O_NOFOLLOW to this trusted descriptor path.
    return open(`${FD_ROOT}/${this.root.fd}`, constants.O_RDONLY | O_DIRECTORY);
  }

  private async assertDirectoryInside(handle: FileHandle): Promise<void> {
    const [resolved, stat] = await Promise.all([
      realpath(`${FD_ROOT}/${handle.fd}`),
      handle.stat(),
    ]);
    if (!isWithin(this.rootPath, resolved) || !stat.isDirectory() || stat.dev !== this.rootDevice) {
      throw new Error("WORKSPACE_PATH_ESCAPE_DENIED");
    }
    const rootNow = await realpath(`${FD_ROOT}/${this.root.fd}`);
    if (rootNow !== this.rootPath) throw new Error("WORKSPACE_ROOT_MOVED");
  }

  private async assertFileInside(handle: FileHandle): Promise<void> {
    const [resolved, stat] = await Promise.all([
      realpath(`${FD_ROOT}/${handle.fd}`),
      handle.stat(),
    ]);
    if (!isWithin(this.rootPath, resolved) || stat.dev !== this.rootDevice) {
      throw new Error("WORKSPACE_PATH_ESCAPE_DENIED");
    }
  }

  private async record<T>(operation: WorkspaceAuditEntry["operation"], rawPath: string, fn: () => Promise<T>): Promise<T> {
    let allowed = false;
    let reason = "OK";
    try {
      const result = await fn();
      allowed = true;
      return result;
    } catch (error) {
      const normalized = normalizePathError(error);
      reason = normalized.message;
      throw normalized;
    } finally {
      await this.audit({
        operation,
        relativePath: safeAuditPath(rawPath),
        allowed,
        reason,
        occurredAt: new Date().toISOString(),
      });
    }
  }
}

function validateRelativePath(value: string): string[] {
  if (typeof value !== "string" || !value || value.includes("\0") || path.isAbsolute(value) || path.win32.isAbsolute(value)) {
    throw new Error("WORKSPACE_RELATIVE_PATH_REQUIRED");
  }
  const parts = value.split(/[\\/]/);
  if (parts.some((part) => !part || part === "." || part === ".." || /^[a-zA-Z]:/.test(part))) {
    throw new Error("WORKSPACE_PATH_TRAVERSAL_DENIED");
  }
  return parts;
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function safeAuditPath(value: string): string {
  if (typeof value !== "string" || value.includes("\0")) return "[invalid-path]";
  return value.slice(0, 512);
}

function normalizePathError(error: unknown): Error {
  if (error instanceof Error && error.message.startsWith("WORKSPACE_")) return error;
  const code = (error as NodeJS.ErrnoException | null)?.code;
  if (code === "ELOOP") return new Error("WORKSPACE_SYMLINK_DENIED");
  if (code === "EACCES" || code === "EPERM") return new Error("WORKSPACE_ACCESS_DENIED");
  if (code === "ENOENT" || code === "ENOTDIR") return new Error("WORKSPACE_PATH_NOT_FOUND");
  return error instanceof Error ? error : new Error("WORKSPACE_OPERATION_FAILED");
}
