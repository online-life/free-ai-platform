# Architecture

Free AI Platform is a modular monolith for local or self-hosted AI project operations.

## Main components

- `apps/api`: Node.js HTTP API, Prisma/PostgreSQL persistence, authentication, authorization, provider gateway, and Runtime coordination.
- `apps/web`: static web console and public site served by a small Node.js server.
- `packages/shared`: shared runtime utilities.
- `packages/contracts`: shared TypeScript contracts.
- `packages/config`: workspace configuration.
- `services/ai-runtime`: unprivileged outbound Runtime client, workspace operations, and Linux sandbox execution.
- `infra`: deployment and infrastructure support.
- `tests`: unit, integration, security, and E2E coverage.

## Boundaries

The API owns tenant, project, authentication, authorization, provider, model, and job policy. The paired Runtime owns device-side identity and executes approved workspace operations. Provider communication should pass through the provider gateway. Execution services must fail closed for unrecognized operations and restricted paths.

## Persistence

PostgreSQL is accessed through Prisma. Database role requirements and row-level security behavior are documented in `docs/13-operations/installation-backup-restore.md`.

## Status

See `docs/STATUS.md` and `docs/reports/FINAL-PRODUCTION-CLOSURE-REPORT.md` for verified scope and unresolved production blockers.
