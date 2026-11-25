# Installation and first run

Free AI Platform is **not production-ready**. This guide describes a local
development setup using the current repository scripts; it is not a production
deployment recipe.

## Requirements and support

- Node.js 22 or newer.
- pnpm 9; the repository pins `pnpm@9.12.0` in `package.json`.
- PostgreSQL and a database role dedicated to this application.
- A Bash-compatible shell for the installer and environment-loading examples.
- Linux, an unprivileged account, Bubblewrap (`/usr/bin/bwrap`), and
  `prlimit` (`/usr/bin/prlimit`) for Runtime sandboxed process execution.

The project does not publish a supported operating-system matrix or a
minimum PostgreSQL version. The current status report records the versions
used by its database acceptance runs; other versions are not certified by that
evidence. The API and web server are Node.js services. The sandboxed Runtime
process feature is Linux-specific and refuses to run as root.

Redis is not required or consumed by the current application. `REDIS_URL` is
reserved in the environment template. The repository has no Dockerfile or
Compose configuration, so Docker is not a supported installation method.

## Get the source and install dependencies

```bash
git clone https://github.com/online-life/free-ai-platform.git
cd free-ai-platform
pnpm install --frozen-lockfile
```

Use pnpm 9.12.0 for the lockfile-pinned setup. If pnpm is unavailable, install
the version declared by `packageManager` in `package.json` using your normal
Node.js package-manager setup.

## Provision a local PostgreSQL database

Use a disposable local development database. Do not use a production,
shared, or otherwise valuable database for the first setup.

At an interactive `psql` prompt as a PostgreSQL administrator, create a
non-superuser application role and database. The `\password` command prompts
for the role password without putting it in SQL history:

```sql
CREATE ROLE freeai_app LOGIN NOSUPERUSER NOBYPASSRLS;
CREATE DATABASE free_ai_platform OWNER freeai_app;
\connect free_ai_platform
ALTER SCHEMA public OWNER TO freeai_app;
\password freeai_app
```

The application role must own the schema used by migrations and must not be a
superuser or have `BYPASSRLS`. Follow the
[database operations guide](../13-operations/installation-backup-restore.md)
for the project’s database isolation and backup safeguards.

## Configure the environment

Create a private local environment file from the non-secret template:

```bash
cp .env.example .env
chmod 600 .env
```

Set at least `DATABASE_URL`, `BOOTSTRAP_TOKEN`, and `SECRETS_MASTER_KEY` in
`.env`. Use a PostgreSQL URL for the local role and database, for example:
`postgresql://freeai_app:<URL-encoded-password>@127.0.0.1:5432/free_ai_platform?schema=public`.
Replace the example password with the one you set; URL-encode characters that
have a special meaning in a URL.

Generate a unique bootstrap token of at least 32 characters and a base64
`SECRETS_MASTER_KEY` that decodes to exactly 32 bytes. Keep the master key
available to the API for its lifetime; losing or changing it can make stored
provider credentials unreadable. Do not paste generated secrets into public
documentation, issues, screenshots, or logs.

The Node.js API and web scripts do **not** automatically load `.env`. In each
terminal where you run the installer or a service, load the shell-compatible
file into that process environment:

```bash
set -a
. ./.env
set +a
```

Quote values in `.env` when they contain shell-special characters. Re-source
the file in each new terminal. If you use a service manager instead, configure
the same values through its protected environment mechanism. Do not use the
bootstrap token in the long-running API environment after the initial owner
has been created. The installer currently requires a valid token each time it
runs, even after bootstrap.

### Environment variables

| Variable | Required? | Purpose and consumer |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection for API and Prisma commands. Example shape: `postgresql://USER:PASSWORD@127.0.0.1:5432/DB?schema=public`. |
| `BOOTSTRAP_TOKEN` | Yes for installer and first owner bootstrap | Unique value of at least 32 characters. The API uses it only while owner bootstrap is available; `scripts/install-local.sh` currently validates it on every run. |
| `SECRETS_MASTER_KEY` | Yes | Base64 encoding of exactly 32 random bytes, used by the API to encrypt provider credentials. Keep stable and private. |
| `SECRETS_KEY_VERSION` | Optional | Provider-secret key version metadata; defaults to `v1`. |
| `NODE_ENV` | Optional | API runtime mode; defaults to `development`. Use `production` only with a deliberate deployment configuration. |
| `API_HOST` | Optional | API bind address; defaults to `127.0.0.1`. |
| `API_PORT` | Optional | API port; defaults to `3000`. |
| `WEB_HOST` | Optional | Web server bind address; defaults to `127.0.0.1`. |
| `WEB_PORT` | Optional | Web port; defaults to `4173`. |
| `WEB_ORIGIN` | Optional | Browser origin allowed by the API; defaults to `http://127.0.0.1:4173`. Keep it consistent with the URL used to open the web client. |
| `API_BASE_URL` | Optional | API origin used by the web client; defaults to `http://127.0.0.1:3000`. Set it to the API origin, or empty when a reverse proxy exposes the API same-origin. |
| `APP_ENV`, `APP_NAME`, `APP_URL`, `LOG_LEVEL` | Not required by the current API/web runtime | Reserved template values; current service entry points do not consume them. |
| `REDIS_URL`, `OBJECT_STORAGE_ENDPOINT`, `OBJECT_STORAGE_BUCKET`, `SECRET_MANAGER_REFERENCE` | Not required | Reserved for future decisions; not consumed by the current application. |

`BROWSER_BASE_URL` and `CHROMIUM_BIN` are optional browser-test settings, not
required to install or run the application. Runtime-service variables are
separate from the API/web template and are described under
[Runtime setup](#optional-runtime-setup).

## Validate, migrate, and build

The installer validates the environment, validates/generates Prisma, applies
database migrations, and builds the API, web client, and Runtime:

```bash
bash scripts/install-local.sh
```

This command changes the target database by applying migrations. Run it only
with the explicitly provisioned disposable local database above. To perform
the migration step separately after configuring the environment, the
repository script is:

```bash
pnpm prisma:migrate:deploy
```

The installer’s completion message means migrations and builds passed; it
does not start services or complete owner bootstrap.

## Start the API and web client

Start each service in a separate terminal, loading the environment in each:

```bash
set -a
. ./.env
set +a
pnpm api:start
```

```bash
set -a
. ./.env
set +a
pnpm web:dev
```

The default local URLs are:

- Web client: <http://127.0.0.1:4173>
- API: <http://127.0.0.1:3000>
- API health: <http://127.0.0.1:3000/api/v1/health>
- OpenAPI document: <http://127.0.0.1:3000/api/v1/openapi.json>

Verify the API and its database connection:

```bash
curl --fail --silent --show-error http://127.0.0.1:3000/api/v1/health
curl --fail --silent --show-error http://127.0.0.1:4173/ >/dev/null
```

The API health response reports `healthy` only when its database check
succeeds. The web request verifies the page is served; it does not prove that
the API is connected.

## First owner and first request

Open the web client and complete the one-time owner bootstrap with the
configured token. The owner setup creates the first tenant and account; public
self-registration is disabled. Save the generated temporary credentials
securely when shown, sign in, and change the temporary password. See
[first-run owner setup](../03-specifications/layer-01-platform-core/first-run-owner-setup.md)
for the exact credential lifecycle.

To try a project request:

1. Sign in and create a project.
2. Configure a provider in **Providers** using a supported connector and
   credentials you are authorized to use.
3. Test the connection and review discovered models, pricing, privacy, and
   capability metadata. Connection tests discover health/catalog information;
   they do not prove inference works.
4. In the project, submit a request using an enabled, available,
   privacy-approved text-generation model classified as self-hosted or
   verified free.
5. Review the returned response and routing/usage information.

Provider credentials are configured through the authenticated application
and encrypted by the API; do not put provider API keys in `.env`. Live
external-provider inference has not been verified by the project’s current
acceptance evidence. See [provider setup and execution](../13-operations/provider-setup-and-execution.md).

## Optional Runtime setup

The Runtime is a separate outbound service. It requires Linux and must run as
a dedicated unprivileged account. Process sandbox execution requires
`/usr/bin/bwrap`, `/usr/bin/prlimit`, and supported unprivileged user
namespaces; the Runtime fails closed when sandbox prerequisites are absent.

Build it with the installer or `pnpm --filter @free-ai/ai-runtime build`.
Provide the following variables only to the Runtime process, then start it
under its unprivileged account with
`pnpm --filter @free-ai/ai-runtime start`:

| Variable | Required? | Purpose |
| --- | --- | --- |
| `FREEAI_API_URL` | Yes | API origin; remote origins must use HTTPS. HTTP is allowed for loopback development only. |
| `FREEAI_PAIRING_CODE` | First enrollment only | Short-lived, one-use code from the authenticated device flow. Supply through a protected process environment, not a committed file or command-line argument. |
| `FREEAI_RUNTIME_IDENTITY_FILE` | Optional | Device identity path; defaults to `$HOME/.config/free-ai/runtime-device.json`. The Runtime creates a private owner-only file and directory. |
| `FREEAI_RUNTIME_HEARTBEAT_MS` | Optional | Heartbeat interval in milliseconds; defaults to `5000`, with accepted values from `1000` to `60000`. |
| `FREEAI_WORKSPACE_BINDINGS_FILE` | Optional | Absolute path to a private, mode-`0600` Linux JSON file mapping workspace aliases to local paths and permissions. Without it, workspace handlers are not registered. |

Build and start under the unprivileged Runtime account using the service
manager or protected environment configuration used by your deployment. Do
not run it as root. The full handler and local workspace configuration
requirements are in the [Runtime guide](../../services/ai-runtime/README.md).

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `NODE_22_OR_NEWER_REQUIRED` or missing pnpm | Confirm Node.js is at least 22 and pnpm matches the repository’s pinned 9.12.0 version. |
| `DATABASE_URL_REQUIRED` or database unavailable | Load `.env` into the current process environment; confirm PostgreSQL is running, the URL is correct, and the dedicated role can connect. The services do not auto-load `.env`. |
| Migration or Prisma permission error | Confirm the application role owns the target schema and is not a superuser or `BYPASSRLS` role. Use only a disposable database for setup attempts. |
| Installer reports missing/invalid `BOOTSTRAP_TOKEN` | Set a unique token of at least 32 characters in the installer environment. The installer currently validates this on every run. |
| Installer reports invalid `SECRETS_MASTER_KEY` | Supply standard base64 text that decodes to exactly 32 bytes; retain the same key for the API after setup. |
| Redis connection warning | Redis is not used by the current application. Do not add a Redis service solely to satisfy the reserved template value. |
| Provider authentication or connection failure | Recheck connector type, URL scheme and reachability, credential validity, and provider-side policy. Do not include credentials in a public log or issue. |
| Port already in use | Choose unused `API_PORT` or `WEB_PORT` values and align `API_BASE_URL` and `WEB_ORIGIN` with the resulting origins. |
| Runtime refuses to start | Confirm it is not running as root, the identity file is valid and private, and `FREEAI_API_URL` is correct. For process jobs, verify Linux Bubblewrap, `prlimit`, and unprivileged user namespaces. |
| Web loads but shows API offline | Confirm the API health URL responds, load the same `API_BASE_URL` into the web process, and ensure the API’s `WEB_ORIGIN` matches the browser origin. |

For code-level problems, use the [developer guide](../developer-guide/README.md)
and [testing strategy](../12-testing/testing-strategy.md). Never troubleshoot
by disabling authorization, sandboxing, or database protections.
