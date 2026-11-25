import { LinuxWorkspaceAccess, type WorkspaceAuditEntry, type WorkspacePermissions } from "./workspace-access.js";
import type { LocalRuntime } from "./runtime-client.js";
import { runSandboxedProcess } from "./process-sandbox.js";

export interface LocalWorkspaceBinding {
  path: string;
  workspaceKey: string;
  permissions: WorkspacePermissions;
  commands?: Record<string, string>;
}

export type LocalWorkspaceBindings = Record<string, LocalWorkspaceBinding>;
export type WorkspaceOperationAudit = (entry: WorkspaceAuditEntry & { rootAlias: string }) => void | Promise<void>;

export function registerWorkspaceHandlers(
  runtime: Pick<LocalRuntime, "registerHandler">,
  bindings: LocalWorkspaceBindings,
  audit: WorkspaceOperationAudit = () => undefined,
): void {
  runtime.registerHandler("WORKSPACE_LIST", async (payload) => {
    const { access, input, logs } = await openBoundWorkspace(payload, bindings, audit);
    try { return { entries: await access.list(optionalRelativePath(input.relativePath)), logs }; }
    finally { await access.close(); }
  });
  runtime.registerHandler("WORKSPACE_READ", async (payload) => {
    const { access, input, logs } = await openBoundWorkspace(payload, bindings, audit);
    try {
      const contents = await access.readFile(requiredRelativePath(input.relativePath));
      return { encoding: "base64", contents: contents.toString("base64"), logs };
    } finally { await access.close(); }
  });
  runtime.registerHandler("WORKSPACE_WRITE", async (payload) => {
    const { access, input, logs } = await openBoundWorkspace(payload, bindings, audit);
    try {
      if (typeof input.content !== "string") throw new Error("WORKSPACE_CONTENT_INVALID");
      await access.writeFile(requiredRelativePath(input.relativePath), input.content);
      return { written: true, logs };
    } finally { await access.close(); }
  });
  runtime.registerHandler("WORKSPACE_DELETE", async (payload) => {
    const { access, input, logs } = await openBoundWorkspace(payload, bindings, audit);
    try {
      await access.deleteFile(requiredRelativePath(input.relativePath), input.approved === true);
      return { deleted: true, logs };
    } finally { await access.close(); }
  });
  runtime.registerHandler("SANDBOX_PROCESS", async (payload, signal) => {
    const { access, rootAlias, input, logs, local, effectivePermissions } = await openBoundWorkspace(payload, bindings, audit);
    const commandKey = typeof input.commandKey === "string" ? input.commandKey : "";
    const addAudit = async (allowed: boolean, reason: string) => {
      const entry: WorkspaceAuditEntry & { rootAlias: string } = {
        operation: "EXECUTE", relativePath: commandKey, allowed, reason, occurredAt: new Date().toISOString(), rootAlias,
      };
      logs.push(entry);
      await audit(entry);
    };
    try {
      if (!effectivePermissions.execute) throw new Error("WORKSPACE_EXECUTION_DENIED");
      if (input.approved !== true) throw new Error("SANDBOX_PROCESS_APPROVAL_REQUIRED");
      const executable = local.commands?.[commandKey];
      if (!executable) throw new Error("SANDBOX_COMMAND_NOT_ALLOWED");
      const args = processArguments(input.args);
      const timeoutMs = input.timeoutMs === undefined ? 60_000 : boundedInteger(input.timeoutMs, 1000, 300_000, "SANDBOX_TIMEOUT_INVALID");
      const workspacePath = access.rootPath;
      await access.close();
      await addAudit(true, "APPROVED");
      const result = await runSandboxedProcess({ executable, args, workspacePath, timeoutMs, signal });
      const output = { ...result, logs };
      if (result.timedOut) throw new SandboxProcessFailure("SANDBOX_TIMEOUT", output);
      if (result.outputLimitExceeded) throw new SandboxProcessFailure("SANDBOX_OUTPUT_LIMIT_EXCEEDED", output);
      if (result.code !== 0) throw new SandboxProcessFailure("SANDBOX_PROCESS_NONZERO_EXIT", output);
      return output;
    } catch (error) {
      const code = error instanceof Error && /^[A-Z0-9_]{2,100}$/.test(error.message) ? error.message : "SANDBOX_PROCESS_FAILED";
      if (!logs.some((entry) => entry.operation === "EXECUTE")) await addAudit(false, code).catch(() => undefined);
      throw error;
    } finally {
      await access.close().catch(() => undefined);
    }
  });
}

async function openBoundWorkspace(
  raw: unknown,
  bindings: LocalWorkspaceBindings,
  audit: WorkspaceOperationAudit,
) {
  const payload = record(raw);
  const binding = record(payload.workspaceBinding);
  const rootAlias = boundedString(binding.rootAlias, 120);
  const workspaceKey = boundedString(binding.workspaceKey, 128);
  const local = bindings[rootAlias];
  if (!local || local.workspaceKey !== workspaceKey || !pathIsAbsolute(local.path)) {
    throw new Error("WORKSPACE_BINDING_NOT_FOUND");
  }
  const serverPermissions = {
    read: binding.canRead === true,
    write: binding.canWrite === true,
    delete: binding.canDelete === true,
    execute: binding.canExecute === true,
  };
  const effectivePermissions = {
    read: serverPermissions.read && local.permissions.read,
    write: serverPermissions.write && local.permissions.write,
    delete: serverPermissions.delete && local.permissions.delete,
    execute: serverPermissions.execute && local.permissions.execute === true,
  };
  const workspaceLogs: Array<WorkspaceAuditEntry & { rootAlias: string }> = [];
  const access = await LinuxWorkspaceAccess.open(local.path, effectivePermissions, async (entry) => {
    const augmented = { ...entry, rootAlias };
    workspaceLogs.push(augmented);
    await audit(augmented);
  });
  return { access, rootAlias, input: record(payload.operation), logs: workspaceLogs, local, effectivePermissions };
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function boundedString(value: unknown, maximum: number): string {
  if (typeof value !== "string" || !value || value.length > maximum) throw new Error("WORKSPACE_BINDING_INVALID");
  return value;
}

function requiredRelativePath(value: unknown): string {
  if (typeof value !== "string" || !value || value.length > 1024) throw new Error("WORKSPACE_RELATIVE_PATH_REQUIRED");
  return value;
}

function optionalRelativePath(value: unknown): string {
  if (value === undefined) return ".";
  return requiredRelativePath(value);
}

function pathIsAbsolute(value: string): boolean {
  return value.startsWith("/");
}

function processArguments(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 256 || value.some((argument) => typeof argument !== "string" || argument.length > 8192)) {
    throw new Error("SANDBOX_PROCESS_ARGS_INVALID");
  }
  return value as string[];
}

function boundedInteger(value: unknown, minimum: number, maximum: number, code: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) throw new Error(code);
  return value as number;
}

export class SandboxProcessFailure extends Error {
  constructor(message: string, readonly result: unknown) { super(message); }
}
