# Local installation, backup, and restore

## Requirements

- Linux or a compatible development host, Node.js 22+, pnpm, PostgreSQL client tools, and access to a PostgreSQL database.
- A dedicated unprivileged account for the API and Runtime. The Runtime refuses to run as root.
- A one-time owner bootstrap token with at least 32 characters and a 32-byte base64-encoded `SECRETS_MASTER_KEY`. Generate and store both through the deployment secret manager; do not commit them or put them in shell history.

## Database roles (required)

Tenant tables use `FORCE ROW LEVEL SECURITY`. PostgreSQL skips RLS entirely for
`SUPERUSER` and `BYPASSRLS` roles, so the role used matters for both security
and correctness:

| Purpose | Role attributes | Used by |
|---|---|---|
| Application | `LOGIN`, owns the schema; **not** `SUPERUSER`, **not** `BYPASSRLS` | API, `install-local.sh` migrations |
| Backup / restore | `LOGIN`, `BYPASSRLS` (plus `CREATEDB` only if it creates targets) | `backup-postgres.sh`, `restore-postgres.sh` |

Running the API as a superuser silently disables tenant and project isolation
at the database layer. Before 2026-11-23 the E2E suite was only run as the
`postgres` superuser, which hid two RLS defects (empty project lists and failed
project creation; fixed by migration `0013_project_member_self_read` and
`ProjectService.create`). Run E2E with an application role that is neither
superuser nor `BYPASSRLS`.

`pg_dump` cannot read FORCE-RLS tables without `BYPASSRLS`, and `pg_restore`
cannot write them. Both scripts now check this first and exit with status `3`
and `BACKUP_ROLE_REQUIRES_BYPASSRLS` / `RESTORE_ROLE_REQUIRES_BYPASSRLS`
instead of failing part-way. Keep the backup role's credentials separate from
the application's.

## Install and upgrade

From the repository root, provide `DATABASE_URL`, `BOOTSTRAP_TOKEN`, and `SECRETS_MASTER_KEY` through the environment and run `scripts/install-local.sh`. The script validates prerequisites, installs locked dependencies when absent, validates and generates Prisma, applies migrations, and builds the API, web application, and Runtime. It does not start services or complete owner bootstrap. Configure the API service using the deployment's secret manager, start it under the dedicated account, complete the one-time owner bootstrap, then verify `/api/v1/health`. The bootstrap response presents generated credentials once; the owner must change the temporary password before normal API access. For upgrades, back up first, deploy the versioned source, and run the same script; review migration compatibility before production upgrades.

The web preview reads `API_BASE_URL` at server startup and exposes it through a
non-secret, no-store `/config.js` response. The same value determines the
browser Content Security Policy `connect-src`. For local use it defaults to
`http://127.0.0.1:3000`. Behind a same-origin reverse proxy, set
`API_BASE_URL=` (empty) and route the platform's `/api/` and `/health` paths to
the API; set `WEB_ORIGIN` on the API to the public web origin. For a separate
API origin, use its HTTPS origin in `API_BASE_URL` and configure the matching
`WEB_ORIGIN`. Do not configure browser access to an arbitrary provider URL.

Build a reproducible source distribution with `scripts/build-release-package.sh [output-directory]`. It creates a versioned `.tar.gz` and SHA-256 sidecar, normalizes archive timestamps/ownership, and excludes local environments, credentials, dependency caches, model weights, and build output. The archive includes the locked dependency manifest and installer script, but it still requires Node.js/pnpm and dependency-registry access during installation; it is not a self-contained binary installer and does not install or manage OS services. Validate the digest from the output directory with `sha256sum -c free-ai-platform-<version>.tar.gz.sha256`.

## Backup

Run `DATABASE_URL=... scripts/backup-postgres.sh /secure/path/free-ai-YYYYMMDD.dump`. The PostgreSQL custom-format dump is validated with `pg_restore --list`, created without overwrite, and restricted to owner access (`0600`). Store it outside the application workspace with encryption and retention controls appropriate to the deployment. The temporary libpq service file is private and removed on exit; connection secrets are not printed.

## Restore

Create a new, verified-empty PostgreSQL database. Set `RESTORE_DATABASE_URL` to that target and `RESTORE_CONFIRM_EMPTY=I_HAVE_VERIFIED_EMPTY_TARGET`, then run `scripts/restore-postgres.sh /secure/path/free-ai-YYYYMMDD.dump`. Restore refuses targets with user relations, non-extension functions, or custom schemas; it never runs `--clean` or `--create`. Validate application health and migration state before directing traffic to the restored deployment. Recovery to a pre-existing database is intentionally not supported by this script.

## Acceptance verification

`tests/e2e/operations-install-backup-restore.test.mjs` creates disposable databases, runs the clean install path, verifies policy seed data, creates and inspects a backup, verifies overwrite and confirmation rejection, confirms a populated restore target is rejected, restores into an empty database, and compares tenant and applied-migration counts. Run it with `DATABASE_URL` set to an explicitly disposable PostgreSQL database owned by a `BYPASSRLS` backup role (see *Database roles*). It drops only databases it created. Run the other E2E suites with a separate non-`BYPASSRLS` application role; `auth-session-flow` exercises one-time bootstrap and therefore needs a freshly migrated database.

## Limits

The source distribution and database migration/backup scripts do not install an OS service manager, provision TLS, configure a production secret manager, start provider services, or provide rollback and data-preserving uninstall. Clean migration and backup/restore tests are present, but production install and upgrade are not verified.
