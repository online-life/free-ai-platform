import { z } from "zod";

export const AgentStatusSchema = z.enum([
  "DRAFT", "ACTIVE", "DISABLED", "DEPRECATED", "ARCHIVED",
]);

export const AgentCapabilitySchema = z.enum([
  "REASONING",
  "CODING",
  "RESEARCH",
  "PLANNING",
  "WRITING",
  "ANALYSIS",
  "DATA_PROCESSING",
  "TESTING",
  "DOCUMENTATION",
  "IMAGE",
  "AUDIO",
  "VIDEO",
  "BROWSER",
  "TOOL_USE",
]);

export const AgentDefinitionSchema = z.object({
  key: z.string().min(2).max(100).regex(/^[a-z0-9._-]+$/),
  name: z.string().min(2).max(160),
  description: z.string().max(10000),
  systemInstructions: z.string().min(1).max(50000),
  capabilities: z.array(AgentCapabilitySchema).min(1),
  allowedTools: z.array(z.string()).default([]),
  inputSchema: z.record(z.string(), z.unknown()).default({}),
  outputSchema: z.record(z.string(), z.unknown()).default({}),
  configuration: z.record(z.string(), z.unknown()).default({}),
}).strict();

export const AgentVersionSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  changelog: z.string().max(10000).default(""),
  definition: AgentDefinitionSchema,
}).strict();

export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;
export type AgentVersion = z.infer<typeof AgentVersionSchema>;
export type AgentCapability = z.infer<typeof AgentCapabilitySchema>;
