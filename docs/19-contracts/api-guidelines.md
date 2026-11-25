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
