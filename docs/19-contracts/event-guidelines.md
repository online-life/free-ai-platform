# Event Contract Guidelines

## Event envelope
{
  "eventId": "opaque-id",
  "eventType": "task.status_changed",
  "eventVersion": 1,
  "occurredAt": "UTC ISO-8601",
  "producer": "task-management",
  "projectId": "project-id",
  "actorId": "principal-id",
  "correlationId": "correlation-id",
  "causationId": "prior-event-or-command-id",
  "payload": {}
}

## Delivery
Assume at-least-once delivery.
Consumers must be idempotent.
Do not claim exactly-once end-to-end delivery.
Use transactional outbox where state and event publication must remain consistent.

## Event names
domain.past_tense_action

Examples:
project.created
task.created
task.status_changed
workflow.approval_requested
workflow.paused
execution.completed
execution.failed
security.authorization_denied

## Security
- No secrets in events.
- Minimize personal data.
- Validate event schema and producer.
- Treat payloads as untrusted.
- Recheck authorization before protected side effects.
