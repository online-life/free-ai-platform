# Data Architecture

## Logical domains
- Platform identity and authorization.
- Projects and project settings.
- Tasks and dependencies.
- Agents and versions.
- Knowledge and memory.
- Files and artifacts.
- Workflows and workflow state.
- Tool definitions and execution records.
- Provider metadata and usage records.
- Audit and security events.

## Mandatory data principles
- Every entity has a stable identifier.
- Every mutable entity has created_at and updated_at.
- Important records retain actor attribution.
- Project-owned entities carry project scope.
- Tenant and project isolation are enforced at the data-access boundary.
- Sensitive data is classified.
- Retention and deletion rules are documented.
- Audit records are protected from ordinary modification.
- Schema changes are versioned and migrated.

## Relationships
A project owns tasks, project files, project memory and project workflows.
A task may have dependencies, execution attempts and deliverables.
An agent has immutable versions and evaluation records.
A workflow has versioned definitions and persisted runs.
An execution attempt belongs to a task and references an approved tool.
Audit events reference the actor and affected resource.

## Pending decisions
Physical database technology, partitioning, indexing, backup strategy and
retention periods require separate ADR approval.
