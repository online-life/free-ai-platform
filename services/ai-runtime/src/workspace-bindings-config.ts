import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import type { LocalWorkspaceBindings } from "./workspace-handlers.js";

/** Load host-local workspace paths without ever sending them to the API. */
export async function loadWorkspaceBindings(filePath: string): Promise<LocalWorkspaceBindings> {
  if (process.platform !== "linux" || !path.isAbsolute(filePath)) throw new Error("WORKSPACE_CONFIG_PATH_INVALID");
  const handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.nlink !== 1 || process.getuid?.() !== stat.uid || (stat.mode & 0o077) !== 0 || stat.size > 1024 * 1024) {
      throw new Error("WORKSPACE_CONFIG_FILE_UNSAFE");
    }
    const raw: unknown = JSON.parse(await handle.readFile("utf8"));
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error("WORKSPACE_CONFIG_INVALID");
    const bindings: LocalWorkspaceBindings = {};
    for (const [alias, value] of Object.entries(raw)) {
      if (!/^[^/\\:]{1,120}$/.test(alias) || typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("WORKSPACE_CONFIG_INVALID");
      const binding = value as Record<string, unknown>;
      if (typeof binding.path !== "string" || !path.isAbsolute(binding.path)
        || typeof binding.workspaceKey !== "string" || !/^[a-zA-Z0-9_-]{16,128}$/.test(binding.workspaceKey)
        || typeof binding.permissions !== "object" || binding.permissions === null || Array.isArray(binding.permissions)) throw new Error("WORKSPACE_CONFIG_INVALID");
      const permissions = binding.permissions as Record<string, unknown>;
      const execute = permissions.execute === undefined ? false : permissions.execute;
      if (typeof permissions.read !== "boolean" || typeof permissions.write !== "boolean" || typeof permissions.delete !== "boolean" || typeof execute !== "boolean"
        || (permissions.write && !permissions.read) || (permissions.delete && (!permissions.write || !permissions.read))
        || (execute && (!permissions.write || !permissions.read))) throw new Error("WORKSPACE_CONFIG_INVALID");
      const commands = await loadCommandAllowlist(binding.commands);
      bindings[alias] = { path: binding.path, workspaceKey: binding.workspaceKey, permissions: { read: permissions.read, write: permissions.write, delete: permissions.delete, execute }, commands };
    }
    return bindings;
  } finally {
    await handle.close();
  }
}

async function loadCommandAllowlist(value: unknown): Promise<Record<string, string>> {
  if (value === undefined) return {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("WORKSPACE_COMMAND_ALLOWLIST_INVALID");
  const commands: Record<string, string> = {};
  for (const [key, executablePath] of Object.entries(value)) {
    if (!/^[a-z][a-z0-9_-]{0,31}$/.test(key) || typeof executablePath !== "string" || !path.isAbsolute(executablePath)) {
      throw new Error("WORKSPACE_COMMAND_ALLOWLIST_INVALID");
    }
    const canonical = await realpath(executablePath);
    const executable = await stat(canonical);
    if (!canonical.startsWith("/usr/") || !executable.isFile() || (executable.mode & 0o111) === 0) {
      throw new Error("WORKSPACE_COMMAND_ALLOWLIST_INVALID");
    }
    commands[key] = canonical;
  }
  return commands;
}
