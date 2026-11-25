import { z } from "zod";

export const CreatePairingSchema = z.object({}).strict();

export const EnrollRuntimeSchema = z.object({
  pairingCode: z.string().min(40).max(100),
  name: z.string().trim().min(1).max(120),
  operatingSystem: z.enum(["linux", "darwin", "win32"]),
  architecture: z.string().regex(/^[a-zA-Z0-9_-]{2,30}$/),
  runtimeVersion: z.string().regex(/^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/),
}).strict();

export const RuntimeHeartbeatSchema = z.object({
  runtimeVersion: z.string().max(80),
  health: z.enum(["healthy", "degraded"]),
  activeJobIds: z.array(z.string().uuid()).max(100),
}).strict();

export const RuntimeJobReportSchema = z.object({
  status: z.enum(["RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"]),
  result: z.unknown().optional(),
  errorCode: z.string().regex(/^[A-Z0-9_]{2,100}$/).optional(),
}).strict();

export const SandboxProcessPayloadSchema = z.object({
  commandKey: z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/),
  args: z.array(z.string().max(8192)).max(256),
  timeoutMs: z.number().int().min(1000).max(300_000).default(60_000),
  approved: z.literal(true),
}).strict();

export const LocalWorkspaceSchema = z.object({
  deviceId: z.string().uuid(),
  projectId: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(120),
  rootAlias: z.string().trim().min(1).max(120).regex(/^[^/\\:]+$/),
  workspaceKey: z.string().regex(/^[a-zA-Z0-9_-]{16,128}$/),
  canRead: z.boolean().default(true),
  canWrite: z.boolean().default(false),
  canDelete: z.boolean().default(false),
  canExecute: z.boolean().default(false),
}).strict();

export const RuntimeJobCreateSchema = z.object({
  deviceId: z.string().uuid(),
  projectId: z.string().min(1).max(100),
  workspaceId: z.string().uuid(),
  kind: z.enum(["RUNTIME_HEALTH_CHECK", "WORKSPACE_LIST", "WORKSPACE_READ", "WORKSPACE_WRITE", "WORKSPACE_DELETE", "SANDBOX_PROCESS"]),
  payload: z.record(z.string(), z.unknown()).default({}),
  idempotencyKey: z.string().min(16).max(160),
}).strict();
