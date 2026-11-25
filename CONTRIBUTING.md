# Contributing

Thank you for helping improve Free AI Platform. This repository is under active development and is not production-ready.

## Before contributing

- Read `AGENTS.md`, `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, and `docs/SECURITY.md`.
- Search existing issues and proposals before starting unrelated work.
- Use the relevant technical specification and acceptance tests before implementation.
- Do not introduce secrets, private infrastructure details, or machine-specific paths.

## Development setup

Requirements:

- Node.js 22 or newer
- pnpm 9
- PostgreSQL for database-backed tests

Install dependencies and run local checks:

```bash
pnpm install --frozen-lockfile
pnpm prisma:validate
pnpm typecheck
pnpm web:typecheck
pnpm api:build
pnpm web:build
pnpm exec vitest run
```

Database-backed tests require an explicitly configured disposable `DATABASE_URL`. Never run migrations against a production or valuable database.

## Pull requests

- Keep changes focused and reversible.
- Add or update focused tests for behavior changes.
- Do not weaken existing tests or claim unrun results.
- Document security-sensitive behavior and known limitations.
- Use clear commit messages and include test evidence in the pull request.

## Security

Do not report vulnerabilities in public issues. Follow `SECURITY.md`.
