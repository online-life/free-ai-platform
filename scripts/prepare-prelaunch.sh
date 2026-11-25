#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/opt/free-ai"
cd "$ROOT"

echo "===== FREE AI PRE-LAUNCH PREPARATION ====="

# 1. Create complete documentation structure
mkdir -p \
  docs/03-specifications/layer-01-platform-core \
  docs/03-specifications/layer-02-project-task-management \
  docs/03-specifications/layer-03-agent-ecosystem \
  docs/03-specifications/layer-04-model-intelligence \
  docs/03-specifications/layer-05-provider-gateway \
  docs/03-specifications/layer-06-execution-engine \
  docs/03-specifications/layer-07-workflow-orchestration \
  docs/08-data-design \
  docs/09-api-contracts \
  docs/10-event-contracts \
  docs/11-security \
  docs/12-testing \
  docs/13-operations \
  docs/14-technology-decisions \
  docs/15-prelaunch \
  packages/database \
  packages/contracts \
  packages/shared \
  packages/config \
  apps/api \
  apps/web \
  services/ai-runtime \
  infra/docker \
  infra/compose \
  infra/scripts \
  tests/architecture \
  tests/unit \
  tests/integration \
  tests/security \
  tests/acceptance

# 2. Global engineering rules
cat > docs/00-governance/engineering-rules.md <<'EOF'
# Free AI Platform Engineering Rules

## Architecture
- One shared platform core for all projects.
- Modular Monolith first.
- Modules communicate through defined interfaces and contracts.
- No duplicated platform foundation per project.
- No premature microservices.
- Every module has explicit ownership and boundaries.

## Project isolation
- Every project has independent data, memory, files, settings and permissions.
- Cross-project access is denied by default.
- Project context must never leak into another project.

## Agent governance
- Agents operate only within assigned permissions.
- Agents cannot modify platform governance or override user instructions.
- All agent actions are attributable and auditable.
- Agent creation and updates require versioning and evaluation.

## AI provider governance
- Model and provider integrations are deferred.
- No paid service may be activated.
- No provider may be accessed outside the future unified gateway.
- Free-tier claims must be verified before activation.

## Execution
- Never execute untrusted code on the host.
- Never execute agent-generated commands as unrestricted root.
- Use isolated execution environments.
- Network access is denied by default.
- Resource and time limits are mandatory.

## Quality
- No feature is complete without acceptance tests.
- No undocumented architectural change.
- No secrets in source control.
- Every change must include a verification report.
EOF

# 3. Detailed layer specifications
cat > docs/03-specifications/layer-01-platform-core/platform-core.md <<'EOF'
# Layer 01 — Platform Core & Foundation

## Purpose
Provide the shared foundation used by every project, agent, workflow and service.

## Components
1. Platform configuration and environment management.
2. Identity, authentication and session management.
3. Authorization and policy enforcement.
4. Project and tenant isolation.
5. Secret references and secure configuration.
6. Audit trail and security event recording.
7. Notifications.
8. File and object storage abstraction.
9. Knowledge and memory infrastructure.
10. Event bus abstraction.
11. Backup and recovery coordination.
12. Health and observability interfaces.

## Requirements
- Every request has an authenticated principal or an explicitly defined system identity.
- Every operation is checked against authorization policies.
- Project-scoped records require a project identifier.
- Cross-project queries are denied unless an explicit policy permits them.
- Sensitive operations require stronger authorization.
- Secrets must never be written to logs.
- Audit records must identify actor, action, target, time, result and project context.
- Configuration must be validated at startup.
- All timestamps are stored in UTC.
- IDs must be globally unique and non-guessable.

## Acceptance criteria
- Unauthorized requests are rejected.
- Project A cannot read Project B data.
- Permission changes take effect according to defined session policy.
- Sensitive actions generate audit records.
- Secret values are redacted from logs.
- Backup and restore procedures are documented and testable.
EOF

cat > docs/03-specifications/layer-02-project-task-management/project-task-management.md <<'EOF'
# Layer 02 — Project & Task Management

## Purpose
Translate user instructions into manageable, traceable project work.

## Components
- Project registry.
- Project settings and lifecycle.
- Project Specialist.
- Project-specific memory and context.
- File and artifact registry.
- Requirement intake.
- Task decomposition.
- Dependency graph.
- Task status and priority.
- Milestone and version tracking.
- Project activity history.

## Task lifecycle
RECEIVED -> ANALYZING -> PLANNED -> READY -> RUNNING ->
VALIDATING -> COMPLETED

Alternative states:
WAITING_FOR_APPROVAL, BLOCKED, FAILED, CANCELLED, PAUSED.

## Requirements
- Every task belongs to a project or an explicitly global scope.
- Every task has an owner, status and traceable history.
- Dependencies must be validated before execution.
- Project context is isolated.
- A task plan must identify deliverables and acceptance criteria.
- Changes to approved scope require authorization.
- Failed tasks preserve diagnostic information.
- Long-running tasks support pause and resume.

## Acceptance criteria
- A user request can be recorded and assigned to a project.
- The system can represent tasks and dependencies.
- Invalid dependency cycles are rejected.
- Task state transitions are validated.
- Project history is queryable.
EOF

cat > docs/03-specifications/layer-03-agent-ecosystem/agent-ecosystem.md <<'EOF'
# Layer 03 — Agent Ecosystem & Agent Factory

## Purpose
Register, create, evaluate and govern specialized agents.

## Components
- Agent registry.
- Agent profiles and roles.
- Capability declarations.
- Instruction and knowledge packages.
- Agent versioning.
- Agent evaluation.
- Permission profiles.
- Agent lifecycle management.
- Agent collaboration interfaces.

## Agent definition
Each agent must declare:
- Unique identifier and version.
- Purpose and supported task types.
- Required inputs and expected outputs.
- Tools and permissions.
- Knowledge sources.
- Resource limits.
- Evaluation criteria.
- Failure and escalation behavior.

## Requirements
- Agents cannot grant themselves permissions.
- Agents cannot bypass the unified gateway.
- Agents cannot access unrelated project context.
- Agent versions must be immutable after publication.
- New versions require evaluation.
- Agent instructions cannot override platform security policy.
- Collaboration occurs through controlled task and message contracts.

## Acceptance criteria
- Agents can be registered and versioned.
- Capability declarations are machine-readable.
- Unauthorized tools are rejected.
- Agent versions can be evaluated and compared.
- Agent activity is auditable.
EOF

cat > docs/03-specifications/layer-04-model-intelligence/model-intelligence.md <<'EOF'
# Layer 04 — Model Intelligence & Selection

## Purpose
Provide model discovery, capability assessment and task-to-model selection.

## Components
- Model catalog.
- Capability taxonomy.
- Evaluation framework.
- Benchmark records.
- Cost and quota metadata.
- Availability monitoring.
- Selection policy.
- Model compatibility records.

## Capability dimensions
- Text generation and reasoning.
- Code generation and review.
- Image understanding and generation.
- Audio and speech.
- Video understanding and generation.
- Embeddings and retrieval.
- Structured output and tool calling.
- Context length and multilingual performance.

## Requirements
- Model capability claims require evidence.
- Evaluation results include date, test version and conditions.
- Selection considers quality, latency, compatibility, limits and verified cost.
- Free-tier status must be periodically revalidated.
- Unknown pricing or licensing means not approved.
- Model selection must remain replaceable.

## Deferred
No models are downloaded, activated or selected in this preparation phase.

## Acceptance criteria
- Model metadata has a defined schema.
- Evaluation results are reproducible.
- Selection policies are documented.
- Unverified or paid models cannot be marked approved.
EOF

cat > docs/03-specifications/layer-05-provider-gateway/provider-gateway.md <<'EOF'
# Layer 05 — Provider Management & Unified API Gateway

## Purpose
Provide one controlled integration boundary for all future AI providers.

## Components
- Provider registry.
- Connector interface.
- Credential reference manager.
- Unified request and response contracts.
- Quota and usage accounting.
- Health checks.
- Retry and timeout policies.
- Rate limiting.
- Error normalization.
- Provider lifecycle and suspension.

## Requirements
- Agents never call providers directly.
- Credentials are stored in a dedicated secret mechanism.
- Credentials are never committed or logged.
- Provider access is denied until explicitly approved.
- Quotas and limits are enforced.
- Provider failures are normalized.
- Every request is attributable to a project and task.
- Provider usage is measurable.

## Deferred
No provider is selected, configured or activated in this phase.

## Acceptance criteria
- Connector contracts are documented.
- Credential handling has a security design.
- Quota enforcement has test cases.
- Provider suspension behavior is defined.
EOF

cat > docs/03-specifications/layer-06-execution-engine/execution-engine.md <<'EOF'
# Layer 06 — Execution Engine

## Purpose
Execute approved tools and workloads in controlled isolated environments.

## Components
- Tool registry.
- Execution job manager.
- Runtime abstraction.
- Sandbox manager.
- Container lifecycle.
- Filesystem policy.
- Network policy.
- CPU, memory and disk limits.
- Timeout enforcement.
- Output capture.
- Artifact validation.
- Cleanup and evidence collection.

## Security requirements
- Untrusted code never runs directly on the host.
- Host root credentials are never passed to workloads.
- Workloads run with least privilege.
- Network is disabled unless explicitly authorized.
- Filesystem access is restricted to approved mounts.
- CPU, memory, disk and execution time are limited.
- Images and dependencies require provenance checks.
- Containers must not receive the Docker socket.
- Secrets are not exposed to arbitrary workloads.
- Cleanup runs after success, failure or cancellation.

## Acceptance criteria
- Unauthorized execution is rejected.
- Resource limits are enforced.
- Network restrictions are tested.
- Workload outputs are captured.
- Temporary environments are removed.
- Host files remain inaccessible unless explicitly mounted.
EOF

cat > docs/03-specifications/layer-07-workflow-orchestration/workflow-orchestration.md <<'EOF'
# Layer 07 — Workflow & Orchestration Engine

## Purpose
Coordinate tasks, agents, approvals and execution stages.

## Components
- Workflow definitions.
- Workflow versioning.
- State machine.
- Task dependency scheduler.
- Agent assignment.
- Parallel and sequential execution.
- Approval gates.
- Retry and timeout handling.
- Pause and resume.
- Failure handling.
- Progress events.
- Workflow history.

## Standard lifecycle
INTAKE -> ANALYSIS -> PLANNING -> PREPARATION ->
EXECUTION -> VALIDATION -> DELIVERY -> ARCHIVING

## Requirements
- Workflow definitions are versioned.
- State transitions are validated.
- Approval gates require explicit approval.
- Silence is never treated as approval.
- Pending approval pauses execution and preserves state.
- Retries are bounded and policy-controlled.
- Parallel tasks declare dependencies.
- Cancellation and failure preserve audit history.
- Resumption continues from a persisted state.

## Acceptance criteria
- Invalid transitions are rejected.
- Approval gates block execution.
- Paused workflows resume correctly.
- Failed tasks follow defined retry policies.
- Workflow history is reconstructable.
EOF

# 4. Data architecture
cat > docs/08-data-design/data-architecture.md <<'EOF'
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
EOF

# 5. API contracts
cat > docs/09-api-contracts/api-contracts.md <<'EOF'
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
EOF

# 6. Event contracts
cat > docs/10-event-contracts/event-contracts.md <<'EOF'
# Event Contracts

## Event envelope
- event_id
- event_type
- event_version
- occurred_at
- actor_id
- project_id (nullable only for global events)
- correlation_id
- causation_id
- payload

## Initial event families
- project.created
- project.updated
- task.created
- task.status_changed
- task.completed
- agent.registered
- agent.version_published
- workflow.started
- workflow.paused
- workflow.approval_required
- workflow.resumed
- execution.started
- execution.completed
- execution.failed
- security.policy_denied
- audit.recorded

## Rules
- Consumers must tolerate duplicate delivery.
- Event schemas are versioned.
- Sensitive values are excluded.
- Ordering guarantees must be explicitly documented.
- Failed event processing must be observable.
- Events must not be treated as authorization by themselves.
EOF

# 7. Security and threat model
cat > docs/11-security/threat-model.md <<'EOF'
# Security Threat Model

## Assets
- User identities and sessions.
- Project data and memory.
- Source code and artifacts.
- Secrets and credentials.
- Agent instructions and tools.
- Execution infrastructure.
- Audit records.

## Threats
- Cross-project data leakage.
- Prompt injection and instruction manipulation.
- Unauthorized tool execution.
- Malicious dependencies.
- Container escape.
- Secret disclosure.
- Privilege escalation.
- Supply-chain compromise.
- Denial of service.
- Audit tampering.

## Mandatory controls
- Least privilege.
- Explicit project authorization.
- Input and output validation.
- Secret isolation and redaction.
- Sandboxed execution.
- Network deny-by-default.
- Resource limits.
- Dependency and image provenance checks.
- Immutable or tamper-evident audit strategy.
- Security tests for every trust boundary.

## Root host warning
The development host currently uses root. This does not authorize workloads
or agents to run as unrestricted root. Untrusted workloads must use a
separate restricted execution boundary.

## Incident handling
Document detection, containment, credential rotation, recovery, evidence
preservation and post-incident review before production use.
EOF

# 8. Testing strategy
cat > docs/12-testing/testing-strategy.md <<'EOF'
# Testing Strategy

## Test levels
1. Static analysis and formatting.
2. Unit tests.
3. Contract tests.
4. Integration tests.
5. Architecture tests.
6. Security tests.
7. Acceptance tests.
8. Recovery and resilience tests.
9. Performance tests.

## Mandatory scenarios
- Cross-project access denial.
- Missing permission denial.
- Invalid state transition rejection.
- Duplicate event delivery.
- Workflow pause and resume.
- Approval required before sensitive action.
- Secret redaction.
- Sandbox resource limit enforcement.
- Network deny-by-default.
- Failed execution cleanup.
- Backup restoration.
- Audit trace completeness.

## Definition of Done
- Acceptance criteria pass.
- Security tests pass.
- No unresolved critical vulnerabilities.
- Documentation is updated.
- Migrations are tested where applicable.
- Failure behavior is documented.
- Evidence is attached to the task report.
EOF

# 9. Operations and deployment design
cat > docs/13-operations/operations-design.md <<'EOF'
# Operations Design

## Required operational capabilities
- Structured logs.
- Metrics and health checks.
- Distributed correlation identifiers.
- Error tracking.
- Backup and restore.
- Database migration procedure.
- Secret rotation.
- Dependency update policy.
- Incident response.
- Resource and capacity monitoring.

## Environments
- Development.
- Test.
- Staging.
- Production.

Each environment has separate configuration and credentials.

## Deployment requirements
- Reproducible builds.
- Versioned artifacts.
- Rollback procedure.
- Migration compatibility checks.
- Health verification after deployment.
- No deployment with unresolved critical security findings.

## Deferred
No production deployment or service startup is performed in this phase.
EOF

# 10. Technology decision records
cat > docs/14-technology-decisions/ADR-0001-architecture-style.md <<'EOF'
# ADR-0001: Architecture Style

Status: Accepted

Decision:
Start with a Modular Monolith with strict module boundaries and explicit
contracts. Consider service extraction only when measurable operational,
scaling or team-ownership needs justify it.

Consequences:
- Simpler initial deployment.
- Shared governance and security controls.
- Requires strict dependency boundaries.
- Modules must avoid hidden cross-module database coupling.
EOF

cat > docs/14-technology-decisions/ADR-0002-ai-provider-deferral.md <<'EOF'
# ADR-0002: Defer AI Provider Selection

Status: Accepted

Decision:
Do not select, download or activate AI models or providers during foundation
preparation.

Reason:
Provider selection requires task benchmarks, license verification, pricing
and quota verification, privacy review and gateway contracts.

Consequences:
The platform must use provider-neutral interfaces.
No API keys or model weights are required for foundation preparation.
EOF

cat > docs/14-technology-decisions/ADR-0003-execution-isolation.md <<'EOF'
# ADR-0003: Untrusted Execution Isolation

Status: Accepted

Decision:
Untrusted code must execute in a restricted isolated environment, never as
an unrestricted host process.

Mandatory controls:
- Least privilege.
- No host Docker socket exposure.
- Restricted filesystem mounts.
- Network deny-by-default.
- CPU, memory, disk and time limits.
- Cleanup and audit evidence.

The exact sandbox technology remains subject to security evaluation.
EOF

cat > docs/14-technology-decisions/ADR-0004-data-platform.md <<'EOF'
# ADR-0004: Data Platform Selection

Status: Proposed

Decision:
Not yet approved.

Required evaluation:
- Transactional integrity.
- Project isolation.
- Migration support.
- Backup and recovery.
- Search requirements.
- Analytics workload.
- Licensing and operational cost.
- Security and access control.

No database service is installed by this preparation script.
EOF

cat > docs/14-technology-decisions/ADR-0005-application-stack.md <<'EOF'
# ADR-0005: Application Technology Stack

Status: Proposed

Candidate technologies must be evaluated for:
- Long-term maintenance.
- Security support.
- Licensing.
- Type safety.
- Testing ecosystem.
- Performance.
- Deployment complexity.
- Compatibility with the modular architecture.

No framework or infrastructure dependency is installed by this document.
EOF

# 11. Pre-launch readiness checklist
cat > docs/15-prelaunch/READINESS-CHECKLIST.md <<'EOF'
# Pre-Launch Readiness Checklist

## Architecture
- [ ] Seven layer specifications reviewed.
- [ ] Module boundaries approved.
- [ ] Dependency rules documented.
- [ ] Data ownership documented.

## Data and contracts
- [ ] Logical data model approved.
- [ ] API contracts approved.
- [ ] Event contracts approved.
- [ ] Schema migration strategy approved.

## Security
- [ ] Threat model reviewed.
- [ ] Project isolation strategy approved.
- [ ] Identity and permission model approved.
- [ ] Secret management strategy approved.
- [ ] Sandbox design approved.
- [ ] Backup and recovery design approved.

## Engineering
- [ ] Technology ADRs evaluated.
- [ ] Licenses verified.
- [ ] Test strategy approved.
- [ ] CI checks designed.
- [ ] Error handling and observability designed.

## Deferred until a separate approval
- [ ] AI model evaluation and selection.
- [ ] Provider selection.
- [ ] API key configuration.
- [ ] Model downloads.
- [ ] Provider activation.
- [ ] Runtime deployment.
EOF

# 12. Workspace foundation (metadata only)
cat > pnpm-workspace.yaml <<'EOF'
packages:
  - "apps/*"
  - "packages/*"
  - "services/*"
EOF

cat > package.json <<'EOF'
{
  "name": "free-ai-platform",
  "version": "0.1.0",
  "private": true,
  "description": "Provider-neutral, multi-project AI agent platform",
  "packageManager": "pnpm@9.12.0"
}
EOF

cat > tsconfig.base.json <<'EOF'
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

cat > .npmrc <<'EOF'
save-exact=true
engine-strict=true
EOF

# 13. Environment template — no credentials
cat > .env.example <<'EOF'
# Non-secret placeholders only.
NODE_ENV=development
APP_ENV=local
APP_NAME=Free AI Platform
APP_URL=http://localhost
LOG_LEVEL=info

# Configure only after the relevant architecture decisions are approved.
DATABASE_URL=
REDIS_URL=
OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_BUCKET=
SECRET_MANAGER_REFERENCE=

# AI provider integrations are intentionally deferred.
EOF

# 14. Verify required files and structure
echo
echo "===== VALIDATION ====="

required_files=(
  "docs/00-governance/engineering-rules.md"
  "docs/03-specifications/layer-01-platform-core/platform-core.md"
  "docs/03-specifications/layer-02-project-task-management/project-task-management.md"
  "docs/03-specifications/layer-03-agent-ecosystem/agent-ecosystem.md"
  "docs/03-specifications/layer-04-model-intelligence/model-intelligence.md"
  "docs/03-specifications/layer-05-provider-gateway/provider-gateway.md"
  "docs/03-specifications/layer-06-execution-engine/execution-engine.md"
  "docs/03-specifications/layer-07-workflow-orchestration/workflow-orchestration.md"
  "docs/08-data-design/data-architecture.md"
  "docs/09-api-contracts/api-contracts.md"
  "docs/10-event-contracts/event-contracts.md"
  "docs/11-security/threat-model.md"
  "docs/12-testing/testing-strategy.md"
  "docs/13-operations/operations-design.md"
  "docs/15-prelaunch/READINESS-CHECKLIST.md"
  "package.json"
  "pnpm-workspace.yaml"
  "tsconfig.base.json"
  ".env.example"
)

failed=0
for file in "${required_files[@]}"; do
  if [ -s "$file" ]; then
    echo "OK      $file"
  else
    echo "MISSING $file"
    failed=1
  fi
done

echo
echo "===== SECRET AND IGNORE CHECK ====="
git check-ignore .venv || true
git check-ignore .env.example || true

if git check-ignore -q .env.example; then
  echo "ERROR: .env.example must remain trackable"
  failed=1
fi

if ! grep -qxF '.env' .gitignore; then
  echo ".env" >> .gitignore
fi

if ! grep -qxF '.env.*' .gitignore; then
  echo ".env.*" >> .gitignore
fi

if ! grep -qxF '!.env.example' .gitignore; then
  echo "!.env.example" >> .gitignore
fi

echo
echo "===== DOCUMENT INVENTORY ====="
find docs -type f -name '*.md' | sort

echo
echo "===== CHANGE SUMMARY ====="
git status --short

if [ "$failed" -ne 0 ]; then
  echo "PREPARATION FAILED — fix reported issues before continuing."
  exit 1
fi

echo
echo "PRE-LAUNCH DOCUMENTATION FOUNDATION CREATED."
echo "No models downloaded. No providers configured. No services started."
