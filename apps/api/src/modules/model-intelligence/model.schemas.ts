import { z } from "zod";

export const ModelCapabilitySchema = z.enum([
  "TEXT_GENERATION",
  "REASONING",
  "CODE_GENERATION",
  "VISION",
  "IMAGE_GENERATION",
  "AUDIO_INPUT",
  "AUDIO_OUTPUT",
  "VIDEO_INPUT",
  "EMBEDDINGS",
  "TOOL_CALLING",
  "STRUCTURED_OUTPUT",
  "LONG_CONTEXT",
]);

export const ModelDefinitionSchema = z.object({
  key: z.string().min(2).max(120),
  displayName: z.string().min(2).max(160),
  capabilities: z.array(ModelCapabilitySchema).min(1),
  contextWindow: z.number().int().positive(),
  maxOutputTokens: z.number().int().positive(),
  freeTier: z.boolean(),
  enabled: z.boolean().default(true),
  qualityScore: z.number().min(0).max(100).default(50),
  latencyScore: z.number().min(0).max(100).default(50),
  reliabilityScore: z.number().min(0).max(100).default(50),
  metadata: z.record(z.string(), z.unknown()).default({}),
}).strict();

export const ModelSelectionRequestSchema = z.object({
  capabilities: z.array(ModelCapabilitySchema).min(1),
  minimumContext: z.number().int().positive().default(1),
  minimumOutputTokens: z.number().int().positive().default(1),
  preferReasoning: z.boolean().default(false),
  requireFree: z.boolean().default(true),
  excludedModels: z.array(z.string()).default([]),
  routeMode: z.enum(["BALANCED", "BEST_QUALITY", "BEST_SPEED", "LOWEST_COST"]).default("BALANCED"),
  providerKey: z.string().min(1).optional(),
  modelKey: z.string().min(1).max(160).optional(),
  weights: z.object({
    quality: z.number().min(0).max(1).default(0.4),
    reliability: z.number().min(0).max(1).default(0.3),
    latency: z.number().min(0).max(1).default(0.2),
    cost: z.number().min(0).max(1).default(0.1),
  }).default({ quality: 0.4, reliability: 0.3, latency: 0.2, cost: 0.1 }),
  requirePrivacyApproved: z.boolean().default(true),
}).strict();

export type ModelDefinition = z.infer<typeof ModelDefinitionSchema>;
export type ModelSelectionRequest = z.infer<typeof ModelSelectionRequestSchema>;
