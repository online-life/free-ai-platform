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
