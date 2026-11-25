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

Identity uses tenant-scoped usernames and server-validated sessions. Email is
optional profile metadata and is not an authentication or recovery dependency.
The initial owner is created through a single-use, bootstrap-token-protected
operation; public self-registration is disabled. Browser sessions use opaque
server-persisted identifiers in HttpOnly cookies, with CSRF validation,
expiration, renewal, rotation, and revocation. Non-browser bearer auth remains
available for API/service clients. This work has focused integration evidence,
but the deployment is not production ready.

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
# Authentication session boundary (current implementation)

Browser login creates a cryptographically random opaque session identifier. The
API stores only its SHA-256 digest in the PostgreSQL `Session` row and returns it
as a `freeai_session` HttpOnly cookie. The cookie value includes a tenant lookup
hint; authorization always comes from the matching active database session and
the associated user, never from client-supplied roles or permissions. Session
idle expiry is 30 minutes and absolute expiry is 12 hours. Cookie sessions are
renewed on authenticated requests, rotated after password changes, and revoked
server-side at logout. Secure deployments set the `Secure` attribute. Mutating
cookie-authenticated requests require matching Origin and CSRF token values.

Non-browser bearer authentication remains supported for API/service clients.
It is not used by the web application. A tenant selector is an identity lookup
input, not an authorization grant; all database access is tenant-scoped.

This implementation has integration-test coverage, but TLS proxy deployment,
production key operations, complete threat-model acceptance, and full session
attack testing remain release work. See the current production closure report.

