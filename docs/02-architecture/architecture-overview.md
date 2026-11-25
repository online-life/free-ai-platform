# Free AI Platform Architecture Overview

## Mission

Build one extensible AI platform that can understand and execute
general user requests across projects, domains, and technical stacks.

## Architecture Decision

Initial architecture: Modular Monolith with explicit module boundaries.

Microservices are not the default starting point.
They may be introduced later through documented architecture decisions.

## Current authentication boundary

Browser sessions use a random opaque identifier in an HttpOnly cookie; the
server stores its digest in PostgreSQL and derives identity and permissions
from that active row. CSRF tokens and exact Origin checks protect browser
mutations. Production cookies are Secure and SameSite=Strict. The browser does
not store authentication tokens in localStorage or sessionStorage. API bearer
authentication remains available to non-browser clients. See
`docs/20-security/authorization-model.md` and the final closure report for
controls, test evidence, and limitations.

## Layer 1: Platform Core & Foundation

Responsibilities:
- Platform configuration.
- Identity and authentication.
- Authorization and policy enforcement.
- Sessions and secrets.
- Project isolation foundations.
- Event Bus.
- Notifications.
- Audit logging.
- Storage abstractions.
- Knowledge and memory foundations.
- Backup and observability.

## Layer 2: Project & Task Management

Responsibilities:
- User instruction intake.
- Requirement analysis.
- Project creation and lifecycle.
- Independent project context.
- Project files and memory.
- Project Specialist.
- Task decomposition.
- Planning and dependencies.
- Task status and version history.

## Layer 3: Agent Ecosystem & Agent Factory

Responsibilities:
- Agent registry.
- Agent capabilities and role definitions.
- Agent creation and onboarding.
- Instruction-based training.
- Knowledge and example management.
- Agent permissions.
- Versioning and evaluation.
- Agent collaboration and coordination.

## Layer 4: Model Intelligence & Selection

Responsibilities:
- Model discovery.
- Capability classification.
- Model evaluation.
- Quality and availability testing.
- Routing decisions.
- Free-versus-paid verification.
- Periodic model review.
- Model health monitoring.

## Layer 5: Provider Management & Unified API Gateway

Responsibilities:
- Provider registry.
- Provider connectors.
- Secure key management.
- Quotas and usage limits.
- Provider health checks.
- Unified API interface.
- Request routing.
- Error handling and usage accounting.
- Key and quota expiration alerts.

No agent may bypass the approved gateway.

## Layer 6: Execution Engine

Responsibilities:
- Task execution.
- Tool registry and discovery.
- Runtime management.
- Sandbox and container isolation.
- Code and command execution.
- File operations.
- Dependency management.
- Network and resource controls.
- Timeouts and permissions.
- Output capture and cleanup.
- Execution audit records.

## Layer 7: Workflow & Orchestration Engine

Responsibilities:
- Workflow definitions.
- Planning and stage dependencies.
- Sequential and parallel execution.
- Agent and tool assignment.
- Human approval checkpoints.
- State persistence.
- Pause and resume.
- Retry and exception handling.
- Progress tracking.
- Workflow versioning and rollback.

## Standard Workflow

Intake
-> Analysis
-> Planning
-> Preparation
-> Execution
-> Validation
-> Delivery
-> Archiving

## Global Requirements

- One shared platform core.
- Independent project data and context.
- Extensible task and agent types.
- Free services only.
- Explicit authorization.
- Secure execution isolation.
- Complete auditability.
- Verifiable acceptance tests.

## Public website and provider identity boundary

The static web application renders named public routes separately from the
authenticated workspace. Private route hashes fall back to the public home
without a server-verified session. The public content API returns only
schema-validated site fields. Owner-controlled public content is stored in a
singleton deployment setting (not project or tenant workspace content); writes
require `platform.manage` and emit an audit event. Provider credentials,
connection records, workspace content, and model records are excluded from
the public response.

The provider identity registry mirrors only connector types implemented in the
API and uses neutral accessible marks because no verified official provider
artwork is checked in. Project execution sends an optional model selection,
which the server revalidates against current availability, privacy approval,
and free/self-hosted eligibility.
