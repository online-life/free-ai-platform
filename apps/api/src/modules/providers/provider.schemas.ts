import { z } from "zod";
import { isIP } from "node:net";

export const ProviderStatusSchema = z.enum([
  "ACTIVE", "DISABLED", "DEGRADED", "SUSPENDED",
]);

export const ProviderBillingModeSchema = z.enum([
  "FREE", "FREE_LIMITED", "FREE_TRIAL", "CREDITS", "PAY_PER_TOKEN",
  "PAY_PER_REQUEST", "SUBSCRIPTION", "SELF_HOSTED", "UNKNOWN",
]);

export const ProviderFreeTierStatusSchema = z.enum([
  "VERIFIED_FREE", "VERIFIED_LIMITED", "TRIAL", "PAID", "UNKNOWN",
]);

const ProviderDefinitionFieldsSchema = z.object({
  key: z.string().min(2).max(100).regex(/^[a-z0-9._-]+$/),
  name: z.string().min(2).max(160),
  providerType: z.enum(["OPENAI_COMPATIBLE", "LOCAL_OPENAI_COMPATIBLE"]),
  baseUrl: z.string().url().superRefine((value, context) => {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      context.addIssue({ code: "custom", message: "Provider URL is invalid" });
      return;
    }
    const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    const loopback = ["localhost", "127.0.0.1", "::1"].includes(hostname);
    if (isIP(hostname) && !loopback) {
      context.addIssue({ code: "custom", message: "Use a DNS provider hostname or explicit loopback endpoint" });
    }
    if (url.username || url.password || url.hash || (url.protocol !== "https:" && !(loopback && url.protocol === "http:"))) {
      context.addIssue({ code: "custom", message: "Provider URL must use HTTPS and contain no credentials" });
    }
  }),
  authenticationType: z.enum(["BEARER", "NONE"]).default("BEARER"),
  billingMode: ProviderBillingModeSchema.default("UNKNOWN"),
  freeTierStatus: ProviderFreeTierStatusSchema.default("UNKNOWN"),
  timeoutMs: z.number().int().min(1000).max(300000).default(60000),
  maxRetries: z.number().int().min(0).max(3).default(0),
  apiKey: z.string().min(1).max(4096).optional(),
  apiVersion: z.string().max(80).optional(),
  customHeaders: z.record(z.string(), z.string())
    .refine((headers) => Object.keys(headers).every((key) => !/(authorization|api[-_]?key|token|secret)/i.test(key)),
      "Authentication headers must be stored as encrypted secrets"),
  metadata: z.record(z.string(), z.unknown()).default({}),
  pricingMetadata: z.record(z.string(), z.unknown()).default({}),
  privacyMetadata: z.record(z.string(), z.unknown()).default({}),
}).strict();

export const ProviderDefinitionSchema = ProviderDefinitionFieldsSchema.superRefine((definition, context) => {
  const localEndpoint = isLocalProviderEndpoint(definition.baseUrl);
  if (definition.providerType === "LOCAL_OPENAI_COMPATIBLE" && !localEndpoint) {
    context.addIssue({ code: "custom", path: ["baseUrl"], message: "Local provider endpoints must use loopback" });
  }
  if (localEndpoint && definition.providerType !== "LOCAL_OPENAI_COMPATIBLE") {
    context.addIssue({ code: "custom", path: ["baseUrl"], message: "Loopback endpoints require an explicit local provider connector" });
  }
});

export function isLocalProviderEndpoint(value: string): boolean {
  let url: URL;
  try { url = new URL(value); } catch { return false; }
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "::1") return true;
  return isIP(hostname) === 4 && hostname.startsWith("127.");
}

export const ProviderUpdateSchema = ProviderDefinitionFieldsSchema
  .omit({ apiKey: true })
  .partial()
  .strict()
  .superRefine((value, context) => {
    if (!Object.keys(value).length) context.addIssue({ code: "custom", message: "At least one provider field is required" });
    if (value.providerType === "LOCAL_OPENAI_COMPATIBLE" && value.baseUrl && !isLocalProviderEndpoint(value.baseUrl)) {
      context.addIssue({ code: "custom", path: ["baseUrl"], message: "Local provider endpoints must use loopback" });
    }
    if (value.providerType === "OPENAI_COMPATIBLE" && value.baseUrl && isLocalProviderEndpoint(value.baseUrl)) {
      context.addIssue({ code: "custom", path: ["baseUrl"], message: "Loopback endpoints require an explicit local provider connector" });
    }
  });

export const GatewayRequestSchema = z.object({
  providerKey: z.string().min(1),
  modelKey: z.string().min(1),
  operation: z.enum([
    "CHAT", "EMBEDDINGS", "IMAGE", "AUDIO", "STRUCTURED",
  ]),
  messages: z.array(z.object({
    role: z.enum(["system", "user", "assistant", "tool"]),
    content: z.unknown(),
  })).optional(),
  input: z.unknown().optional(),
  parameters: z.record(z.string(), z.unknown()).default({}),
  requestId: z.string().min(1),
}).strict().superRefine((value, context) => {
  const maxTokens = value.parameters.max_tokens;
  const maxCompletionTokens = value.parameters.max_completion_tokens;
  for (const [name, tokenLimit] of [
    ["max_tokens", maxTokens],
    ["max_completion_tokens", maxCompletionTokens],
  ] as const) {
    if (tokenLimit !== undefined &&
        (typeof tokenLimit !== "number" || !Number.isSafeInteger(tokenLimit) || tokenLimit <= 0)) {
      context.addIssue({ code: "custom", path: ["parameters", name], message: "Token limit must be a positive integer" });
    }
  }
  if (maxTokens !== undefined && maxCompletionTokens !== undefined) {
    context.addIssue({ code: "custom", path: ["parameters"], message: "Use one output token limit field" });
  }
  if (value.parameters.stream === true) {
    context.addIssue({ code: "custom", path: ["parameters", "stream"], message: "Streaming is not supported by this gateway adapter" });
  }
});

export const ProviderModelDefinitionSchema = z.object({
  modelId: z.string().trim().min(1).max(160),
  displayName: z.string().trim().min(1).max(180),
  family: z.string().max(100).optional(),
  version: z.string().max(100).optional(),
  contextWindow: z.number().int().positive().nullable().optional(),
  maxOutputTokens: z.number().int().positive().nullable().optional(),
  inputModalities: z.array(z.string().max(40)).default([]),
  outputModalities: z.array(z.string().max(40)).default([]),
  capabilities: z.array(z.string().max(60)).default([]),
  features: z.record(z.string(), z.boolean()).default({}),
  billingMode: ProviderBillingModeSchema.default("UNKNOWN"),
  freeTierStatus: ProviderFreeTierStatusSchema.default("UNKNOWN"),
  inputPricePerMillion: z.number().nonnegative().nullable().optional(),
  outputPricePerMillion: z.number().nonnegative().nullable().optional(),
  privacyApproved: z.boolean().default(false),
  officialDocumentationUrl: z.string().url().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
}).strict();

export type ProviderDefinition = z.infer<typeof ProviderDefinitionSchema>;
export type GatewayRequest = z.infer<typeof GatewayRequestSchema>;
