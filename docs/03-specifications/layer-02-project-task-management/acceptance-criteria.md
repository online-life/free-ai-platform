# Layer 02 — Acceptance Criteria

## Project management
- Every project is scoped by tenantId.
- Project keys are unique inside a tenant.
- Project members have explicit roles.
- Every project read and mutation checks tenant and membership.
- Project lifecycle supports DRAFT, ACTIVE, ON_HOLD, COMPLETED, ARCHIVED, CANCELLED.

## Intake
- Intake requests are validated.
- Intake records preserve source, requester, priority, context and attachment references.
- Review actions require project review permission.

## Requirements
- Requirement codes are unique inside a project.
- Acceptance criteria are mandatory.
- Requirement records retain version and status.

## Tasks
- Tasks support hierarchy, estimates, due dates, assignees and requirement traceability.
- Parent tasks and requirement references must belong to the same project and tenant.
- Dependencies cannot cross project boundaries.
- Blocking dependency cycles are rejected.

## Project specialist and context
- Specialist profile is versioned.
- Context entries are versioned and tagged.
- Decisions, conventions, risks and glossary entries are supported.

## Files and activity
- File metadata references Layer 01 storage; this layer does not upload bytes.
- Comments are tenant/project scoped.
- Significant changes publish outbox events.

## Security
- No service query may fetch a project child record by ID alone.
- Tenant ID must come from authenticated request context, never user-controlled body data.
- Project role is checked before mutations.
- Database row-level security and cross-tenant integration tests remain mandatory before production approval.
