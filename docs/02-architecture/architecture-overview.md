# Free AI Architecture Overview

## Mission

Build one extensible AI platform that can understand and execute
general user requests across projects, domains, and technical stacks.

## Architecture Decision

Initial architecture: Modular Monolith with explicit module boundaries.

Microservices are not the default starting point.
They may be introduced later through documented architecture decisions.

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
