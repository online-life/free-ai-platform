import { z } from "zod";

export const ProjectStatusSchema = z.enum([
  "DRAFT", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED", "CANCELLED",
]);

export const ProjectRoleSchema = z.enum([
  "OWNER", "MANAGER", "MEMBER", "VIEWER",
]);

export const TaskStatusSchema = z.enum([
  "TODO", "READY", "IN_PROGRESS", "BLOCKED",
  "IN_REVIEW", "DONE", "CANCELLED",
]);

export const TaskPrioritySchema = z.enum([
  "LOW", "NORMAL", "HIGH", "CRITICAL",
]);

export const TaskTypeSchema = z.enum([
  "TASK", "BUG", "FEATURE", "RESEARCH", "DOCUMENTATION", "TEST",
]);

export const RequirementTypeSchema = z.enum([
  "FUNCTIONAL", "NON_FUNCTIONAL", "BUSINESS",
]);

export const RequirementStatusSchema = z.enum([
  "PROPOSED", "APPROVED", "IMPLEMENTED", "VERIFIED", "REJECTED",
]);

export const DependencyTypeSchema = z.enum([
  "BLOCKS", "REQUIRES", "RELATES_TO",
]);

export const IntakeStatusSchema = z.enum([
  "RECEIVED", "UNDER_REVIEW", "ACCEPTED", "REJECTED", "CONVERTED",
]);

const ProjectFieldsSchema = z.object({
  name: z.string().trim().min(2).max(160),
  key: z.string().trim().min(2).max(32)
    .regex(/^[A-Z][A-Z0-9_-]*$/),
  description: z.string().max(10000).optional(),
  domain: z.string().max(120).optional(),
  category: z.string().max(120).optional(),
  startDate: z.coerce.date().optional(),
  targetDate: z.coerce.date().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
}).strict();

export const ProjectCreateSchema = ProjectFieldsSchema.refine(
  (value) => !value.startDate || !value.targetDate ||
    value.targetDate >= value.startDate,
  { message: "Target date cannot be before start date", path: ["targetDate"] },
);

export const ProjectUpdateSchema = ProjectFieldsSchema.partial().extend({
  status: ProjectStatusSchema.optional(),
}).strict();

export const IntakeCreateSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(1).max(30000),
  source: z.enum(["WEB", "API", "INTERNAL", "IMPORT"]).default("WEB"),
  priority: TaskPrioritySchema.default("NORMAL"),
  requestedBy: z.string().min(1).max(128),
  context: z.record(z.string(), z.unknown()).optional(),
  attachmentIds: z.array(z.string().min(1)).max(100).default([]),
}).strict();

export const RequirementCreateSchema = z.object({
  code: z.string().trim().min(2).max(40),
  title: z.string().trim().min(3).max(200),
  description: z.string().max(20000),
  type: RequirementTypeSchema,
  priority: TaskPrioritySchema.default("NORMAL"),
  acceptanceCriteria: z.array(z.string().trim().min(1).max(2000)).min(1),
}).strict();

export const TaskCreateSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().max(20000).optional(),
  type: TaskTypeSchema.default("TASK"),
  priority: TaskPrioritySchema.default("NORMAL"),
  status: TaskStatusSchema.default("TODO"),
  assigneeId: z.string().min(1).max(128).optional(),
  parentTaskId: z.string().min(1).max(128).optional(),
  requirementId: z.string().min(1).max(128).optional(),
  estimateMinutes: z.number().int().positive().max(525600).optional(),
  dueDate: z.coerce.date().optional(),
  position: z.number().int().min(0).default(0),
}).strict();

export const TaskUpdateSchema = TaskCreateSchema.partial().extend({
  completedAt: z.coerce.date().nullable().optional(),
}).strict();

export const DependencyCreateSchema = z.object({
  predecessorId: z.string().min(1),
  successorId: z.string().min(1),
  type: DependencyTypeSchema,
}).strict().refine(
  (value) => value.predecessorId !== value.successorId,
  { message: "A task cannot depend on itself" },
);

export const SpecialistProfileSchema = z.object({
  objectives: z.array(z.string()).default([]),
  scope: z.object({
    included: z.array(z.string()).default([]),
    excluded: z.array(z.string()).default([]),
  }).default({ included: [], excluded: [] }),
  constraints: z.array(z.string()).default([]),
  standards: z.array(z.string()).default([]),
  technologyStack: z.array(z.string()).default([]),
  conventions: z.record(z.string(), z.unknown()).default({}),
  language: z.string().default("en"),
  decisions: z.array(z.string()).default([]),
  glossary: z.record(z.string(), z.string()).default({}),
  risks: z.array(z.string()).default([]),
  currentState: z.string().default(""),
}).strict();

export type ProjectCreateInput = z.infer<typeof ProjectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof ProjectUpdateSchema>;
export type TaskCreateInput = z.infer<typeof TaskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof TaskUpdateSchema>;
export type IntakeCreateInput = z.infer<typeof IntakeCreateSchema>;
export type RequirementCreateInput = z.infer<typeof RequirementCreateSchema>;
export type SpecialistProfile = z.infer<typeof SpecialistProfileSchema>;
