# API Contracts

## Contract principles
- API versioning is mandatory.
- Request and response schemas are explicit.
- Validation occurs at the boundary.
- Errors use a consistent structure.
- Authentication and authorization are enforced server-side.
- Pagination is standardized.
- Idempotency is supported for retryable state-changing operations.
- No internal secret or stack trace is returned to clients.

## Initial resource groups
- /health
- /projects
- /projects/{projectId}/tasks
- /projects/{projectId}/files
- /agents
- /agents/{agentId}/versions
- /workflows
- /workflows/{workflowId}/runs
- /approvals
- /executions
- /audit-events

## Standard error fields
code, message, requestId, details, retryable.

## Security
Every project-scoped endpoint must verify project membership and action-level
permissions. Resource identifiers alone never grant access.

## Deferred
Concrete HTTP framework, REST/GraphQL split and generated client technology
must be approved through ADRs before implementation.
