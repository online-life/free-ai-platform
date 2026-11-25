# Runtime Job Interface

The API dispatches authenticated jobs to enrolled devices over outbound polling. Each job has a stable UUID, tenant/project/workspace scope, kind, payload, and idempotency key. The Runtime reports `RUNNING`, `SUCCEEDED`, `FAILED`, or `CANCELLED` using the device token. API authorization and project grants are authoritative.

Implemented kind: `RUNTIME_HEALTH_CHECK`, which returns local health metadata only. Other declared kinds currently fail closed in the client and are not supported for user execution. Cancellation is observed through the next poll; it is not an OS process kill until a process executor exists.
