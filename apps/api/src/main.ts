import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { z, ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { prisma, disconnectDatabase } from "./infrastructure/database/prisma";
import { authenticateRequest, readCookie } from "./middleware/authentication.middleware";
import { IdentityService } from "./modules/identity/identity.service";
import { AuthenticationService } from "./modules/authentication/authentication.service";
import { ProjectService } from "./modules/projects/project.service";
import { TasksService } from "./modules/projects/tasks.service";
import { createProviderRuntime } from "./modules/providers/provider-runtime";
import { PrismaModelRepository } from "./modules/model-intelligence/prisma-model.repository";
import { AuthorizationService } from "./modules/authorization/authorization.service";
import { AgentRegistryService } from "./modules/agents/agent-registry.service";
import { AgentEvaluationService } from "./modules/agents/agent-evaluation.service";
import { AgentSelectionService } from "./modules/agents/agent-selection.service";
import { PrismaAgentRepository, PrismaAgentMemoryRepository } from "./modules/agents/prisma-agent.repository";
import { AgentCapabilitySchema } from "./modules/agents/agent.schemas";
import { ProjectSpecialistService } from "./modules/projects/project-specialist.service";
import { PrismaWorkflowRepository, PrismaWorkflowApprovalRepository, PersistedWorkflowStepExecutor, requireWorkflowProjectAccess } from "./modules/workflows/prisma-workflow.repository";
import { WorkflowDefinitionService } from "./modules/workflows/workflow-definition.service";
import { WorkflowEngineService } from "./modules/workflows/workflow-engine.service";
import { WorkflowApprovalService } from "./modules/workflows/workflow-approval.service";
import { RuntimeManagementService } from "./modules/execution/runtime-management.service";
import { AuditService } from "./modules/audit/audit.service";
import { withTenantTransaction } from "./infrastructure/database/transaction";

const identity = new IdentityService();
const authentication = new AuthenticationService();
const projects = new ProjectService();
const tasks = new TasksService();
const providerRuntime = createProviderRuntime();
const providers = providerRuntime.management;
const modelRepository = new PrismaModelRepository();
const modelSelection = providerRuntime.modelSelection;
const providerRouter = providerRuntime.router;
const authorization = new AuthorizationService();
const agentRepository = new PrismaAgentRepository();
const agentRegistry = new AgentRegistryService(agentRepository);
const agentEvaluation = new AgentEvaluationService(agentRepository);
const agentSelection = new AgentSelectionService();
const agentMemory = new PrismaAgentMemoryRepository();
const projectSpecialist = new ProjectSpecialistService();
const workflowRepository = new PrismaWorkflowRepository();
const workflowDefinitions = new WorkflowDefinitionService(workflowRepository);
const workflowEngine = new WorkflowEngineService(workflowRepository, new PersistedWorkflowStepExecutor(workflowRepository));
const workflowApprovals = new WorkflowApprovalService(new PrismaWorkflowApprovalRepository(workflowRepository));
const runtimeManagement = new RuntimeManagementService();
const audit = new AuditService();
const MAX_BODY_BYTES = 1024 * 1024;
const RATE_WINDOW_MS = 60_000;
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const PublicSiteSettingsSchema = z.object({
  platformName: z.string().trim().min(2).max(100),
  platformDescription: z.string().trim().max(1000),
  contactDescription: z.string().trim().max(1000),
  contactEmail: z.union([z.literal(""), z.string().email().max(254)]),
  contactUrl: z.union([z.literal(""), z.string().url().max(500)]),
  supportUrl: z.union([z.literal(""), z.string().url().max(500)]),
  footerText: z.string().trim().max(500),
  socialLinks: z.array(z.object({ label: z.string().trim().min(1).max(60), url: z.string().url().max(500) }).strict()).max(10),
  pageContent: z.object({ terms: z.string().max(20000), privacy: z.string().max(20000) }).strict(),
}).strict();

type Actor = { tenantId: string; userId: string; sessionId: string; passwordChangeRequired: boolean; csrfTokenHash: string | null; mechanism: "cookie" | "bearer"; token: string; expiresAt: Date };

const openApi = {
  openapi: "3.1.0",
  info: { title: "Free AI Platform API", version: "1.0.0", description: "Versioned control-plane API. AI provider calls remain behind the unified gateway." },
  servers: [{ url: `http://127.0.0.1:${process.env.API_PORT ?? 3000}` }],
  paths: {
    "/health": { get: { summary: "Database and API health", responses: { "200": { description: "Healthy" }, "503": { description: "Database unavailable" } } } },
    "/api/v1/auth/bootstrap/status": { get: { summary: "Check first-run owner setup availability", responses: { "200": { description: "Bootstrap availability only" } } } },
    "/api/v1/public/site": { get: { summary: "Read the deployment owner's explicitly public website content", responses: { "200": { description: "Public-only platform content; provider credentials are never returned" } } } },
    "/api/v1/admin/public-site": { get: { security: [{ bearerAuth: [] }], summary: "Read public website settings", responses: { "200": { description: "Owner-controlled public content" }, "401": { description: "Authentication required" }, "403": { description: "Platform management permission required" } } }, put: { security: [{ bearerAuth: [] }], summary: "Update public website content and contact links", responses: { "200": { description: "Saved public content" }, "401": { description: "Authentication required" }, "403": { description: "Platform management permission required" } } } },
    "/api/v1/auth/bootstrap": { post: { summary: "Create the first platform owner with a one-time bootstrap token", responses: { "201": { description: "First tenant and owner created" } } } },
    "/api/v1/auth/login": { post: { summary: "Create a tenant-scoped session", responses: { "200": { description: "Session token" }, "401": { description: "Invalid credentials" } } } },
    "/api/v1/auth/me": { get: { security: [{ bearerAuth: [] }], summary: "Read current session", responses: { "200": { description: "Session identity" } } } },
    "/api/v1/auth/logout": { post: { security: [{ bearerAuth: [] }], summary: "Revoke current session", responses: { "204": { description: "Session revoked" } } } },
    "/api/v1/projects": {
      get: { security: [{ bearerAuth: [] }], summary: "List projects in the authenticated tenant", responses: { "200": { description: "Project list" } } },
      post: { security: [{ bearerAuth: [] }], summary: "Create a project", responses: { "201": { description: "Project created" } } },
    },
    "/api/v1/projects/{projectId}": { get: { security: [{ bearerAuth: [] }], summary: "Read a project", parameters: [{ name: "projectId", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Project" } } } },
    "/api/v1/projects/{projectId}/tasks": {
      get: { security: [{ bearerAuth: [] }], summary: "List project tasks", responses: { "200": { description: "Task list" } } },
      post: { security: [{ bearerAuth: [] }], summary: "Create a project task", responses: { "201": { description: "Task created" } } },
    },
    "/api/v1/providers": { get: { security: [{ bearerAuth: [] }], summary: "List provider configurations", responses: { "200": { description: "Provider list; credentials are never returned" } } }, post: { security: [{ bearerAuth: [] }], summary: "Create a disabled provider configuration", responses: { "201": { description: "Provider configuration" } } } },
    "/api/v1/providers/{providerId}/models": { get: { security: [{ bearerAuth: [] }], summary: "List configured provider models", responses: { "200": { description: "Model list" } } }, post: { security: [{ bearerAuth: [] }], summary: "Configure a disabled model", responses: { "201": { description: "Model metadata saved" } } } },
    "/api/v1/models": { get: { security: [{ bearerAuth: [] }], summary: "List currently available models", responses: { "200": { description: "Available models" } } } },
    "/api/v1/model-policies": { get: { security: [{ bearerAuth: [] }], summary: "Get global model visibility policy", responses: { "200": { description: "Model visibility settings" } } }, put: { security: [{ bearerAuth: [] }], summary: "Update global model visibility policy", responses: { "200": { description: "Updated model visibility settings" } } } },
    "/api/v1/platform/model-policies": { get: { security: [{ bearerAuth: [] }], summary: "Read platform-wide model policy (platform owner)", responses: { "200": { description: "Platform model policy" } } }, put: { security: [{ bearerAuth: [] }], summary: "Update platform-wide model policy (platform owner)", responses: { "200": { description: "Updated platform model policy" } } } },
    "/api/v1/models/route-preview": { post: { security: [{ bearerAuth: [] }], summary: "Select a compatible model without calling its provider", responses: { "200": { description: "Selection and decision reasons" } } } },
    "/api/v1/projects/{projectId}/ai/execute": { post: { security: [{ bearerAuth: [] }], summary: "Execute a project-scoped request through central model routing and the provider gateway", responses: { "200": { description: "Model output and routing evidence" }, "403": { description: "Project or execution permission denied" } } } },
    "/api/v1/agents": { get: { security: [{ bearerAuth: [] }], summary: "List agents", responses: { "200": { description: "Tenant-scoped agent registry" } } }, post: { security: [{ bearerAuth: [] }], summary: "Create an agent and immutable initial version", responses: { "201": { description: "Agent created" } } } },
    "/api/v1/agents/{agentId}/versions": { post: { security: [{ bearerAuth: [] }], summary: "Publish an immutable draft version", responses: { "201": { description: "Version created" } } } },
    "/api/v1/agents/{agentId}/evaluations": { get: { security: [{ bearerAuth: [] }], summary: "Read agent evaluation records", responses: { "200": { description: "Evaluation records" } } }, post: { security: [{ bearerAuth: [] }], summary: "Record a scored agent evaluation", responses: { "201": { description: "Evaluation recorded" } } } },
    "/api/v1/projects/{projectId}/specialist": { get: { security: [{ bearerAuth: [] }], summary: "Read project specialist profile", responses: { "200": { description: "Project specialist profile" } } }, post: { security: [{ bearerAuth: [] }], summary: "Create a versioned project specialist profile", responses: { "201": { description: "Project specialist profile saved" } } } },
    "/api/v1/projects/{projectId}/agents/{agentId}/memory": { get: { security: [{ bearerAuth: [] }], summary: "Read project-isolated agent memory", responses: { "200": { description: "Project memory entries" } } }, post: { security: [{ bearerAuth: [] }], summary: "Update project-isolated agent memory", responses: { "200": { description: "Memory saved" } } } },
    "/api/v1/projects/{projectId}/workflows": { get: { security: [{ bearerAuth: [] }], summary: "List project workflows", responses: { "200": { description: "Workflow definitions" } } }, post: { security: [{ bearerAuth: [] }], summary: "Create a project-scoped workflow version", responses: { "201": { description: "Workflow created" } } } },
    "/api/v1/projects/{projectId}/workflows/{workflowId}/activate": { post: { security: [{ bearerAuth: [] }], summary: "Activate a workflow", responses: { "200": { description: "Workflow activated" } } } },
    "/api/v1/projects/{projectId}/workflow-runs": { post: { security: [{ bearerAuth: [] }], summary: "Create and start an idempotent workflow run", responses: { "201": { description: "Run started or waiting for approval" } } } },
    "/api/v1/projects/{projectId}/workflow-runs/{runId}": { get: { security: [{ bearerAuth: [] }], summary: "Read persisted workflow state and trace", responses: { "200": { description: "Workflow run" } } } },
    "/api/v1/projects/{projectId}/workflow-runs/{runId}/resume": { post: { security: [{ bearerAuth: [] }], summary: "Resume a persisted workflow", responses: { "200": { description: "Workflow resumed" } } } },
    "/api/v1/projects/{projectId}/workflow-runs/{runId}/approvals": { get: { security: [{ bearerAuth: [] }], summary: "List workflow approvals", responses: { "200": { description: "Approval list" } } } },
    "/api/v1/projects/{projectId}/workflow-approvals/{approvalId}": { post: { security: [{ bearerAuth: [] }], summary: "Approve or reject a pending workflow step", responses: { "200": { description: "Approval decision recorded" } } } },
  },
  components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } } },
} as const;

function send(response: ServerResponse, status: number, body: unknown, requestId: string): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Request-Id": requestId,
  });
  response.end(JSON.stringify(body));
}

function errorResponse(error: unknown, requestId: string): { status: number; body: unknown } {
  if (error instanceof ZodError) return { status: 400, body: { code: "VALIDATION_ERROR", message: "Request validation failed", requestId, details: error.issues.map(({ path, code }) => ({ path, code })), retryable: false } };
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return { status: 409, body: { code: "RESOURCE_CONFLICT", message: "A resource with these details already exists", requestId, retryable: false } };
    if (error.code === "P2025") return { status: 404, body: { code: "NOT_FOUND", message: "Resource not found", requestId, retryable: false } };
  }
  const message = error instanceof Error ? error.message : "INTERNAL_ERROR";
  const code = message.split(":", 1)[0] || "INTERNAL_ERROR";
  const known: Record<string, number> = {
    UNAUTHENTICATED: 401, FORBIDDEN: 403, PROJECT_ACCESS_DENIED: 403,
    PROJECT_NOT_FOUND: 404, TASK_NOT_FOUND: 404, PROVIDER_NOT_FOUND: 404,
    AGENT_NOT_FOUND: 404, AGENT_VERSION_NOT_FOUND: 404, AGENT_NOT_AVAILABLE: 404,
    PROJECT_KEY_ALREADY_EXISTS: 409, AGENT_KEY_ALREADY_EXISTS: 409,
    INVALID_CREDENTIALS: 401, "Invalid credentials": 401, CSRF_ORIGIN_REJECTED: 403, CSRF_VALIDATION_FAILED: 403,
    PASSWORD_CHANGE_REQUIRED: 403, CURRENT_PASSWORD_INVALID: 400, PASSWORD_POLICY_REJECTED: 400,
    TENANT_NAME_INVALID: 400, TENANT_SLUG_INVALID: 400, EMAIL_INVALID: 400,
    BOOTSTRAP_TOKEN_INVALID: 401, BOOTSTRAP_ALREADY_COMPLETED: 409, BOOTSTRAP_NOT_CONFIGURED: 503,
    PLATFORM_MODEL_POLICY_MISSING: 503, AUTOMATIC_REFRESH_REQUIRES_DISCOVERY: 400,
    CUSTOM_PROVIDERS_DISABLED: 409, LOCAL_MODELS_DISABLED: 409,
    LOCAL_PROVIDER_ENDPOINT_REQUIRED: 400, LOCAL_PROVIDER_CONNECTOR_REQUIRED: 400,
    USERNAME_INVALID: 400, ROLE_NOT_FOUND: 404, USER_NOT_FOUND: 404, SESSION_NOT_FOUND: 404,
    LAST_PLATFORM_OWNER: 409, SELF_DEACTIVATION_DENIED: 409,
    "Password must contain at least 12 characters": 400,
    ANONYMOUS_AUTH_LOCAL_ONLY: 400, PROVIDER_API_KEY_REQUIRED: 400,
    PROVIDER_API_KEY_INVALID: 400,
    PROVIDER_BLOCKED_BY_FREE_ONLY_POLICY: 409,
    PROVIDER_QUOTA_ENFORCEMENT_UNAVAILABLE: 409,
    PROVIDER_NOT_ACTIVE: 409, PROVIDER_OPERATION_UNSUPPORTED: 409, PROVIDER_SCOPE_REQUIRED: 400,
    MODEL_BLOCKED_BY_FREE_ONLY_POLICY: 409,
    MODEL_QUOTA_ENFORCEMENT_UNAVAILABLE: 409,
    MODEL_NOT_AVAILABLE: 409, MODEL_PRIVACY_NOT_APPROVED: 409, MODEL_CAPABILITY_MISMATCH: 409,
    MODEL_OUTPUT_LIMIT_EXCEEDED: 400, MODEL_OPERATION_UNSUPPORTED: 400,
    PROVIDER_AUTHENTICATION_FAILED: 502, PROVIDER_RATE_LIMITED: 429,
    PROVIDER_TIMEOUT: 504, PROVIDER_NETWORK_ERROR: 502,
    PROVIDER_UPSTREAM_UNAVAILABLE: 502, PROVIDER_REQUEST_REJECTED: 502,
    PROVIDER_HEALTH_CHECK_REQUIRED: 409,
    MODEL_NOT_FOUND_IN_SCOPE: 404,
    MODEL_VERIFICATION_REQUIRED: 409,
    MODEL_CAPABILITY_UNSUPPORTED_BY_ADAPTER: 409,
    WORKFLOW_NOT_FOUND: 404,
    WORKFLOW_RUN_NOT_FOUND: 404,
    WORKFLOW_NOT_AVAILABLE: 409,
    WORKFLOW_STEP_NOT_CONNECTED: 409,
    APPROVAL_NOT_FOUND: 404,
    APPROVAL_ALREADY_DECIDED: 409,
    WORKFLOW_RUN_NOT_RESUMABLE: 409,
    WORKFLOW_RUN_ALREADY_CLAIMED: 409,
    NO_COMPATIBLE_MODEL: 409,
    AGENT_VERSION_EVALUATION_REQUIRED: 409,
    RUNTIME_DEVICE_UNAUTHORIZED: 401,
    RUNTIME_PAIRING_CODE_INVALID: 401,
    RUNTIME_DEVICE_NOT_FOUND: 404,
    RUNTIME_JOB_NOT_FOUND: 404,
    RUNTIME_WORKSPACE_NOT_FOUND: 404,
    RUNTIME_PROJECT_ACCESS_DENIED: 403,
    WORKSPACE_READ_DENIED: 403,
    WORKSPACE_WRITE_DENIED: 403,
    WORKSPACE_DELETE_DENIED: 403,
    WORKSPACE_DELETE_REQUIRES_WRITE: 400,
    WORKSPACE_EXECUTE_REQUIRES_READ_WRITE: 400,
    WORKSPACE_EXECUTION_DENIED: 403,
    SANDBOX_PROCESS_REQUEST_INVALID: 400,
    WORKSPACE_DELETE_APPROVAL_REQUIRED: 409,
    RUNTIME_JOB_IDEMPOTENCY_CONFLICT: 409,
    RUNTIME_JOB_NOT_CANCELLABLE: 409,
    RUNTIME_JOB_STATE_CONFLICT: 409,
    RUNTIME_JOB_CANCEL_PENDING: 409,
    // Request-shape errors raised by this router.
    "Invalid tenantId": 400, "Invalid projectId": 400,
    CONTENT_TYPE_JSON_REQUIRED: 415, INVALID_JSON: 400, REQUEST_BODY_TOO_LARGE: 413,
    QUERY_LIMIT_INVALID: 400, PUBLIC_URL_MUST_USE_HTTPS: 400,
    // Provider configuration rejected by the gateway's validation / SSRF guard.
    PROVIDER_URL_INVALID: 400, PROVIDER_URL_MUST_USE_HTTPS: 400, PROVIDER_LOCAL_ENDPOINT_NOT_ALLOWED: 400,
    PROVIDER_DESTINATION_NOT_ALLOWED: 400, PROVIDER_HEADERS_INVALID: 400, PROVIDER_KEY_INVALID: 400,
    PROVIDER_MESSAGES_REQUIRED: 400, PROVIDER_INPUT_REQUIRED: 400,
    PROVIDER_CREDENTIAL_MISSING: 409, PROVIDER_MODEL_DISCOVERY_UNSUPPORTED: 409,
    PROJECT_PROVIDER_PERMISSION_DENIED: 403, PROVIDER_QUOTA_EXCEEDED: 429,
    // Upstream provider faults are gateway errors, not internal errors.
    PROVIDER_DNS_RESOLUTION_FAILED: 502, PROVIDER_RESPONSE_INVALID: 502, PROVIDER_RESPONSE_TOO_LARGE: 502,
    MODEL_NOT_FOUND: 404, NO_COMPATIBLE_AGENT: 409, SELECTED_MODEL_PROVIDER_MISSING: 409,
    // Project, task and workflow domain rules.
    PARENT_TASK_NOT_FOUND: 404, REQUIREMENT_NOT_FOUND: 404, PROJECT_MEMBER_NOT_FOUND: 404,
    TASK_DEPENDENCY_CYCLE: 409, TASK_DEPENDENCY_SCOPE_INVALID: 400, CANNOT_REMOVE_SELF: 409,
    IDEMPOTENCY_KEY_SCOPE_MISMATCH: 409, WORKFLOW_DEPENDENCY_CYCLE: 400, WORKFLOW_KEY_IMMUTABLE: 409,
    WORKFLOW_RUN_ALREADY_FINISHED: 409, WORKFLOW_RUN_NOT_RUNNING: 409, WORKFLOW_VERSION_MISSING: 409,
    WORKFLOW_WAIT_LIMIT_INVALID: 400, WORKFLOW_CONDITION_CONFIG_INVALID: 400,
    WORKFLOW_APPROVAL_REJECTED: 409, WORKFLOW_DEPENDENCY_NOT_COMPLETED: 409,
    INVALID_EVALUATION_CASE: 400, INVALID_EVALUATION_DURATION: 400, INVALID_EVALUATION_SCORE: 400,
  };
  const status = known[code] ?? known[message] ?? 500;
  const safeMessage = status < 500 ? message.replace(/^FORBIDDEN:.*$/, "FORBIDDEN") : "Internal server error";
  return { status, body: { code: status === 500 ? "INTERNAL_ERROR" : code === "Invalid credentials" ? "UNAUTHENTICATED" : code, message: safeMessage, requestId, retryable: status >= 500 } };
}

/**
 * Structured stderr record for 5xx responses so operators can correlate a
 * requestId with its failure. Only the error class, a leading UPPER_SNAKE code
 * and a Prisma error code are logged; free-form messages are omitted because
 * they can echo request input.
 */
function logServerError(error: unknown, request: IncomingMessage, requestId: string): void {
  const name = error instanceof Error ? error.name : typeof error;
  const leading = error instanceof Error ? /^[A-Z][A-Z0-9_]{2,80}/.exec(error.message)?.[0] : undefined;
  const prismaCode = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
  const path = (request.url ?? "/").split("?", 1)[0];
  process.stderr.write(`${JSON.stringify({ level: "error", event: "api.request_failed", time: new Date().toISOString(), requestId, method: request.method, path, errorName: name, ...(leading ? { code: leading } : {}), ...(prismaCode ? { prismaCode } : {}) })}\n`);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const contentType = request.headers["content-type"]?.split(";", 1)[0]?.trim();
  if (contentType !== "application/json") throw new Error("CONTENT_TYPE_JSON_REQUIRED");
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const part of request) {
    const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part);
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) throw new Error("REQUEST_BODY_TOO_LARGE");
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
  catch { throw new Error("INVALID_JSON"); }
}

function rateLimit(request: IncomingMessage, route: string): boolean {
  const address = request.socket.remoteAddress ?? "unknown";
  const sensitiveAuthRoute = route === "/api/v1/auth/login" || route === "/api/v1/auth/bootstrap";
  const bucket = sensitiveAuthRoute ? `auth:${route}:${address}` : `general:${address}`;
  const now = Date.now();
  let current = requestCounts.get(bucket);
  if (!current || current.resetAt <= now) current = { count: 0, resetAt: now + RATE_WINDOW_MS };
  current.count += 1;
  requestCounts.set(bucket, current);
  if (requestCounts.size > 10_000) for (const [key, value] of requestCounts) if (value.resetAt <= now) requestCounts.delete(key);
  return current.count <= (bucket.startsWith("auth:") ? 12 : 180);
}

async function actorFor(request: IncomingMessage): Promise<Actor> {
  const authenticated = await authenticateRequest(request);
  return { tenantId: authenticated.tenantId, userId: authenticated.userId, sessionId: authenticated.sessionId, passwordChangeRequired: authenticated.passwordChangeRequired, csrfTokenHash: authenticated.csrfTokenHash, mechanism: authenticated.mechanism, token: authenticated.token, expiresAt: authenticated.expiresAt };
}

function secretHash(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function secureCookieFlags(): string { return `Path=/; SameSite=Strict${process.env.NODE_ENV === "production" ? "; Secure" : ""}`; }
function setSessionCookies(response: ServerResponse, session: { token: string; tenantId: string; csrfToken: string; expiresAt: Date }): void {
  const maxAge = Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000));
  response.setHeader("Set-Cookie", [
    `freeai_session=${encodeURIComponent(`${session.tenantId}.${session.token}`)}; ${secureCookieFlags()}; HttpOnly; Max-Age=${maxAge}`,
    `freeai_csrf=${encodeURIComponent(session.csrfToken)}; ${secureCookieFlags()}; Max-Age=${maxAge}`,
  ]);
}
function clearSessionCookies(response: ServerResponse): void {
  response.setHeader("Set-Cookie", [
    `freeai_session=; ${secureCookieFlags()}; HttpOnly; Max-Age=0`,
    `freeai_csrf=; ${secureCookieFlags()}; Max-Age=0`,
  ]);
}
function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
function requireRequestOrigin(request: IncomingMessage): void {
  const origin = request.headers.origin;
  if (origin && origin !== (process.env.WEB_ORIGIN ?? "http://127.0.0.1:4173")) throw new Error("CSRF_ORIGIN_REJECTED");
}
function requirePreAuthCsrf(request: IncomingMessage): void {
  requireRequestOrigin(request);
  if (!request.headers.origin) return;
  const cookie = readCookie(request, "freeai_csrf");
  const header = request.headers["x-csrf-token"];
  if (!cookie || typeof header !== "string" || !safeEqual(cookie, header)) throw new Error("CSRF_VALIDATION_FAILED");
}
function requireActorCsrf(request: IncomingMessage, actor: Actor): void {
  requireRequestOrigin(request);
  if (actor.mechanism !== "cookie") return;
  const cookie = readCookie(request, "freeai_csrf");
  const header = request.headers["x-csrf-token"];
  if (!cookie || typeof header !== "string" || !safeEqual(cookie, header) || !actor.csrfTokenHash || !safeEqual(secretHash(header), actor.csrfTokenHash)) throw new Error("CSRF_VALIDATION_FAILED");
}

function runtimeTokenFor(request: IncomingMessage): string {
  const value = request.headers.authorization;
  if (typeof value !== "string" || !value.startsWith("Bearer ")) throw new Error("RUNTIME_DEVICE_UNAUTHORIZED");
  const token = value.slice(7).trim();
  if (!token) throw new Error("RUNTIME_DEVICE_UNAUTHORIZED");
  return token;
}

async function route(request: IncomingMessage, response: ServerResponse, requestId: string): Promise<void> {
  const url = new URL(request.url ?? "/", "http://localhost");
  const path = url.pathname;
  const method = request.method ?? "GET";
  requireRequestOrigin(request);
  if (!rateLimit(request, path)) {
    send(response, 429, { code: "RATE_LIMITED", message: "Too many requests", requestId, retryable: true }, requestId);
    return;
  }

  if ((path === "/health" || path === "/api/v1/health") && method === "GET") {
    try {
      await prisma.$queryRaw`SELECT 1`;
      send(response, 200, { status: "healthy", timestamp: new Date().toISOString(), checks: { api: true, database: true } }, requestId);
    } catch {
      send(response, 503, { status: "unhealthy", timestamp: new Date().toISOString(), checks: { api: true, database: false } }, requestId);
    }
    return;
  }
  if ((path === "/openapi.json" || path === "/api/v1/openapi.json") && method === "GET") {
    send(response, 200, openApi, requestId);
    return;
  }

  if (path === "/api/v1/auth/csrf" && method === "GET") {
    const csrfToken = randomBytes(32).toString("base64url");
    const cookie = readCookie(request, "freeai_session");
    if (cookie) {
      const separator = cookie.indexOf(".");
      const tenantId = separator > 0 ? cookie.slice(0, separator) : "";
      const token = separator > 0 ? cookie.slice(separator + 1) : "";
      const session = await authentication.validateSession(token, tenantId);
      if (session) {
        await withTenantTransaction({ tenantId: session.tenantId, userId: session.userId }, (tx) => tx.session.update({ where: { id: session.sessionId, tenantId: session.tenantId }, data: { csrfTokenHash: secretHash(csrfToken) } }));
        setSessionCookies(response, { token, tenantId: session.tenantId, csrfToken, expiresAt: session.expiresAt });
      }
    }
    if (!response.hasHeader("Set-Cookie")) response.setHeader("Set-Cookie", `freeai_csrf=${encodeURIComponent(csrfToken)}; ${secureCookieFlags()}; Max-Age=${12 * 60 * 60}`);
    send(response, 200, { csrfToken }, requestId);
    return;
  }

  if (path === "/api/v1/runtime/enroll" && method === "POST") {
    send(response, 201, await runtimeManagement.enroll(await readJson(request)), requestId);
    return;
  }
  if (path === "/api/v1/runtime/heartbeat" && method === "POST") {
    send(response, 200, await runtimeManagement.heartbeat(runtimeTokenFor(request), await readJson(request)), requestId);
    return;
  }
  const runtimeJobReportMatch = path.match(/^\/api\/v1\/runtime\/jobs\/([a-f0-9-]+)\/status$/i);
  if (runtimeJobReportMatch && method === "POST") {
    send(response, 200, await runtimeManagement.reportJob(runtimeTokenFor(request), runtimeJobReportMatch[1]!, await readJson(request)), requestId);
    return;
  }

  if (path === "/api/v1/auth/register" && method === "POST") {
    send(response, 403, { code: "REGISTRATION_DISABLED", message: "Public account registration is unavailable", requestId, retryable: false }, requestId);
    return;
  }
  if (path === "/api/v1/auth/bootstrap/status" && method === "GET") {
    send(response, 200, await identity.bootstrapStatus(), requestId);
    return;
  }
  if (path === "/api/v1/auth/bootstrap" && method === "POST") {
    requirePreAuthCsrf(request);
    const input = z.object({
      bootstrapToken: z.string().min(32).max(256),
      tenantName: z.string().min(2).max(120),
      tenantSlug: z.string().min(3).max(60),
    }).strict().parse(await readJson(request));
    send(response, 201, await identity.bootstrapOwner(input), requestId);
    return;
  }
  if (path === "/api/v1/auth/login" && method === "POST") {
    requirePreAuthCsrf(request);
    const body = z.object({ tenantId: z.string().uuid(), username: z.string().regex(/^[A-Za-z0-9_.-]{3,40}$/), password: z.string().min(1).max(1024) }).strict().parse(await readJson(request));
    const result = await authentication.authenticate(body.username, body.password, body.tenantId, {
      ...(request.socket.remoteAddress ? { ipAddress: request.socket.remoteAddress } : {}),
      ...(request.headers["user-agent"] ? { userAgent: request.headers["user-agent"] } : {}),
    });
    setSessionCookies(response, { ...result, tenantId: result.user.tenantId });
    send(response, 200, { csrfToken: result.csrfToken, expiresAt: result.expiresAt, mustChangePassword: result.mustChangePassword, user: result.user }, requestId);
    return;
  }

  if (path === "/api/v1/public/site" && method === "GET") {
    const row = await prisma.platformPublicSettings.findUnique({ where: { id: 1 }, select: { value: true } });
    const publicSettings = PublicSiteSettingsSchema.safeParse(row?.value);
    send(response, 200, publicSettings.success ? publicSettings.data : {}, requestId);
    return;
  }

  const authenticatedActor = await actorFor(request);
  const actor = { ...authenticatedActor, projectId: "" };
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) requireActorCsrf(request, actor);
  if (actor.mechanism === "cookie" && path !== "/api/v1/auth/logout") {
    const csrfToken = readCookie(request, "freeai_csrf");
    if (csrfToken) setSessionCookies(response, { token: actor.token, tenantId: actor.tenantId, csrfToken, expiresAt: actor.expiresAt });
  }
  if (actor.passwordChangeRequired && !((path === "/api/v1/auth/me" && method === "GET") || (path === "/api/v1/auth/password" && method === "POST") || (path === "/api/v1/auth/logout" && method === "POST"))) {
    throw new Error("PASSWORD_CHANGE_REQUIRED");
  }
  if (path === "/api/v1/auth/me" && method === "GET") {
    const user = await withTenantTransaction({ tenantId: actor.tenantId, userId: actor.userId }, (tx) => tx.user.findFirst({ where: { id: actor.userId, tenantId: actor.tenantId }, select: { username: true } }));
    send(response, 200, { userId: actor.userId, tenantId: actor.tenantId, username: user?.username, mustChangePassword: actor.passwordChangeRequired }, requestId);
    return;
  }
  if (path === "/api/v1/auth/password" && method === "POST") {
    const body = z.object({ currentPassword: z.string().min(1).max(1024).optional(), newPassword: z.string().min(12).max(1024) }).strict().parse(await readJson(request));
    const changed = await authentication.changePassword({ tenantId: actor.tenantId, userId: actor.userId, ...(body.currentPassword ? { currentPassword: body.currentPassword } : {}), newPassword: body.newPassword, ...(request.socket.remoteAddress ? { ipAddress: request.socket.remoteAddress } : {}), ...(request.headers["user-agent"] ? { userAgent: request.headers["user-agent"] } : {}) });
    setSessionCookies(response, { ...changed, tenantId: changed.user.tenantId });
    send(response, 200, { csrfToken: changed.csrfToken, expiresAt: changed.expiresAt, mustChangePassword: false, user: changed.user }, requestId);
    return;
  }
  if (path === "/api/v1/auth/logout" && method === "POST") {
    await authentication.revokeSession(actor.sessionId, actor.tenantId, actor.userId);
    clearSessionCookies(response);
    send(response, 204, null, requestId);
    return;
  }
  if (path.startsWith("/api/v1/admin/")) await authorization.assertPermission(actor.tenantId, actor.userId, "platform.manage");
  if (path === "/api/v1/admin/public-site" && method === "GET") {
    const row = await prisma.platformPublicSettings.findUnique({ where: { id: 1 }, select: { value: true } });
    const publicSettings = PublicSiteSettingsSchema.safeParse(row?.value);
    send(response, 200, publicSettings.success ? publicSettings.data : {}, requestId);
    return;
  }
  if (path === "/api/v1/admin/public-site" && method === "PUT") {
    const input = PublicSiteSettingsSchema.parse(await readJson(request));
    for (const urlValue of [input.contactUrl, input.supportUrl, ...input.socialLinks.map((link) => link.url)]) {
      const parsed = new URL(urlValue || "https://invalid.example");
      if (parsed.protocol !== "https:") throw new Error("PUBLIC_URL_MUST_USE_HTTPS");
    }
    const value = input as Prisma.InputJsonValue;
    await prisma.platformPublicSettings.upsert({ where: { id: 1 }, create: { id: 1, value }, update: { value } });
    await audit.record({ tenantId: actor.tenantId, actorUserId: actor.userId, action: "PUBLIC_SITE_SETTINGS_UPDATED", resourceType: "platform_public_settings", resourceId: "1" });
    send(response, 200, input, requestId);
    return;
  }
  if (path === "/api/v1/admin/users" && method === "GET") {
    const items = await withTenantTransaction({ tenantId: actor.tenantId, userId: actor.userId }, (tx) => tx.user.findMany({
      where: { tenantId: actor.tenantId }, orderBy: { createdAt: "asc" },
      select: { id: true, username: true, status: true, passwordChangeRequired: true, failedLoginAttempts: true, lockedUntil: true, createdAt: true, updatedAt: true, userRoles: { select: { role: { select: { id: true, name: true } } } }, sessions: { where: { revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, createdAt: true, lastUsedAt: true, expiresAt: true } } },
    }));
    send(response, 200, { items: items.map((user) => ({ ...user, roles: user.userRoles.map(({ role }) => role), activeSessions: user.sessions.length, lastActivityAt: user.sessions.map((session) => session.lastUsedAt ?? session.createdAt).sort((a, b) => b.getTime() - a.getTime())[0] ?? null })) }, requestId);
    return;
  }
  if (path === "/api/v1/admin/users" && method === "POST") {
    const input = z.object({ roleId: z.string().uuid().optional() }).strict().parse(await readJson(request));
    const created = await identity.provisionUser(actor.tenantId, actor.userId, input.roleId);
    send(response, 201, created, requestId);
    return;
  }
  const adminUserMatch = path.match(/^\/api\/v1\/admin\/users\/([a-f0-9-]+)(?:\/(username|disable|password-reset|unlock|roles))?$/i);
  if (adminUserMatch) {
    const userId = adminUserMatch[1]!;
    const operation = adminUserMatch[2];
    if (operation === "username" && method === "PATCH") {
      const input = z.object({ username: z.string().min(3).max(40) }).strict().parse(await readJson(request));
      send(response, 200, { user: await identity.setUsername(actor.tenantId, actor.userId, userId, input.username) }, requestId);
      return;
    }
    if (operation === "disable" && method === "POST") {
      z.object({}).strict().parse(await readJson(request));
      if (userId === actor.userId) throw new Error("SELF_DEACTIVATION_DENIED");
      const targetRoles = await withTenantTransaction({ tenantId: actor.tenantId, userId: actor.userId }, (tx) => tx.userRole.findMany({ where: { tenantId: actor.tenantId, userId }, select: { role: { select: { name: true } } } }));
      if (targetRoles.some(({ role }) => role.name === "PLATFORM_OWNER")) {
        const ownerCount = await withTenantTransaction({ tenantId: actor.tenantId, userId: actor.userId }, (tx) => tx.user.count({ where: { tenantId: actor.tenantId, status: "ACTIVE", userRoles: { some: { role: { name: "PLATFORM_OWNER" } } } } }));
        if (ownerCount <= 1) throw new Error("LAST_PLATFORM_OWNER");
      }
      const result = await identity.disable(actor.tenantId, actor.userId, userId);
      send(response, 200, result, requestId);
      return;
    }
    if (operation === "password-reset" && method === "POST") {
      z.object({}).strict().parse(await readJson(request));
      const result = await identity.resetCredentials(actor.tenantId, actor.userId, userId);
      send(response, 200, result, requestId);
      return;
    }
    if (operation === "unlock" && method === "POST") {
      z.object({}).strict().parse(await readJson(request));
      send(response, 200, await identity.unlock(actor.tenantId, actor.userId, userId), requestId);
      return;
    }
    if (operation === "roles" && method === "PUT") {
      const input = z.object({ roleIds: z.array(z.string().uuid()).max(100) }).strict().parse(await readJson(request));
      send(response, 200, { roleIds: await identity.assignRoles(actor.tenantId, actor.userId, userId, input.roleIds) }, requestId);
      return;
    }
  }
  if (path === "/api/v1/admin/roles" && method === "GET") {
    const items = await withTenantTransaction({ tenantId: actor.tenantId, userId: actor.userId }, (tx) => tx.role.findMany({ where: { tenantId: actor.tenantId }, orderBy: { name: "asc" }, select: { id: true, name: true, description: true, permissions: { select: { effect: true, permission: { select: { key: true } } } } } }));
    send(response, 200, { items: items.map((role) => ({ ...role, permissionKeys: role.permissions.map((entry) => ({ key: entry.permission.key, effect: entry.effect })) })) }, requestId);
    return;
  }
  if (path === "/api/v1/admin/roles" && method === "POST") {
    const input = z.object({ name: z.string().min(2).max(80), description: z.string().max(500).optional(), permissions: z.array(z.object({ key: z.string().min(2).max(120), effect: z.enum(["ALLOW", "DENY"]) })).max(100) }).strict().parse(await readJson(request));
    const role = await withTenantTransaction({ tenantId: actor.tenantId, userId: actor.userId }, async (tx) => {
      const created = await tx.role.create({ data: { tenantId: actor.tenantId, name: input.name, ...(input.description ? { description: input.description } : {}) } });
      const entries = await Promise.all([...new Map(input.permissions.map((entry) => [entry.key, entry])).values()].map(async (entry) => {
        const permission = await tx.permission.upsert({ where: { tenantId_key: { tenantId: actor.tenantId, key: entry.key } }, create: { tenantId: actor.tenantId, key: entry.key }, update: {}, select: { id: true } });
        return { tenantId: actor.tenantId, roleId: created.id, permissionId: permission.id, effect: entry.effect };
      }));
      if (entries.length) await tx.rolePermission.createMany({ data: entries });
      return created;
    });
    await audit.record({ tenantId: actor.tenantId, actorUserId: actor.userId, action: "IDENTITY_ROLE_CREATED", resourceType: "role", resourceId: role.id, metadata: { permissionCount: input.permissions.length } });
    send(response, 201, { role }, requestId);
    return;
  }
  if (path === "/api/v1/admin/sessions" && method === "GET") {
    const items = await withTenantTransaction({ tenantId: actor.tenantId, userId: actor.userId }, (tx) => tx.session.findMany({ where: { tenantId: actor.tenantId, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, select: { id: true, userId: true, createdAt: true, lastUsedAt: true, expiresAt: true, ipAddress: true, userAgent: true, user: { select: { username: true } } } }));
    send(response, 200, { items }, requestId);
    return;
  }
  const adminSessionMatch = path.match(/^\/api\/v1\/admin\/sessions\/([a-f0-9-]+)\/revoke$/i);
  if (adminSessionMatch && method === "POST") {
    z.object({}).strict().parse(await readJson(request));
    const sessionId = adminSessionMatch[1]!;
    const result = await withTenantTransaction({ tenantId: actor.tenantId, userId: actor.userId }, (tx) => tx.session.updateMany({ where: { id: sessionId, tenantId: actor.tenantId, revokedAt: null }, data: { revokedAt: new Date() } }));
    if (!result.count) throw new Error("SESSION_NOT_FOUND");
    await audit.record({ tenantId: actor.tenantId, actorUserId: actor.userId, action: "AUTH_SESSION_ADMIN_REVOKED", resourceType: "session", resourceId: sessionId });
    send(response, 200, { revoked: true }, requestId);
    return;
  }
  if (path === "/api/v1/runtime/pairings" && method === "POST") {
    z.object({}).strict().parse(await readJson(request));
    send(response, 201, await runtimeManagement.createPairing(actor), requestId);
    return;
  }
  if (path === "/api/v1/runtime/devices" && method === "GET") {
    send(response, 200, { items: await runtimeManagement.listDevices(actor) }, requestId);
    return;
  }
  if (path === "/api/v1/runtime/logs" && method === "GET") {
    send(response, 200, { items: await runtimeManagement.listLogs(actor, url.searchParams.get("deviceId") ?? undefined) }, requestId);
    return;
  }
  if (path === "/api/v1/runtime/workspaces" && method === "GET") {
    send(response, 200, { items: await runtimeManagement.listWorkspaces(actor, url.searchParams.get("projectId") ?? undefined) }, requestId);
    return;
  }
  if (path === "/api/v1/runtime/workspaces" && method === "POST") {
    send(response, 201, await runtimeManagement.createWorkspace(actor, await readJson(request)), requestId);
    return;
  }
  if (path === "/api/v1/runtime/jobs" && method === "GET") {
    send(response, 200, { items: await runtimeManagement.listJobs(actor, url.searchParams.get("projectId") ?? undefined) }, requestId);
    return;
  }
  if (path === "/api/v1/runtime/jobs" && method === "POST") {
    send(response, 201, await runtimeManagement.enqueueJob(actor, await readJson(request)), requestId);
    return;
  }
  const runtimeDeviceActionMatch = path.match(/^\/api\/v1\/runtime\/devices\/([a-f0-9-]+)\/(revoke|projects\/([a-zA-Z0-9_-]+)\/(grant|revoke))$/i);
  if (runtimeDeviceActionMatch && method === "POST") {
    if (runtimeDeviceActionMatch[2] === "revoke") {
      send(response, 200, await runtimeManagement.revokeDevice(actor, runtimeDeviceActionMatch[1]!), requestId);
    } else {
      send(response, 200, await runtimeManagement.grantProject(actor, runtimeDeviceActionMatch[1]!, runtimeDeviceActionMatch[3]!, runtimeDeviceActionMatch[4] === "grant"), requestId);
    }
    return;
  }
  const runtimeJobCancelMatch = path.match(/^\/api\/v1\/runtime\/jobs\/([a-f0-9-]+)\/cancel$/i);
  if (runtimeJobCancelMatch && method === "POST") {
    send(response, 200, await runtimeManagement.cancelJob(actor, runtimeJobCancelMatch[1]!), requestId);
    return;
  }
  if (path === "/api/v1/agents" && method === "GET") {
    await authorization.assertPermission(actor.tenantId, actor.userId, "agent.manage");
    send(response, 200, { items: await agentRegistry.list(actor) }, requestId);
    return;
  }
  if (path === "/api/v1/agents" && method === "POST") {
    await authorization.assertPermission(actor.tenantId, actor.userId, "agent.manage");
    send(response, 201, await agentRegistry.register(actor, await readJson(request)), requestId);
    return;
  }
  const agentMatch = path.match(/^\/api\/v1\/agents\/([a-zA-Z0-9_-]+)$/);
  if (agentMatch && method === "GET") {
    await authorization.assertPermission(actor.tenantId, actor.userId, "agent.manage");
    send(response, 200, await agentRegistry.get(actor, agentMatch[1]!), requestId);
    return;
  }
  const agentVersionsMatch = path.match(/^\/api\/v1\/agents\/([a-zA-Z0-9_-]+)\/versions$/);
  if (agentVersionsMatch && method === "POST") {
    await authorization.assertPermission(actor.tenantId, actor.userId, "agent.manage");
    send(response, 201, await agentRegistry.publishVersion(actor, agentVersionsMatch[1]!, await readJson(request)), requestId);
    return;
  }
  const agentEvalMatch = path.match(/^\/api\/v1\/agents\/([a-zA-Z0-9_-]+)\/evaluations$/);
  if (agentEvalMatch && method === "GET") {
    await authorization.assertPermission(actor.tenantId, actor.userId, "agent.manage");
    send(response, 200, { items: await agentEvaluation.history(actor.tenantId, agentEvalMatch[1]!) }, requestId);
    return;
  }
  if (agentEvalMatch && method === "POST") {
    await authorization.assertPermission(actor.tenantId, actor.userId, "agent.manage");
    const input = z.object({ version: z.string().regex(/^\d+\.\d+\.\d+$/), testCaseId: z.string().min(1).max(160), score: z.number().min(0).max(100), passed: z.boolean(), durationMs: z.number().int().min(0).max(86_400_000), metrics: z.record(z.string(), z.number()).optional(), notes: z.string().max(4000).optional() }).strict().parse(await readJson(request));
    send(response, 201, await agentEvaluation.record(actor.tenantId, {
      agentId: agentEvalMatch[1]!, evaluatedById: actor.userId,
      version: input.version, testCaseId: input.testCaseId, score: input.score,
      passed: input.passed, durationMs: input.durationMs,
      ...(input.metrics ? { metrics: input.metrics } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
    }), requestId);
    return;
  }
  const agentActionMatch = path.match(/^\/api\/v1\/agents\/([a-zA-Z0-9_-]+)\/(activate|disable|archive)$/);
  if (agentActionMatch && method === "POST") {
    await authorization.assertPermission(actor.tenantId, actor.userId, "agent.manage");
    if (agentActionMatch[2] === "activate") {
      const input = z.object({ version: z.string().regex(/^\d+\.\d+\.\d+$/) }).strict().parse(await readJson(request));
      send(response, 200, await agentRegistry.activate(actor, agentActionMatch[1]!, input.version), requestId);
    } else if (agentActionMatch[2] === "disable") send(response, 200, await agentRegistry.disable(actor, agentActionMatch[1]!), requestId);
    else send(response, 200, await agentRegistry.archive(actor, agentActionMatch[1]!), requestId);
    return;
  }
  if (path === "/api/v1/agents/select" && method === "POST") {
    await authorization.assertPermission(actor.tenantId, actor.userId, "agent.manage");
    const input = z.object({ capabilities: z.array(AgentCapabilitySchema).min(1) }).strict().parse(await readJson(request));
    const candidates = await agentRepository.listCandidates(actor.tenantId);
    send(response, 200, agentSelection.select(candidates, input.capabilities), requestId);
    return;
  }
  const specialistMatch = path.match(/^\/api\/v1\/projects\/([a-zA-Z0-9_-]+)\/specialist$/);
  if (specialistMatch && method === "GET") {
    send(response, 200, await projectSpecialist.get(actor, specialistMatch[1]!), requestId);
    return;
  }
  if (specialistMatch && method === "POST") {
    send(response, 201, await projectSpecialist.save(actor, specialistMatch[1]!, await readJson(request)), requestId);
    return;
  }
  const memoryMatch = path.match(/^\/api\/v1\/projects\/([a-zA-Z0-9_-]+)\/agents\/([a-zA-Z0-9_-]+)\/memory$/);
  if (memoryMatch && method === "GET") {
    send(response, 200, { items: await agentMemory.list(actor, memoryMatch[1]!, memoryMatch[2]!) }, requestId);
    return;
  }
  if (memoryMatch && method === "POST") {
    const input = z.object({ key: z.string().min(1).max(160), value: z.unknown() }).strict().parse(await readJson(request));
    send(response, 200, await agentMemory.upsert(actor, memoryMatch[1]!, memoryMatch[2]!, input.key, input.value), requestId);
    return;
  }
  const projectWorkflowsMatch = path.match(/^\/api\/v1\/projects\/([a-zA-Z0-9_-]+)\/workflows$/);
  if (projectWorkflowsMatch && method === "GET") {
    const projectId = projectWorkflowsMatch[1]!;
    await requireWorkflowProjectAccess(actor, projectId, false);
    send(response, 200, { items: await workflowRepository.listWorkflows(actor.tenantId, projectId) }, requestId);
    return;
  }
  if (projectWorkflowsMatch && method === "POST") {
    const projectId = projectWorkflowsMatch[1]!;
    await requireWorkflowProjectAccess(actor, projectId, true);
    send(response, 201, await workflowDefinitions.create(actor.tenantId, actor.userId, await readJson(request), projectId), requestId);
    return;
  }
  const workflowActionMatch = path.match(/^\/api\/v1\/projects\/([a-zA-Z0-9_-]+)\/workflows\/([a-zA-Z0-9_-]+)\/(activate|versions)$/);
  if (workflowActionMatch && method === "POST") {
    const [, projectId, workflowId, action] = workflowActionMatch;
    await requireWorkflowProjectAccess(actor, projectId!, true);
    const result = action === "activate"
      ? await workflowDefinitions.activate(actor, workflowId!, projectId!)
      : await workflowDefinitions.publish(actor, workflowId!, await readJson(request), projectId!);
    send(response, 200, result, requestId);
    return;
  }
  const workflowRunsMatch = path.match(/^\/api\/v1\/projects\/([a-zA-Z0-9_-]+)\/workflow-runs$/);
  if (workflowRunsMatch && method === "POST") {
    const projectId = workflowRunsMatch[1]!;
    await requireWorkflowProjectAccess(actor, projectId, true);
    const input = z.object({ workflowId: z.string().min(1), input: z.unknown(), idempotencyKey: z.string().min(8).max(200) }).strict().parse(await readJson(request));
    const run = await workflowEngine.start(actor, { ...input, projectId });
    if (run.status === "PENDING") send(response, 201, await workflowEngine.resume(actor, run.id, projectId), requestId);
    else send(response, 200, run, requestId);
    return;
  }
  const workflowRunMatch = path.match(/^\/api\/v1\/projects\/([a-zA-Z0-9_-]+)\/workflow-runs\/([a-zA-Z0-9_-]+)(?:\/(resume|pause|cancel|approvals))?$/);
  if (workflowRunMatch) {
    const [, projectId, runId, action] = workflowRunMatch;
    await requireWorkflowProjectAccess(actor, projectId!, action ? true : false);
    if (!action && method === "GET") {
      const run = await workflowEngine.get(actor, runId!, projectId!);
      send(response, 200, { ...run, approvals: await workflowRepository.listApprovals(actor.tenantId, projectId!, runId!), traces: await workflowRepository.listTraces(actor.tenantId, projectId!, runId!) }, requestId);
      return;
    }
    if (action === "approvals" && method === "GET") {
      await workflowEngine.get(actor, runId!, projectId!);
      send(response, 200, { items: await workflowRepository.listApprovals(actor.tenantId, projectId!, runId!) }, requestId);
      return;
    }
    if (action === "resume" && method === "POST") { send(response, 200, await workflowEngine.resume(actor, runId!, projectId!), requestId); return; }
    if (action === "pause" && method === "POST") { send(response, 200, await workflowEngine.pause(actor, runId!, projectId!), requestId); return; }
    if (action === "cancel" && method === "POST") { send(response, 200, await workflowEngine.cancel(actor, runId!, projectId!), requestId); return; }
  }
  const workflowApprovalMatch = path.match(/^\/api\/v1\/projects\/([a-zA-Z0-9_-]+)\/workflow-approvals\/([a-zA-Z0-9_-]+)$/);
  if (workflowApprovalMatch && method === "POST") {
    const [, projectId, approvalId] = workflowApprovalMatch;
    await requireWorkflowProjectAccess(actor, projectId!, true);
    const input = z.object({ decision: z.enum(["APPROVED", "REJECTED"]), comment: z.string().max(4000).optional() }).strict().parse(await readJson(request));
    const decided = await workflowApprovals.decide(actor.tenantId, projectId!, approvalId!, actor.userId, input.decision, input.comment);
    send(response, 200, decided, requestId);
    return;
  }
  if (path === "/api/v1/projects" && method === "GET") {
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const rawLimit = Number(url.searchParams.get("limit") ?? "20");
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100) throw new Error("QUERY_LIMIT_INVALID");
    send(response, 200, { items: await projects.list(actor, cursor, rawLimit), limit: rawLimit }, requestId);
    return;
  }
  if (path === "/api/v1/projects" && method === "POST") {
    send(response, 201, await projects.create(actor, await readJson(request)), requestId);
    return;
  }
  const projectMatch = path.match(/^\/api\/v1\/projects\/([a-zA-Z0-9_-]+)$/);
  if (projectMatch && method === "GET") {
    const project = await projects.get(actor, projectMatch[1]!);
    if (!project) throw new Error("PROJECT_NOT_FOUND");
    send(response, 200, project, requestId);
    return;
  }
  const taskMatch = path.match(/^\/api\/v1\/projects\/([a-zA-Z0-9_-]+)\/tasks$/);
  if (taskMatch && method === "GET") {
    send(response, 200, { items: await tasks.list(actor, taskMatch[1]!) }, requestId);
    return;
  }
  if (taskMatch && method === "POST") {
    send(response, 201, await tasks.create(actor, taskMatch[1]!, await readJson(request)), requestId);
    return;
  }
  const providerMatch = path.match(/^\/api\/v1\/providers$/);
  if (providerMatch && method === "GET") {
    send(response, 200, { items: await providers.list(actor) }, requestId);
    return;
  }
  if (path === "/api/v1/providers" && method === "POST") {
    send(response, 201, await providers.create(actor, await readJson(request)), requestId);
    return;
  }
  const providerActionMatch = path.match(/^\/api\/v1\/providers\/([a-zA-Z0-9_-]+)\/(test-connection|enable|disable|rotate-key|revoke-key)$/);
  if (providerActionMatch && method === "POST") {
    const [, providerId, action] = providerActionMatch;
    if (action === "test-connection") send(response, 200, await providers.testConnection(actor, providerId!), requestId);
    else if (action === "enable") send(response, 200, await providers.setEnabled(actor, providerId!, true), requestId);
    else if (action === "disable") send(response, 200, await providers.setEnabled(actor, providerId!, false), requestId);
    else if (action === "rotate-key") {
      const input = z.object({ apiKey: z.string().min(1).max(4096) }).strict().parse(await readJson(request));
      send(response, 200, await providers.rotateKey(actor, providerId!, input.apiKey), requestId);
    } else send(response, 200, await providers.revokeKey(actor, providerId!), requestId);
    return;
  }
  const providerUpdateMatch = path.match(/^\/api\/v1\/providers\/([a-zA-Z0-9_-]+)$/);
  if (providerUpdateMatch && method === "PATCH") {
    send(response, 200, await providers.update(actor, providerUpdateMatch[1]!, await readJson(request)), requestId);
    return;
  }
  const providerModelsMatch = path.match(/^\/api\/v1\/providers\/([a-zA-Z0-9_-]+)\/models$/);
  if (providerModelsMatch && method === "GET") {
    send(response, 200, { items: await providers.listModels(actor, providerModelsMatch[1]!) }, requestId);
    return;
  }
  if (providerModelsMatch && method === "POST") {
    send(response, 201, await providers.addModel(actor, providerModelsMatch[1]!, await readJson(request)), requestId);
    return;
  }
  const providerModelActionMatch = path.match(/^\/api\/v1\/providers\/([a-zA-Z0-9_-]+)\/models\/([^/]+)\/(enable|disable|show|hide)$/);
  if (providerModelActionMatch && method === "POST") {
    const action = providerModelActionMatch[3]!;
    const result = action === "show" || action === "hide"
      ? await providers.setModelVisibility(actor, providerModelActionMatch[1]!, decodeURIComponent(providerModelActionMatch[2]!), action === "show")
      : await providers.setModelEnabled(actor, providerModelActionMatch[1]!, decodeURIComponent(providerModelActionMatch[2]!), action === "enable");
    send(response, 200, result, requestId);
    return;
  }
  if (path === "/api/v1/models" && method === "GET") {
    send(response, 200, { items: await modelRepository.listAvailable({ tenantId: actor.tenantId, projectId: actor.projectId }) }, requestId);
    return;
  }
  if (path === "/api/v1/model-policies" && method === "GET") {
    send(response, 200, await providers.getModelAvailabilityPolicy(actor), requestId);
    return;
  }
  if (path === "/api/v1/model-policies" && method === "PUT") {
    send(response, 200, await providers.setModelAvailabilityPolicy(actor, await readJson(request)), requestId);
    return;
  }
  if (path === "/api/v1/platform/model-policies" && method === "GET") {
    send(response, 200, await providers.getPlatformModelPolicy(actor), requestId);
    return;
  }
  if (path === "/api/v1/platform/model-policies" && method === "PUT") {
    send(response, 200, await providers.setPlatformModelPolicy(actor, await readJson(request)), requestId);
    return;
  }
  if (path === "/api/v1/models/route-preview" && method === "POST") {
    const input = z.object({ selection: z.record(z.string(), z.unknown()) }).strict().parse(await readJson(request));
    const selected = await modelSelection.select(input.selection, { tenantId: actor.tenantId, projectId: actor.projectId });
    send(response, 200, { providerKey: selected.model.providerKey, modelKey: selected.model.key, score: selected.score, reasons: selected.reasons }, requestId);
    return;
  }
  const projectAiExecutionMatch = path.match(/^\/api\/v1\/projects\/([a-zA-Z0-9_-]+)\/ai\/execute$/);
  if (projectAiExecutionMatch && method === "POST") {
    const projectId = projectAiExecutionMatch[1]!;
    await authorization.assertPermission(actor.tenantId, actor.userId, "execution.submit");
    await requireWorkflowProjectAccess(actor, projectId, true);
    const result = await providerRouter.execute(await readJson(request), {
      tenantId: actor.tenantId,
      projectId,
    });
    send(response, 200, {
      providerKey: result.providerKey,
      modelKey: result.modelKey,
      output: result.result.output,
      ...(result.result.usage ? { usage: result.result.usage } : {}),
      fallbackCount: result.fallbackCount,
      selectionReasons: result.selectionReasons,
    }, requestId);
    return;
  }
  send(response, 404, { code: "ROUTE_NOT_FOUND", message: "API route not found", requestId, retryable: false }, requestId);
}

export function createApiServer() {
  const allowedOrigin = process.env.WEB_ORIGIN ?? "http://127.0.0.1:4173";
  return createServer(async (request, response) => {
    const requestId = randomUUID();
    const origin = request.headers.origin;
    if (origin === allowedOrigin) {
      response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
      response.setHeader("Vary", "Origin");
      response.setHeader("Access-Control-Allow-Credentials", "true");
      response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Tenant-Id, X-Request-Id, X-CSRF-Token");
      response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      response.setHeader("Access-Control-Max-Age", "600");
    }
    if (request.method === "OPTIONS") { response.writeHead(origin === allowedOrigin ? 204 : 403).end(); return; }
    try { await route(request, response, requestId); }
    catch (error) {
      const result = errorResponse(error, requestId);
      if (result.status >= 500) logServerError(error, request, requestId);
      if (!response.headersSent) send(response, result.status, result.body, requestId);
      else response.destroy();
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.API_PORT ?? 3000);
  const host = process.env.API_HOST ?? "127.0.0.1";
  const server = createApiServer();
  server.listen(port, host, () => process.stdout.write(`Free AI Platform API listening on http://${host}:${port}\n`));
  const shutdown = () => server.close(async () => { await disconnectDatabase(); process.exit(0); });
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
