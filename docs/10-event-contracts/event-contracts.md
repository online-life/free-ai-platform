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
