# Development

See the [Developer Guide](developer-guide/README.md) for repository structure,
setup, API and database boundaries, Runtime details, and contribution
references.

Common checks:

```bash
pnpm prisma:validate
pnpm typecheck
pnpm web:typecheck
pnpm api:build
pnpm web:build
pnpm exec vitest run
```

Database-backed E2E tests require an explicitly disposable database; read the
[testing strategy](12-testing/testing-strategy.md) first. Do not run
migrations or tests against production or valuable data. Keep credentials
server-side, preserve tenant/project/session/workspace boundaries, and report
only validation that was actually executed.
