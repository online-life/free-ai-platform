import { z } from "zod";

export const ExecutionStatusSchema = z.enum([
  "QUEUED", "PREPARING", "RUNNING", "SUCCEEDED",
  "FAILED", "CANCELLED", "TIMED_OUT",
]);

export const ExecutionRequestSchema = z.object({
  projectId: z.string().min(1),
  taskId: z.string().min(1).optional(),
  agentId: z.string().min(1).optional(),
  input: z.unknown(),
  timeoutMs: z.number().int().min(1000).max(3600000).default(120000),
  memoryLimitMb: z.number().int().min(64).max(32768).default(1024),
  cpuLimit: z.number().positive().max(16).default(1),
  networkAccess: z.boolean().default(false),
  allowedTools: z.array(z.string()).default([]),
}).strict();

export const ToolDefinitionSchema = z.object({
  key: z.string().min(2).max(100),
  description: z.string().max(5000),
  inputSchema: z.record(z.string(), z.unknown()),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  requiresApproval: z.boolean().default(false),
  enabled: z.boolean().default(true),
}).strict();

export type ExecutionRequest = z.infer<typeof ExecutionRequestSchema>;
export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;
