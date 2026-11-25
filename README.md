# Free AI Platform

Free AI Platform is a general-purpose, multi-project AI platform.

It receives user instructions, analyzes requirements, plans execution,
selects authorized agents and tools, executes tasks, validates results,
and delivers traceable outputs.

## Core Principles

- One shared platform core.
- Independent project contexts and permissions.
- Extensible agent ecosystem.
- Free services and models only.
- Centralized provider gateway.
- Isolated execution environments.
- Human approval for sensitive actions.
- Auditable and testable workflows.
- Modular Monolith as the initial implementation architecture.

## Current Status

The repository contains a local development web console and Node HTTP API. The
current implementation includes PostgreSQL-backed cookie sessions, one-time
owner bootstrap, forced first-login password change, user/role/session admin
routes, project/task APIs, provider metadata, and a local Runtime. The project
is still under development and is **not production ready**; see
[`docs/STATUS.md`](docs/STATUS.md) and the closure report for verified scope and
remaining blockers.

The API binds to loopback by default. The web console is available at
`http://127.0.0.1:4173`; the API defaults to `http://127.0.0.1:3000` (or the
configured `API_PORT`). OpenAPI is served at `/openapi.json`.

### Local development

1. Configure PostgreSQL and set `DATABASE_URL` in the shell.
2. Apply the additive migrations with `pnpm prisma:migrate:deploy`.
3. Build and start the API with `pnpm api:build` and `pnpm api:start`.
4. In another terminal, run `pnpm web:dev` and open the URL above.

Public account self-registration is disabled. A fresh setup requires a
configured random `BOOTSTRAP_TOKEN` of at least 32 characters and the protected
owner bootstrap flow. It displays generated credentials once; the owner must
change the temporary password at first login. Browser sessions use
server-persisted opaque identifiers in HttpOnly cookies and CSRF protection.
Provider API credentials require a 32-byte base64 `SECRETS_MASTER_KEY`; do not
commit it. Provider and model configurations remain disabled until separately
authorized and tested. The bootstrap flow does not by itself constitute a
complete packaged installer.

Build and check commands: `pnpm web:build`, `pnpm web:typecheck`, `pnpm typecheck`,
`pnpm api:build`, `pnpm prisma:validate`, and `pnpm test:e2e` (requires an
explicitly configured test `DATABASE_URL`).

Create a reproducible source archive with `scripts/build-release-package.sh
[output-directory]`. It emits a SHA-256 sidecar. This is a source distribution,
not a self-contained production installer; it requires Node.js/pnpm and does
not configure or manage system services.

The latest source candidate is available in
[`release-candidate-latest/`](release-candidate-latest/). See
[`provider setup and execution`](docs/13-operations/provider-setup-and-execution.md)
for configuring a verified-free provider and running a project request through
the central gateway. Successful live inference remains unverified until an
approved model endpoint is configured.

### Public website and provider administration

The web app serves public routes for Home, About, Features, Platform Modules,
AI Providers, Models, Pricing and Plans, Contact, Documentation, FAQ, Terms of
Service, Privacy Policy, and Login. The authenticated workspace remains
separate; anonymous hash routes never render private workspace pages. Public
contact details, footer text, social links, and Terms/Privacy content can be
updated by an authorized platform owner in **Settings → Public website
content** and are stored by the API. The default includes no invented contact
or social accounts.

Provider identity marks are deliberately neutral: the API currently supports
the generic OpenAI-compatible connector and local OpenAI-compatible connector.
No verified official logo assets are required or fabricated. Connection
status and pricing are taken from provider/model records; unknown remains
unknown. The project execution form lists only currently eligible
privacy-approved verified-free or self-hosted models and sends its selected
model key for server-side revalidation. Provider connection tests perform
health/catalog discovery, not inference.

## Repository Structure

- apps/: application entry points.
- packages/: shared contracts and libraries.
- services/: separately bounded runtime services.
- infra/: infrastructure definitions.
- docs/: architecture and specifications.
- tests/: automated tests.
- scripts/: project maintenance scripts.

## Development Rule

No implementation begins before the relevant technical specification,
security requirements, and acceptance tests are approved.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Installation](docs/INSTALLATION.md)
- [Development](docs/DEVELOPMENT.md)
- [Security](docs/SECURITY.md)
- [Roadmap](docs/ROADMAP.md)
- [Contributing](CONTRIBUTING.md)

## License

Free AI Platform is licensed under the [Apache License 2.0](LICENSE).
