# Logical Deployment Topology

This document defines logical deployment units, not an instruction to deploy them.

## Target units
1. Web client.
2. API/control-plane application.
3. Trusted background worker.
4. Isolated execution worker pool.
5. Relational database.
6. Optional cache/coordination service.
7. Object storage adapter.
8. Observability stack.

## Isolation
- Execution workers do not share the API process identity.
- Execution workers have no database administrator credentials.
- Jobs use scoped, short-lived grants.
- Internal communication is authenticated.
- Secrets are injected at runtime.
- Persistent volumes are explicit and backed up.

## Environments
Development, test, staging, and production must have separate credentials,
data stores, and provider settings.

## Deferred
No containers are built or started in the preparation phase.
