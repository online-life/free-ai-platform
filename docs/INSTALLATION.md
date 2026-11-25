# Installation

## Requirements

- Node.js 22 or newer
- pnpm 9
- PostgreSQL
- Linux for Runtime sandbox isolation features

## Configure

Copy `.env.example` to an ignored local `.env` and replace placeholders:

```bash
cp .env.example .env
```

Never commit the resulting file or real credentials.

Set `DATABASE_URL`, `BOOTSTRAP_TOKEN`, and `SECRETS_MASTER_KEY` only in local or secret-managed environments. Keep bootstrap credentials removed after initial owner setup.

## Database

Use an explicitly provisioned PostgreSQL role and database:

```bash
pnpm prisma:migrate:deploy
```

Do not run migrations against an unknown or production database.

## Build and run

```bash
pnpm install --frozen-lockfile
pnpm api:build
pnpm web:build
pnpm api:start
pnpm web:dev
```
