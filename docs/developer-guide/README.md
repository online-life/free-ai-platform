# Developer guide

Free AI Platform is a Node.js/TypeScript modular monolith with a separate
Runtime service. This guide points to the implementation and commands that
exist in the repository. The project is **not production-ready**; see
[current status](../STATUS.md) before treating a feature or deployment path as
complete.

## Development setup

Use the [installation guide](../getting-started/installation.md) to install
Node.js 22+, pnpm 9.12.0, configure PostgreSQL and load the environment. The
API and web scripts do not automatically load `.env`.

Common local checks:

```bash
pnpm prisma:validate
pnpm typecheck
pnpm web:typecheck
pnpm api:build
pnpm web:build
pnpm exec vitest run
```

Database-backed E2E tests require an explicitly disposable database. Read the
[testing strategy](../12-testing/testing-strategy.md) before running them; do
not point test or migration commands at production or valuable data. With the
disposable database configured in `DATABASE_URL`, the E2E command is:

```bash
pnpm test:e2e
```

## Repository structure

| Path | Responsibility |
| --- | --- |
| `apps/api/` | Node.js HTTP API, route composition, authorization, provider gateway, Prisma schema and migrations. |
| `apps/web/` | Static browser client and Node.js web server. |
| `services/ai-runtime/` | Outbound paired Runtime, workspace handlers, and Linux process sandbox. |
| `packages/` | Shared contracts, configuration, and TypeScript packages. |
| `tests/` | Unit, integration, and E2E test suites. |
| `docs/` | User, developer, architecture, operations, security, and project documentation. |

For the architectural boundaries and diagrams, see
[Architecture](../ARCHITECTURE.md),
[module boundaries](../17-architecture/module-boundaries.md), and
[deployment topology](../17-architecture/deployment-topology.md).

## API and database

`apps/api/src/main.ts` composes the HTTP API and exposes the current OpenAPI
document at `/api/v1/openapi.json` when the service is running. Prefer that
live schema over older API proposals in `docs/09-api-contracts/`.

For local API checks:

```bash
curl --fail --silent --show-error http://127.0.0.1:3000/api/v1/health
curl --fail --silent --show-error http://127.0.0.1:3000/api/v1/openapi.json
```

Protected routes require an authenticated session and the documented
authorization/CSRF flow. Do not copy session cookies or credentials into
examples or public reports.

Prisma models and migrations are under `apps/api/prisma/`. Tenant and project
authorization are enforced by the API and database design; preserve
tenant-scoped transactions and row-level security in changes. The application
database role must not be a superuser or have `BYPASSRLS`. Review the
[authorization model](../20-security/authorization-model.md),
[project isolation notes](../18-data-design/project-isolation.md), and
[migration guide](../13-operations/installation-backup-restore.md) before
changing data behavior.

## Web client

The web application is a static JavaScript client served by `apps/web/server.mjs`.
`apps/web/src/main.js` calls the API and renders the workspace. It does not
fabricate live records when the API is disconnected. Run `pnpm web:dev` for
local development and `pnpm web:build` to validate the production bundle.

## Providers and integrations

Provider connections are routed through the API. The current adapters are
`OPENAI_COMPATIBLE` for remote HTTPS endpoints and
`LOCAL_OPENAI_COMPATIBLE` for loopback endpoints. These are protocol adapters,
not provider-brand integrations. Connection checks perform health/catalog
discovery rather than inference; streaming is not supported.

When adding an adapter, follow the existing registry, schema, credential
handling, policy checks, and provider tests. Keep secrets server-side, validate
remote URL boundaries, and do not mark model pricing or privacy as verified
without evidence. See the [provider operations guide](../13-operations/provider-setup-and-execution.md)
and [provider gateway specification](../03-specifications/layer-05-provider-gateway/README.md).

## Agents and workflows

The agent API manages tenant-scoped definitions, versions, evaluations,
selection, and project-isolated memory. Agent definitions are metadata and
instructions; they do not execute models directly. Model access remains
separate through the provider gateway, and the project request path does not
currently provide a complete agent execution loop. The
[agent ecosystem specification](../03-specifications/layer-03-agent-ecosystem/README.md)
documents the intended boundary.

Project workflow definitions and persisted runs are available. Current
workflow validation only connects `APPROVAL`, `CONDITION`, and `WAIT` steps;
other step types are declared in the schema but rejected as not connected.
Do not document or implement them as executable until an executor and tests
exist. See the [workflow specification](../03-specifications/layer-07-workflow-orchestration/README.md).

## Runtime and sandbox

The Runtime is a separate outbound service. It must not run as root; sandboxed
process execution is Linux-only and uses fail-closed Bubblewrap and `prlimit`
boundaries. Workspace paths and command allowlists are local Runtime
configuration, not API-provided host paths. See the
[Runtime guide](../../services/ai-runtime/README.md) and
[security architecture](../SECURITY.md) before changing these boundaries.

## Debugging and contribution

- Check `/api/v1/health` for API/database health and
  `/api/v1/openapi.json` for the live API schema.
- Keep secrets out of logs, command arguments, screenshots, and tests.
- Preserve tenant, project, provider, and Runtime authorization boundaries.
- Use a disposable database for migration and E2E work.
- Add focused tests for behavior changes and report only checks actually run.

Read [CONTRIBUTING.md](../../CONTRIBUTING.md),
[engineering standards](../16-standards/engineering-standards.md), and the
[testing strategy](../12-testing/testing-strategy.md) before opening a change.
