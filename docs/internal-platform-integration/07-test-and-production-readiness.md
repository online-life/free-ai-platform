# 07 — Tests and production readiness (2026-11-23)

Environment: fresh PostgreSQL 18.6 databases. The app role is neither SUPERUSER nor BYPASSRLS. A separate BYPASSRLS role was used for backup/restore. The Runtime ran as UID 65534. Disposable databases and roles were dropped afterwards.

## Results

| Suite | Passed | Failed | Skipped | Notes |
|---|---|---|---|---|
| Vitest (20 files) | 138 | 0 | 0 | +12 new: `tests/engines/opencode-catalog.test.ts`, `tests/runtime/opencode-engine.test.ts` (engine tests use a test-double runner fed with real captured OpenCode output) |
| `node --test` security/unit/web | 8 | 0 | 0 | |
| `scripts/check-*.mjs` | 5 | 0 | 0 | |
| API + web typecheck, API/web/Runtime build, `prisma validate`, `git diff --check` | all | 0 | — | |
| E2E `api-project-flow`, `api-error-contract`, `auth-session-flow`, `runtime-workspace-flow`, `process-sandbox` | 5 | 0 | 0 | No regression |
| E2E `opencode-engine-flow` (real binary, real sandbox, real provider) | 1 | 0 | 0 | Diagnostic: `LIVE_SUCCESS_NOT_VERIFIED`, provider free-limit 429. Passed 4 times. |
| E2E `opencode-browser` (Chromium, real API and web server, seeded catalog) | 1 | 0 | 0 | Passed 3 consecutive runs |
| E2E `operations-install-backup-restore` | 1 | 0 | 0 | BYPASSRLS backup role |
| E2E `freellmapi-local` | — | — | not run | Would start an unapproved container |

## Mandatory OpenCode tests (directive section 10)

| Test | Result |
|---|---|
| A. Install/initialize: pinned binary, engine starts, no dependency conflicts, no leftover processes | **Passed** (no packages added to the workspace; `pgrep` empty after jobs) |
| B. Authentication: connect/disconnect/reconnect an OpenCode account | **Not tested.** Login is not enabled (decision D3). Status detection of connected integrations is tested: none. |
| C. Provider and model discovery | **Passed**: 1 provider, 12 models discovered live through Free AI; unavailable or unknown-priced models are not selectable (unit) |
| D. Free-only policy: free selected, paid blocked, free failure gives no paid fallback | **Passed.** Real 429 from the provider: one model attempted, job `FAILED OPENCODE_FREE_LIMIT_REACHED`, cost 0 |
| D. "Real request executed through OpenCode" | **Passed outside Free AI only** (`PONG`, 2026-11-23). Through Free AI the real provider answered 429. |
| E. Real coding task (read, edit, create, run tests, verify files) | **Not verified live.** Free-tier limit exhausted. Logic verified with real captured events (unit). The E2E asserts the file fix when the provider allows it. |
| F. Session, task, events, progress, completion, cancellation, errors | **Passed** (cancel → `CANCELLED RUNTIME_JOB_CANCELLED`; events relayed; errors mapped) |
| G. Security: tenant isolation, workspace, secrets, sandbox, limits | **Passed** for the items listed in 06 |
| H. Regression | **Passed** (table above) |

To complete E after the free-tier window resets, run:

```
FREEAI_OPENCODE_REQUIRE_LIVE_SUCCESS=1 DATABASE_URL=<disposable, non-BYPASSRLS> node --test tests/e2e/opencode-engine-flow.test.cjs
```

## Production readiness

**Not production-ready, and not deployed.** There is no service URL.

| Item | State |
|---|---|
| Secrets required | `SECRETS_MASTER_KEY`, `BOOTSTRAP_TOKEN` (API); Runtime pairing code; no OpenCode secret |
| HTTPS / reverse proxy | Not configured on this host |
| OAuth redirect | Not applicable (no OAuth flow enabled) |
| CORS/CSRF | Single allowed origin (`WEB_ORIGIN`); cookie + CSRF + Origin enforced (E2E) |
| Migrations | 13/13 on a fresh DB. No new migration was added for OpenCode (job `kind` is a string). |
| Backup | Scripts verified with a BYPASSRLS role |
| Runtime supervision | None. The Runtime is started manually; no systemd unit was installed. |
| Health | API `/health` (DB). Runtime online state from heartbeat. Engine state on the OpenCode page. |
| Monitoring/alerting | Missing |
| Rollback | Code: revert the listed files. Engine: `rm -rf /opt/free-ai-engines/opencode/2.3.2` and unset `FREEAI_OPENCODE_*`; the Runtime then rejects OPENCODE jobs with `RUNTIME_JOB_KIND_UNSUPPORTED`. DB: nothing to roll back. |
