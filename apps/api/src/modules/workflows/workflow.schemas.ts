import { z } from "zod";

export const WorkflowStatusSchema = z.enum([
  "DRAFT", "ACTIVE", "DISABLED", "ARCHIVED",
]);

export const WorkflowRunStatusSchema = z.enum([
  "PENDING",
  "RUNNING",
  "WAITING_APPROVAL",
  "PAUSED",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
]);

export const WorkflowStepTypeSchema = z.enum([
  "AGENT",
  "MODEL",
  "TOOL",
  "EXECUTION",
  "CONDITION",
  "APPROVAL",
  "WAIT",
  "NOTIFICATION",
]);

export const WorkflowDefinitionSchema = z.object({
  key: z.string().min(2).max(100),
  name: z.string().min(2).max(160),
  description: z.string().max(10000).default(""),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  steps: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    type: WorkflowStepTypeSchema,
    config: z.record(z.string(), z.unknown()).default({}),
    dependsOn: z.array(z.string()).default([]),
    retryLimit: z.number().int().min(0).max(10).default(0),
    timeoutMs: z.number().int().min(1000).max(3600000).default(120000),
  }).strict()).min(1),
}).strict().superRefine((workflow, context) => {
  const ids = new Set<string>();

  for (const step of workflow.steps) {
    if (!["APPROVAL", "CONDITION", "WAIT"].includes(step.type)) {
      context.addIssue({ code: "custom", path: ["steps"], message: `WORKFLOW_STEP_NOT_CONNECTED:${step.id}:${step.type}` });
    }
    if (ids.has(step.id)) {
      context.addIssue({
        code: "custom",
        message: `Duplicate step ID: ${step.id}`,
      });
    }
    ids.add(step.id);
  }

  for (const step of workflow.steps) {
    for (const dependency of step.dependsOn) {
      if (!ids.has(dependency)) {
        context.addIssue({
          code: "custom",
          message: `Unknown dependency: ${dependency}`,
        });
      }
      if (dependency === step.id) {
        context.addIssue({
          code: "custom",
          message: "A workflow step cannot depend on itself",
        });
      }
    }
  }
});

export const WorkflowRunRequestSchema = z.object({
  workflowId: z.string().min(1),
  projectId: z.string().min(1),
  input: z.unknown(),
  idempotencyKey: z.string().min(8).max(200),
}).strict();

export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;
export type WorkflowRunRequest = z.infer<typeof WorkflowRunRequestSchema>;
