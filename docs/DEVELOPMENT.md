# Development

## Commands

```bash
pnpm install --frozen-lockfile
pnpm prisma:validate
pnpm typecheck
pnpm web:typecheck
pnpm api:build
pnpm web:build
pnpm exec vitest run
pnpm test:e2e
```

Database-backed E2E tests require a disposable `DATABASE_URL`.

## Rules

- Preserve existing work and avoid destructive Git operations.
- Do not run reset, clean, force-push, or history-rewrite commands.
- Never run migrations against production or valuable databases.
- Keep provider credentials server-side and out of logs.
- Preserve tenant, project, session, and workspace boundaries.
- Add focused tests for behavior changes.
- Do not claim test or production readiness from an unexecuted check.
