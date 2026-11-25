#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/opt/free-ai"
cd "$ROOT"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "ERROR: Run from the current root setup shell."
  exit 1
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="$ROOT/.prelaunch-backups/$STAMP"
mkdir -p "$BACKUP"

echo "=========================================="
echo " FREE AI — PHASES 01 TO 07"
echo "=========================================="
echo "Project: $ROOT"
echo "Backup:  $BACKUP"

write_file() {
  local path="$1"
  shift
  mkdir -p "$(dirname "$path")"

  if [[ -f "$path" ]]; then
    mkdir -p "$BACKUP/$(dirname "$path")"
    cp -a "$path" "$BACKUP/$path"
  fi

  cat > "$path"
  echo "CREATED: $path"
}

# ==========================================================
# PHASE 1 — ENGINEERING STANDARDS
# ==========================================================

write_file docs/16-standards/engineering-standards.md <<'EOF'
# Free AI Platform Engineering Standards

Status: Project engineering baseline.

## 1. Purpose
These standards govern architecture, implementation, testing, security,
documentation, and changes across the entire Free AI Platform platform.

Normative terms:
- MUST: mandatory.
- MUST NOT: prohibited.
- SHOULD: recommended unless an exception is documented.
- MAY: optional.

Exceptions require an approved Architecture Decision Record (ADR).

## 2. Reference frameworks
The project uses these as engineering references, not as certification claims:

- ISO/IEC 25010: software product quality.
- OWASP ASVS: application security verification.
- OWASP Top 10: web application risk awareness.
- NIST SSDF SP 800-218: secure development practices.
- C4 Model: architecture documentation.
- Domain-Driven Design: bounded contexts and domain ownership.
- OpenAPI: HTTP API descriptions.
- AsyncAPI: asynchronous interface descriptions when applicable.
- Semantic Versioning: contract and package versioning.
- Conventional Commits: commit message conventions.
- Test Pyramid: unit, integration, contract, and acceptance tests.

## 3. Architecture principles
1. Modular Monolith first.
2. Separate control plane from execution plane.
3. Explicit module boundaries.
4. One authoritative owner for each domain aggregate.
5. No direct access to another module's private repository.
6. Cross-module calls use published application interfaces.
7. Events are versioned and consumers are idempotent.
8. Microservices require a documented business and operational reason.
9. No technology is accepted solely because it is popular.
10. Every architectural decision is documented.

## 4. Code standards
- TypeScript strict mode.
- No implicit any.
- Validate all untrusted inputs.
- Use explicit error types or stable error codes.
- Avoid circular dependencies.
- Avoid hidden global mutable state.
- Keep domain logic independent of frameworks.
- Keep infrastructure adapters outside the domain layer.
- Use dependency injection at composition boundaries.
- Keep functions and modules focused.
- Do not duplicate business rules.
- Do not introduce abstractions without a demonstrated need.

## 5. API standards
- Public APIs are versioned.
- Request and response schemas are explicit.
- Authentication and authorization are server-side.
- State-changing operations support idempotency where appropriate.
- Errors use stable machine-readable codes.
- Pagination is standardized.
- Sensitive data is never returned in error messages.
- API contracts are tested independently of implementation.

## 6. Data standards
- Every entity has an owner.
- Every project-owned record has project scope.
- Every state transition is validated.
- Database migrations are versioned.
- Data retention and deletion are documented.
- Audit events are protected against unauthorized modification.
- Timestamps are stored in UTC.
- Secrets are stored as references, not ordinary domain fields.

## 7. Security standards
- Deny by default.
- Least privilege.
- No secrets in source control.
- No secrets in logs.
- No untrusted code on the host.
- No unrestricted root execution for agents.
- No Docker socket exposure to untrusted workloads.
- Sandbox network access is denied by default.
- Resource limits are mandatory.
- Dependencies and images require provenance review.
- Sensitive operations require explicit authorization.

## 8. Testing standards
Every feature requires relevant:
- Unit tests.
- Contract tests.
- Integration tests.
- Architecture tests.
- Security tests.
- Acceptance tests.
- Failure and recovery tests.

A successful build is not proof of correctness.

## 9. Git standards
- Small, reviewable commits.
- Conventional Commit messages.
- No credentials or generated secrets.
- No model weights in source control.
- No local databases in source control.
- Architectural changes require ADR updates.
- Lockfiles must be committed when dependencies are approved.

## 10. Definition of Done
A feature is complete only when:
1. Requirements are documented.
2. Acceptance criteria pass.
3. Relevant automated tests pass.
4. Security implications are reviewed.
5. Documentation is updated.
6. Failure behavior is documented.
7. Auditability is verified where applicable.
8. Remaining limitations are recorded.

## 11. Required module artifacts
Each module must contain:
- README.md
- module-spec.md
- interfaces/
- tests/
- ownership declaration
- data ownership declaration
- security requirements
- acceptance criteria
EOF

# ==========================================================
# PHASE 2 — ARCHITECTURE
# ==========================================================

write_file docs/17-architecture/system-context.md <<'EOF'
# System Context — C4 Level 1

## System purpose
Free AI Platform is a multi-project AI agent platform. It receives user instructions,
maintains isolated project contexts, plans work, coordinates governed agents,
executes approved tools in restricted environments, validates deliverables,
and records evidence.

## Actors
- Platform Owner.
- Project Owner.
- Project Member.
- Platform Operator.
- Future AI Provider.
- Future external storage and notification systems.

## Trust boundaries
1. Client to API.
2. API to application modules.
3. Application modules to persistence.
4. Control plane to execution plane.
5. Sandbox to host.
6. Platform to external provider.
7. Project A to Project B.

## Main flow
User Request
-> Authentication
-> Project Authorization
-> Intake
-> Analysis
-> Planning
-> Approval when required
-> Workflow Scheduling
-> Agent Assignment
-> Tool Authorization
-> Isolated Execution
-> Validation
-> Delivery
-> Audit and Archiving

## Out of scope
- Model downloads.
- Provider selection.
- API key configuration.
- Provider activation.
- Production deployment.
EOF

write_file docs/17-architecture/architecture-overview.md <<'EOF'
# Free AI Platform Architecture Overview

Status: Baseline architecture.

## Architectural style
Modular Monolith with strict bounded contexts and a separate execution plane.

The control plane manages identity, projects, tasks, agents, policies, workflows,
provider metadata, audit and orchestration.

The execution plane runs untrusted tools in isolated, restricted environments.

Microservices are not the initial target. Extraction requires a documented ADR
supported by scaling, isolation, availability, ownership or deployment evidence.

## Layer 1 — Platform Core & Foundation
Owns:
- Identity and authentication.
- Sessions and authorization.
- Project and tenant boundaries.
- Configuration.
- Secret references.
- Audit.
- Notifications.
- Storage abstractions.
- Event interfaces.
- Observability.

Does not own task planning or model selection.

## Layer 2 — Project & Task Management
Owns:
- Project lifecycle.
- Project settings.
- Membership references.
- User request intake.
- Requirements.
- Task decomposition.
- Dependencies.
- Milestones.
- Project context references.
- Deliverable metadata.

Does not execute tools directly.

## Layer 3 — Agent Ecosystem
Owns:
- Agent registry.
- Agent definitions.
- Immutable versions.
- Capability declarations.
- Instruction packages.
- Evaluation results.
- Agent lifecycle.

Agents cannot grant themselves permissions.

## Layer 4 — Model Intelligence
Owns:
- Model catalog metadata.
- Capability taxonomy.
- Evaluation and benchmark evidence.
- Compatibility metadata.
- Selection policies.

It does not store provider secrets or make provider network calls.

## Layer 5 — Provider Gateway
Owns:
- Provider connectors.
- Credential references.
- Unified request and response contracts.
- Quotas and rate limits.
- Health checks.
- Retry policies.
- Usage accounting.
- Provider suspension.

All future provider traffic passes through this boundary.

## Layer 6 — Execution Engine
Owns:
- Tool registry.
- Execution job lifecycle.
- Sandbox lifecycle.
- Resource limits.
- Network and filesystem restrictions.
- Output capture.
- Artifact transfer.
- Cleanup.

Untrusted code never runs directly on the host.

## Layer 7 — Workflow & Orchestration
Owns:
- Workflow definitions and versions.
- Workflow runs.
- State transitions.
- Scheduling.
- Dependencies.
- Approval gates.
- Pause and resume.
- Retry policies.
- Progress events.

It coordinates modules without bypassing their authorization.

## Dependency direction
Presentation -> Application -> Domain.
Infrastructure adapters implement application/domain ports.
Domain logic has no framework or database dependency.
Modules do not import other modules' private implementations.

## Standard lifecycle
INTAKE -> AUTHORIZATION -> ANALYSIS -> PLANNING ->
APPROVAL -> SCHEDULING -> EXECUTION -> VALIDATION ->
DELIVERY -> ARCHIVING.

Approval is conditional. Silence is never approval.

## Cross-cutting controls
- Project isolation.
- Authentication and authorization.
- Audit and correlation IDs.
- Input and output validation.
- Idempotency.
- Timeouts and cancellation.
- Observability.
- Retention and deletion.
EOF

write_file docs/17-architecture/module-boundaries.md <<'EOF'
# Module Boundaries

| Module | Owns | Must not own |
|---|---|---|
| Identity | Principals, sessions, credentials metadata | Project task content |
| Authorization | Roles, permissions, grants, policies | User passwords |
| Projects | Project lifecycle and settings | Global identity |
| Tasks | Tasks, dependencies, acceptance criteria | Tool execution |
| Agents | Agent definitions and versions | Permission decisions |
| Model Catalog | Model metadata and evaluations | Provider credentials |
| Provider Gateway | Connectors, quotas, usage | Workflow planning |
| Tools | Tool metadata and schemas | Host execution |
| Execution | Jobs, sandbox lifecycle, outputs | Unrestricted host access |
| Workflows | Definitions, runs, approvals | Bypassing module policies |
| Audit | Audit records | Mutable business state |
| Artifacts | Artifact metadata and storage adapter | Business authorization rules |

## Rules
- One module owns writes to its aggregate data.
- Other modules use public interfaces or approved projections.
- Domain logic must not join private tables from other modules.
- Cross-module transactions should be avoided.
- Use an outbox pattern when reliable event publication is required.
- Shared tables require an ADR and explicit ownership.
EOF

write_file docs/17-architecture/deployment-topology.md <<'EOF'
# Logical Deployment Topology

This document defines logical deployment units, not an instruction to deploy them.

## Target units
1. Web client.
2. API/control-plane application.
3. Trusted background worker.
4. Isolated execution worker pool.
5. Relational database.
6. Optional cache/coordination service.
7. Object storage adapter.
8. Observability stack.

## Isolation
- Execution workers do not share the API process identity.
- Execution workers have no database administrator credentials.
- Jobs use scoped, short-lived grants.
- Internal communication is authenticated.
- Secrets are injected at runtime.
- Persistent volumes are explicit and backed up.

## Environments
Development, test, staging, and production must have separate credentials,
data stores, and provider settings.

## Deferred
No containers are built or started in the preparation phase.
EOF

# ==========================================================
# PHASE 3 — DATA DESIGN
# ==========================================================

write_file docs/18-data-design/logical-data-model.md <<'EOF'
# Logical Data Model

This is a logical model. Physical database technology remains an ADR decision.

## Identity
Principal(id, type, status, created_at)
UserProfile(principal_id, display_name, locale, timezone)
Credential(principal_id, type, secret_reference, status, rotated_at)
Session(id, principal_id, issued_at, expires_at, revoked_at)
Role(id, scope_type, name)
Permission(id, resource, action)
RolePermission(role_id, permission_id)
PrincipalGrant(id, principal_id, role_id, scope_type, scope_id, granted_by, expires_at)

## Projects
Project(id, name, status, owner_principal_id, created_at, updated_at)
ProjectMembership(project_id, principal_id, status, joined_at)
ProjectSetting(project_id, key, value_reference, updated_at)

## Tasks
Task(id, project_id, created_by, title, description_ref, status, priority, version)
TaskDependency(task_id, depends_on_task_id, dependency_type)
TaskAcceptanceCriterion(id, task_id, description, verification_method, status)
TaskAttempt(id, task_id, attempt_number, status, started_at, ended_at, failure_code)
Deliverable(id, project_id, task_id, artifact_id, version, validation_status)

## Agents
Agent(id, name, purpose, lifecycle_status)
AgentVersion(id, agent_id, version, instruction_ref, capability_manifest_ref)
AgentEvaluation(id, agent_version_id, suite_version, result_ref, evaluated_at)
AgentAssignment(id, agent_version_id, task_id, granted_scope_ref, status)

## Models and providers
ModelCatalogEntry(id, provider_family, model_name, capabilities_ref, license_status)
ModelEvaluation(id, model_id, benchmark_suite, result_ref, evaluated_at)
Provider(id, name, lifecycle_status)
ProviderConnectorVersion(id, provider_id, version, compatibility_ref)
ProviderCredentialReference(id, provider_id, secret_reference, status)
ProviderUsage(id, provider_id, project_id, task_id, request_id, units, occurred_at)

## Tools and execution
ToolDefinition(id, name, version, input_schema_ref, output_schema_ref, risk_level)
ExecutionJob(id, project_id, task_id, tool_id, status, policy_snapshot_ref)
ExecutionAttempt(id, job_id, attempt_number, sandbox_ref, resource_usage_ref, status)
Artifact(id, project_id, storage_key, media_type, checksum, size_bytes, classification)
ArtifactScan(id, artifact_id, scanner, result, scanned_at)

## Workflows
WorkflowDefinition(id, name, version, definition_ref, status)
WorkflowRun(id, workflow_definition_id, project_id, task_id, status, state_version)
WorkflowStepRun(id, workflow_run_id, step_key, status, input_ref, output_ref)
ApprovalRequest(id, workflow_run_id, action, requested_from, status, decision_at)
WorkflowEvent(id, workflow_run_id, event_type, event_version, occurred_at, payload_ref)

## Audit and reliability
AuditEvent(id, actor_id, project_id, action, target_type, target_id, outcome,
           occurred_at, correlation_id, details_ref)
OutboxMessage(id, aggregate_type, aggregate_id, event_type, payload,
              occurred_at, published_at)
IdempotencyRecord(scope, key, request_hash, response_ref, expires_at)

## Invariants
1. Project-owned records have project scope.
2. Every access checks membership and action permission.
3. Task dependency graphs are acyclic.
4. Published agent versions are immutable.
5. Workflow transitions are validated.
6. Completed executions have terminal results and audit evidence.
7. Artifact access checks project and classification.
8. Credential values never live in ordinary domain tables.
9. Timestamps use UTC.
10. Deletion respects retention and audit requirements.

## Physical design still required
Database engine, exact column types, indexes, row-level security, partitioning,
encryption, migration tooling, backup RPO/RTO and retention need separate approval.
EOF

write_file docs/18-data-design/project-isolation.md <<'EOF'
# Project Isolation

## Access decision
Allow only when:
1. Principal is authenticated and active.
2. Project exists and is active.
3. Principal has active membership or explicit service grant.
4. Action is permitted for the resource and scope.
5. Resource belongs to the requested project.
6. Classification and approval conditions are satisfied.

## Enforcement points
- API authentication and scope guard.
- Application-level authorization.
- Project-scoped repository methods.
- Database row-level security where supported.
- Object storage authorization broker.
- Project-scoped cache keys.
- Mandatory project filters in search.
- Background job authorization.
- Export and download authorization.

## Prohibited
- Query by resource ID without project scope.
- Trusting client-supplied project ID.
- UI-only isolation.
- Shared cache keys without project namespace.
- Unfiltered global search.
- Cross-project memory retrieval by similarity alone.

## Required tests
Use at least two projects and test read, update, delete, search, cache,
download, export, and background jobs for cross-project access denial.
EOF

# ==========================================================
# PHASE 4 — API AND EVENT CONTRACTS
# ==========================================================

write_file docs/19-contracts/api-guidelines.md <<'EOF'
# API Contract Guidelines

## Baseline
HTTP JSON APIs. REST is the default initial public API style.
GraphQL is not assumed and requires a separate ADR.

## Request context
- request_id
- correlation_id
- authenticated principal
- project scope where applicable
- idempotency key for supported mutations

## Success response
- data
- meta

## Error response
- error.code
- error.message
- error.request_id
- error.details
- error.retryable

## Rules
- Validate path, query, headers and body.
- Do not expose database entities directly.
- Use stable error codes.
- Apply request size and rate limits.
- Avoid resource enumeration leaks.
- Use cursor pagination for large changing datasets.
- Document auth, permissions, limits and examples in OpenAPI.

## Initial resource groups
/v1/auth
/v1/projects
/v1/projects/{projectId}/members
/v1/projects/{projectId}/tasks
/v1/agents
/v1/agent-versions
/v1/workflows
/v1/workflow-runs
/v1/approvals
/v1/tools
/v1/executions
/v1/artifacts
/v1/audit-events

This is a resource outline, not a final endpoint specification.
EOF

write_file docs/19-contracts/event-guidelines.md <<'EOF'
# Event Contract Guidelines

## Event envelope
{
  "eventId": "opaque-id",
  "eventType": "task.status_changed",
  "eventVersion": 1,
  "occurredAt": "UTC ISO-8601",
  "producer": "task-management",
  "projectId": "project-id",
  "actorId": "principal-id",
  "correlationId": "correlation-id",
  "causationId": "prior-event-or-command-id",
  "payload": {}
}

## Delivery
Assume at-least-once delivery.
Consumers must be idempotent.
Do not claim exactly-once end-to-end delivery.
Use transactional outbox where state and event publication must remain consistent.

## Event names
domain.past_tense_action

Examples:
project.created
task.created
task.status_changed
workflow.approval_requested
workflow.paused
execution.completed
execution.failed
security.authorization_denied

## Security
- No secrets in events.
- Minimize personal data.
- Validate event schema and producer.
- Treat payloads as untrusted.
- Recheck authorization before protected side effects.
EOF

write_file docs/19-contracts/error-catalog.md <<'EOF'
# Initial Error Catalog

| Code | Meaning | Retryable |
|---|---|---|
| AUTH_UNAUTHENTICATED | Missing or invalid identity | No |
| AUTH_FORBIDDEN | Action not permitted | No |
| PROJECT_NOT_FOUND | Project unavailable or not visible | No |
| PROJECT_SCOPE_MISMATCH | Resource belongs to another project | No |
| VALIDATION_FAILED | Input failed validation | No |
| CONFLICT_STATE | Requested transition is invalid | No |
| IDEMPOTENCY_CONFLICT | Same key used with different request | No |
| RATE_LIMITED | Request rate exceeded | Yes, after delay |
| DEPENDENCY_UNAVAILABLE | Required dependency unavailable | Usually |
| EXECUTION_TIMEOUT | Workload exceeded time limit | Policy-dependent |
| EXECUTION_POLICY_DENIED | Execution violates policy | No |
| APPROVAL_REQUIRED | Explicit approval is pending | After approval |
| INTERNAL_ERROR | Unexpected internal failure | Unknown |

Do not expose stack traces or secrets in client-facing errors.
EOF

# ==========================================================
# PHASE 5 — SECURITY
# ==========================================================

write_file docs/20-security/threat-model.md <<'EOF'
# Security Threat Model

## Assets
- Identity and sessions.
- Project data and memory.
- Files and artifacts.
- Agent instructions and tools.
- Credentials and secret references.
- Execution infrastructure.
- Audit records.

## Threats
- Cross-project data leakage.
- Prompt injection.
- Unauthorized tool execution.
- Malicious dependencies.
- Container escape.
- Secret disclosure.
- Privilege escalation.
- Supply-chain compromise.
- Denial of service.
- Audit tampering.

## Controls
- Least privilege.
- Explicit project authorization.
- Input and output validation.
- Secret redaction.
- Sandbox execution.
- Network deny-by-default.
- Resource limits.
- Dependency provenance checks.
- Tamper-evident audit strategy.
- Security tests for every trust boundary.

## Root host
The setup operator currently uses root. This does not authorize application
workloads to run as unrestricted root. Never execute generated or untrusted
code directly on the host as root. Never expose the Docker socket to workloads.

## Incident response
Document detection, containment, credential rotation, evidence preservation,
recovery and post-incident review before production use.
EOF

write_file docs/20-security/authorization-model.md <<'EOF'
# Authorization Model

## Principal types
Human user, service principal, system process, and future agent identity.

Agents are not inherently trusted and have no implicit permissions.

## Scope hierarchy
Platform -> Tenant (optional future scope) -> Project -> Resource.

A broad grant applies downward only when policy explicitly permits it.

## Permission tuple
(subject, action, resource, scope, conditions, expiry)

## Default
Deny unless an explicit active grant and all conditions match.

## Separation of duties
- Platform owner manages platform policy.
- Project owner manages project membership and grants.
- Agents receive task-scoped, time-bounded capabilities.
- Execution workers receive job-scoped grants.
- Auditors can inspect audit data but cannot modify business state.

## Sensitive operations
Credential changes, provider activation, external network access, destructive
operations, privilege elevation, data export and production deployment require
explicit approval according to policy.

## Revocation
Revocation must affect subsequent authorization checks and constrain active
sessions/jobs according to risk policy.
EOF

write_file docs/20-security/data-classification.md <<'EOF'
# Data Classification

## Classes
- Public.
- Internal.
- Confidential.
- Restricted.

## Handling
Public: approved for publication.
Internal: authenticated access.
Confidential: project-scoped access, encryption, audit and export controls.
Restricted: dedicated secret handling, least privilege, no ordinary logs,
short-lived access, rotation and explicit approval.

## AI processing
No project content is sent to an external model until provider terms, retention,
training-use policy, region, security and user authorization are reviewed.
EOF

# ==========================================================
# PHASE 6 — TECHNOLOGY ADRs
# ==========================================================

write_file docs/21-technology-decisions/ADR-0001-modular-monolith.md <<'EOF'
# ADR-0001 — Modular Monolith

Status: Accepted

Decision:
Start with one control-plane application using strict bounded contexts.
Keep untrusted execution in a separate restricted execution plane.

Reason:
Avoid premature distributed-system complexity while preserving module ownership.

Consequences:
Module boundaries must be enforced by tests.
Service extraction requires a new evidence-based ADR.
EOF

write_file docs/21-technology-decisions/ADR-0002-typescript-node.md <<'EOF'
# ADR-0002 — TypeScript and Node.js

Status: Proposed

Candidate:
TypeScript on Node.js 22 with pnpm.

Reason:
The current environment already contains Node.js and pnpm, and TypeScript
supports shared contracts across application modules.

Before acceptance:
Verify runtime support lifecycle, package licenses, framework compatibility,
lockfile reproducibility, static analysis and test results.

No dependencies are installed by this ADR.
EOF

write_file docs/21-technology-decisions/ADR-0003-backend-framework.md <<'EOF'
# ADR-0003 — Backend Framework

Status: Proposed

Candidates:
- NestJS.
- Fastify with explicit module architecture.

Evaluation:
Security maintenance, dependency injection, module boundaries, validation,
OpenAPI, testing, performance, ecosystem, license and operational complexity.

Decision gate:
Build a small proof of concept with health endpoint, validation, auth boundary
and contract tests before acceptance.
EOF

write_file docs/21-technology-decisions/ADR-0004-data-platform.md <<'EOF'
# ADR-0004 — Data Platform

Status: Proposed

Candidates:
- PostgreSQL for transactional relational data.
- Redis only for a demonstrated cache, coordination, rate-limit or queue need.
- S3-compatible storage for artifacts.

Evaluation:
Isolation, row-level security, migrations, backup/restore, encryption, indexing,
search requirements, resource footprint, license and operational cost.

Redis is not the system of record.
Do not install services before data design and restore tests are approved.
EOF

write_file docs/21-technology-decisions/ADR-0005-api-contracts.md <<'EOF'
# ADR-0005 — API Contracts

Status: Proposed

Candidates:
- OpenAPI for HTTP APIs.
- JSON Schema for payload validation.
- AsyncAPI if an event broker is adopted.

REST is the default initial public API.
GraphQL requires a separate justification.

Verify tooling maintenance, generated client quality, compatibility and licenses.
EOF

write_file docs/21-technology-decisions/ADR-0006-execution-isolation.md <<'EOF'
# ADR-0006 — Execution Isolation

Status: Security requirement accepted; implementation technology open.

Untrusted code must run outside the control-plane process in a restricted
execution boundary. It must never run directly on the host as unrestricted root.

Evaluate:
- rootless containers;
- hardened OCI runtimes;
- gVisor;
- microVM isolation;
- other maintained sandbox technologies.

Compare kernel attack surface, privilege model, networking, filesystem,
resource enforcement, compatibility, license and maintenance.

Docker alone is not automatically a sufficient hostile-code sandbox.
Never expose the Docker socket to a workload.
EOF

write_file docs/21-technology-decisions/ADR-0007-frontend.md <<'EOF'
# ADR-0007 — Frontend

Status: Proposed

Candidates:
- Next.js with TypeScript.
- React with Vite where server rendering is not required.

Evaluate:
Supported versions, security, accessibility, routing, internationalization,
authentication integration, bundle size, deployment, testability and license.
EOF

write_file docs/21-technology-decisions/ADR-0008-free-provider-policy.md <<'EOF'
# ADR-0008 — Free Provider Policy

Status: Accepted

No model or provider is selected or activated during foundation preparation.

A provider is not free merely because it offers temporary credits or a trial.
Verify license, commercial rights, pricing, quota, rate limits, data retention,
training policy, region, uptime, key expiry and fallback behavior.

If free status becomes ambiguous or changes, suspend usage pending review.
EOF

write_file docs/21-technology-decisions/ADR-0009-search-and-analytics.md <<'EOF'
# ADR-0009 — Search and Analytics

Status: Proposed

Search and analytics technologies are not selected yet.

Evaluate only when real workloads and data volumes are defined.
Consider whether PostgreSQL capabilities are sufficient before introducing
a separate search engine or analytics database.

Criteria:
- functional requirements;
- data volume and query patterns;
- operational burden;
- security and project isolation;
- licensing;
- backup and recovery;
- resource consumption.
EOF

# ==========================================================
# PHASE 7 — SOURCE SKELETON
# ==========================================================

write_file pnpm-workspace.yaml <<'EOF'
packages:
  - "apps/*"
  - "packages/*"
  - "services/*"
EOF

write_file package.json <<'EOF'
{
  "name": "free-ai-platform",
  "version": "0.1.0",
  "private": true,
  "description": "Provider-neutral multi-project AI agent platform",
  "packageManager": "pnpm@9.12.0",
  "scripts": {
    "check:structure": "node scripts/check-structure.mjs"
  }
}
EOF

write_file tsconfig.base.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  }
}
EOF

write_file .npmrc <<'EOF'
save-exact=true
engine-strict=true
EOF

write_file packages/contracts/src/index.ts <<'EOF'
export type Brand<T, Name extends string> =
  T & { readonly __brand: Name };

export type ProjectId = Brand<string, "ProjectId">;
export type PrincipalId = Brand<string, "PrincipalId">;
export type TaskId = Brand<string, "TaskId">;
export type CorrelationId = Brand<string, "CorrelationId">;

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export interface RequestContext {
  readonly requestId: string;
  readonly correlationId: CorrelationId;
  readonly actorId: PrincipalId;
  readonly projectId?: ProjectId;
}

export interface DomainEvent<TPayload = unknown> {
  readonly eventId: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly occurredAt: string;
  readonly producer: string;
  readonly correlationId: CorrelationId;
  readonly projectId?: ProjectId;
  readonly actorId?: PrincipalId;
  readonly payload: TPayload;
}
EOF

write_file packages/shared/src/index.ts <<'EOF'
export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  newId(): string;
}

export interface Logger {
  info(message: string, fields?: Readonly<Record<string, unknown>>): void;
  warn(message: string, fields?: Readonly<Record<string, unknown>>): void;
  error(message: string, fields?: Readonly<Record<string, unknown>>): void;
}

export interface AuditWriter {
  record(event: {
    actorId?: string;
    projectId?: string;
    action: string;
    targetType: string;
    targetId?: string;
    outcome: "success" | "denied" | "failure";
    correlationId: string;
  }): Promise<void>;
}
EOF

write_file packages/config/src/index.ts <<'EOF'
export interface AppConfig {
  readonly nodeEnv: "development" | "test" | "production";
  readonly appName: string;
  readonly logLevel: "debug" | "info" | "warn" | "error";
}

export function parseAppConfig(
  input: Record<string, string | undefined>,
): AppConfig {
  const nodeEnv = input.NODE_ENV ?? "development";
  const logLevel = input.LOG_LEVEL ?? "info";

  if (!["development", "test", "production"].includes(nodeEnv)) {
    throw new Error("CONFIG_INVALID_NODE_ENV");
  }

  if (!["debug", "info", "warn", "error"].includes(logLevel)) {
    throw new Error("CONFIG_INVALID_LOG_LEVEL");
  }

  return {
    nodeEnv: nodeEnv as AppConfig["nodeEnv"],
    appName: input.APP_NAME?.trim() || "Free AI Platform",
    logLevel: logLevel as AppConfig["logLevel"],
  };
}
EOF

write_file services/ai-runtime/src/provider-neutral.ts <<'EOF'
/**
 * Provider-neutral interface only.
 * No provider SDK, credentials, model name, or inference implementation.
 */
export interface GenerationRequest {
  readonly taskId: string;
  readonly projectId: string;
  readonly input: unknown;
  readonly outputSchema?: unknown;
  readonly timeoutMs: number;
}

export interface GenerationResult {
  readonly output: unknown;
  readonly usage?: {
    readonly inputUnits?: number;
    readonly outputUnits?: number;
  };
}

export interface ModelRuntime {
  generate(request: GenerationRequest): Promise<GenerationResult>;
}
EOF

write_file apps/api/src/main.ts <<'EOF'
/**
 * API composition root placeholder.
 * Framework selection is pending ADR approval.
 */
export const API_APPLICATION_ID = "free-ai-api";
EOF

write_file apps/web/README.md <<'EOF'
# Web Application

UI implementation is deferred until API contracts, identity flows,
accessibility, and internationalization requirements are approved.

Authorization must never exist exclusively in the client.
EOF

write_file services/ai-runtime/README.md <<'EOF'
# AI Runtime

Provider-neutral contracts only.
No provider SDK, API key, model download, model weight or inference
implementation is permitted until the provider evaluation phase is approved.
EOF

write_file tests/architecture/architecture-rules.md <<'EOF'
# Architecture Test Requirements

Automate checks that:
- domain modules do not import framework or infrastructure packages;
- modules do not import other modules' private internals;
- provider SDKs are absent before provider approval;
- API code does not execute user-supplied code;
- contracts remain framework-neutral;
- execution workers do not share the API process security identity;
- project scope is mandatory for project-owned access.
EOF

# ==========================================================
# GOVERNANCE LINKAGE
# ==========================================================

for f in CLAUDE.md AGENTS.md; do
  if [[ -f "$f" ]] && ! grep -q "docs/16-standards/engineering-standards.md" "$f"; then
    cat >> "$f" <<'EOF'

## Engineering Standards
Follow `docs/16-standards/engineering-standards.md`,
`docs/17-architecture/architecture-overview.md`,
and the relevant data, contract, security, and module specifications.
Proposed ADRs are not approved technology decisions.
Do not download models, activate providers, or start services without explicit approval.
EOF
  fi
done

# ==========================================================
# PRE-LAUNCH ACCEPTANCE AND REPORTING
# ==========================================================

write_file docs/15-prelaunch/PHASES-01-07-ACCEPTANCE.md <<'EOF'
# Acceptance Gates — Phases 1–7

## Phase 1 — Standards
- [ ] Engineering standards reviewed.
- [ ] Definition of Done adopted.
- [ ] Exception and ADR process approved.

## Phase 2 — Architecture
- [ ] Seven layer ownership reviewed.
- [ ] Module boundaries reviewed.
- [ ] Control plane and execution plane separated.
- [ ] Failure and dependency rules reviewed.

## Phase 3 — Data
- [ ] Logical entities reviewed.
- [ ] Invariants reviewed.
- [ ] Project isolation strategy approved.
- [ ] Physical database design remains a separate approval.

## Phase 4 — Contracts
- [ ] API conventions reviewed.
- [ ] Event envelope reviewed.
- [ ] Error catalog reviewed.
- [ ] Versioning and idempotency rules reviewed.

## Phase 5 — Security
- [ ] Threat model reviewed.
- [ ] Authorization model reviewed.
- [ ] Data classification reviewed.
- [ ] Sandbox technology remains subject to evaluation.

## Phase 6 — Technology
- [ ] ADR status reviewed.
- [ ] Proposed technologies benchmarked before acceptance.
- [ ] Licenses and support status verified before installation.
- [ ] Provider selection remains deferred.

## Phase 7 — Code skeleton
- [ ] Workspace metadata present.
- [ ] Contracts and shared primitives present.
- [ ] Configuration validation present.
- [ ] No dependencies installed by this package.
- [ ] No service started.

## Final gate
This package is a design and skeleton baseline, not a production-ready application.
Implementation and verification are still required.
EOF

write_file docs/15-prelaunch/PACKAGE-APPLICATION-REPORT.md <<EOF
# Package Application Report

- Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)
- Project: $ROOT
- Backup: $BACKUP

The preparation script generated documentation, ADRs, contract guidance,
security specifications, and source skeleton files.

It did not:
- install dependencies;
- start services;
- run database migrations;
- download models or weights;
- configure API keys;
- select or activate providers;
- deploy the platform.
EOF

# ==========================================================
# CHECKS
# ==========================================================

echo
echo "===== VALIDATION ====="

required=(
  docs/16-standards/engineering-standards.md
  docs/17-architecture/architecture-overview.md
  docs/17-architecture/module-boundaries.md
  docs/18-data-design/logical-data-model.md
  docs/18-data-design/project-isolation.md
  docs/19-contracts/api-guidelines.md
  docs/19-contracts/event-guidelines.md
  docs/20-security/threat-model.md
  docs/20-security/authorization-model.md
  docs/21-technology-decisions/ADR-0001-modular-monolith.md
  docs/21-technology-decisions/ADR-0008-free-provider-policy.md
  packages/contracts/src/index.ts
  packages/shared/src/index.ts
  packages/config/src/index.ts
  services/ai-runtime/src/provider-neutral.ts
  pnpm-workspace.yaml
  package.json
  tsconfig.base.json
  tests/architecture/architecture-rules.md
)

failed=0
for f in "${required[@]}"; do
  if [[ -s "$f" ]]; then
    echo "OK      $f"
  else
    echo "MISSING $f"
    failed=1
  fi
done

echo
echo "===== SCRIPT SYNTAX ====="
bash -n scripts/package-builder/build-phases-01-07.sh

echo
echo "===== SECRET IGNORE RULES ====="
grep -qxF '.env' .gitignore || echo '.env' >> .gitignore
grep -qxF '.env.*' .gitignore || echo '.env.*' >> .gitignore
grep -qxF '!.env.example' .gitignore || echo '!.env.example' >> .gitignore
grep -qxF '.prelaunch-backups/' .gitignore || echo '.prelaunch-backups/' >> .gitignore

echo
echo "===== INVENTORY ====="
find docs/16-standards docs/17-architecture docs/18-data-design \
  docs/19-contracts docs/20-security docs/21-technology-decisions \
  packages services/ai-runtime apps tests/architecture \
  -type f | sort

echo
echo "===== GIT STATUS ====="
git status --short

if [[ "$failed" -ne 0 ]]; then
  echo "PREPARATION FAILED"
  exit 1
fi

echo
echo "PHASES 01–07 FILE GENERATION COMPLETED."
echo "No dependencies installed."
echo "No services started."
echo "No models or providers configured."
echo "Review files before committing."
