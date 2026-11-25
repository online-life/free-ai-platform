# Phase 1: discovery, audit and repairs

Date: 2026-11-23. Scope: the existing repository at `/opt/free-ai` (commit `a47781a` plus the uncommitted working tree). Status values follow the audit directive's vocabulary.

Phase 2, the ten-platform research, has **not started**. The other deliverables listed in the directives (`docs/free-ai-audit/00…12`, `docs/internal-platform-integration/*`, and the JSON registries) are not written yet. This report does not fill them with unverified content.

## 1. Verified architecture map

| Component | Location | Status | Evidence |
|---|---|---|---|
| HTTP API (modular monolith, Node `http`, hand-written router) | `apps/api/src/main.ts` | VERIFIED_WORKING | E2E suites below |
| Auth: cookie sessions, CSRF+Origin, scrypt, lockout, forced password change, one-time bootstrap | `modules/authentication`, `modules/identity` | VERIFIED_WORKING | `auth-session-flow` E2E |
| RBAC (tenant roles/permissions) | `modules/authorization` | VERIFIED_WORKING | E2E admin and denial checks |
| Tenant/project isolation (PostgreSQL FORCE RLS + `app.*` settings) | migrations `0001`–`0013`, `infrastructure/database` | VERIFIED_WORKING after fix | Previously never exercised (superuser); see §2 |
| Projects and tasks | `modules/projects/project.service.ts`, `tasks.service.ts` | VERIFIED_WORKING after fix | `api-project-flow`, `api-error-contract` |
| Provider gateway (OpenAI-compatible, local, FreeLLMAPI connector types), encrypted credentials, SSRF guard with DNS pinning | `modules/providers`, `modules/secrets` | TESTED_WITH_MOCKS | Unit tests use mock upstreams. No real inference has ever run. |
| Model selection / routing / free-only policy | `modules/model-intelligence` | TESTED_WITH_MOCKS | `smart-router`, `model-availability-policy` |
| Agent registry (versions, evaluations, selection, project memory) | `modules/agents` | PARTIALLY_IMPLEMENTED | Metadata registry only. Agents do not execute anything. |
| Workflow engine (definitions, runs, approvals, resume) | `modules/workflows` | PARTIALLY_IMPLEMENTED | Routes wired. The scheduler and observability services are not wired. |
| Local Runtime (device pairing, heartbeat, jobs, workspaces, cancel) | `services/ai-runtime`, `modules/execution/runtime-management.service.ts` | VERIFIED_WORKING | `runtime-workspace-flow` E2E |
| Sandbox (bubblewrap with net/pid/ipc/uts unshare, workspace-only write, prlimit, env secret filter) | `services/ai-runtime/src/process-sandbox.ts` | VERIFIED_WORKING | `process-sandbox` E2E. No seccomp profile and no cgroup limits. |
| Web console (vanilla JS, 13 public routes, workspace) | `apps/web` | VERIFIED_PRESENT | All 40+ API paths called by `main.js` exist in the router |
| Backup / restore / local install | `scripts/*.sh` | VERIFIED_WORKING with a BYPASSRLS backup role | `operations-install-backup-restore` E2E |
| Skills registry | `skill-registry/catalog.json` | SECURITY_REVIEW_REQUIRED | 79 skills: all `pending_review`, licence `unverified` |

**Modules not reachable from any HTTP route** (static import graph from `main.ts`): `execution.service`, `tool-registry.service`, `execution-policy.service`, `execution-artifact.service`, `intake.service`, `requirements.service`, `project-files.service`, `project-context.service`, `project-activity.service`, `workflow-scheduler.service`, `workflow-observability.service`, `settings.service`, `storage-policy`, `provider-quota.service`, `provider-health.service`, `provider-registry.service`, `model-registry.service`, `model-health.service`, `observability/health`, `tenant.middleware`. These count as PARTIALLY_IMPLEMENTED: the code exists, but the product does not use it. There is no Tool/MCP registry exposed through the API, and no agent engine executes tasks.

## 2. Defects found (by severity)

| # | Severity | Defect | Root cause | Status |
|---|---|---|---|---|
| D1 | Critical | Under any least-privilege DB role, project creation returned 500 and project lists were always empty | `project_members` RLS only exposes rows where `projectId = app.project_id`. `create` inserted the owner membership and `list` read memberships with `app.project_id = ''`. | FIXED |
| D2 | Critical | Project-scoped membership checks (runtime workspaces/jobs, provider project scope) always denied under RLS | Same policy; the checks ran unscoped | FIXED (migration 0013) |
| D3 | High | Prior evidence was invalid: E2E had only run as the `postgres` superuser, which bypasses FORCE RLS | Test setup | CORRECTED in `docs/STATUS.md` |
| D4 | High | `backup-postgres.sh` aborts on the first RLS table for a non-BYPASSRLS role. The role requirement was undocumented. | `pg_dump` row-security semantics | FIXED (preflight, exit 3, docs) |
| D5 | Medium | About 60 client/upstream error codes returned HTTP 500 `retryable: true` | Missing entries in the `errorResponse` status map | FIXED |
| D6 | Medium | A malformed tenant ID in a cookie or `X-Tenant-Id` header returned 500 | `applyDatabaseScope` throws before session lookup | FIXED (401) |
| D7 | Medium | 5xx errors were swallowed without any server-side record | Catch-all had no logging | FIXED (structured stderr, no messages) |
| D8 | Low | `auth-session-flow` E2E asserted the global public-site singleton was `{}`, so it failed on every rerun | Test assumed fresh state | FIXED (asserts public-field whitelist) |
| D9 | High (open) | zod 3.25.76 advisory: memory exhaustion on oversized constrained collections (request path) | Dependency | NEEDS APPROVAL (zod 4 major upgrade). Mitigated by the 1 MiB body cap. |
| D10 | Medium (open) | effect <3.22.1, deepmerge-ts <8 via `prisma` → `@prisma/config` | Dependency (CLI/tooling path) | OPEN: wait for a Prisma release that bumps them |
| D11 | Low (open) | `pnpm test` exits 0 and prints `SKIP` when `DATABASE_URL` is unset, so a green run can include no E2E coverage | Runner design | DOCUMENTED |
| D12 | Low (open) | SSRF guard treats `2002::/16` (6to4) as public, and 6to4 can embed a private IPv4 address | `isPublicAddress` | OPEN |
| D13 | Low (open) | `PUT /api/v1/admin/public-site` writes a platform-wide singleton, so any tenant's `platform.manage` holder can edit it | Single-tenant assumption | OPEN: decide the multi-tenant policy |

## 3. Changes made

| File | Change | Rollback |
|---|---|---|
| `apps/api/prisma/migrations/0013_project_member_self_read/migration.sql` | New additive `SELECT`-only permissive policy: own membership rows in own tenant | `DROP POLICY IF EXISTS "project_members_self_read" ON "project_members";` then delete the `_prisma_migrations` row |
| `apps/api/src/modules/projects/project.service.ts` | `create`: insert the project, re-scope the transaction to the new project ID, then insert the OWNER membership | `git checkout` the file |
| `apps/api/src/main.ts` | Status map entries for D5/D6, `logServerError`, no double-send after headers are written | `git checkout` the file |
| `apps/api/src/modules/authentication/authentication.service.ts` | `validateSession` rejects a non-UUID tenant and tokens over 512 characters as unauthenticated | `git checkout` the file |
| `scripts/backup-postgres.sh`, `scripts/restore-postgres.sh` | BYPASSRLS preflight (exit 3) | `git checkout` the files |
| `tests/e2e/api-error-contract.test.cjs` (new), `scripts/run-e2e.mjs` | Regression test for D1/D5/D6 under RLS, registered in the runner | Delete the file and the runner line |
| `tests/e2e/auth-session-flow.test.cjs` | D8 | `git checkout` the file |
| `docs/STATUS.md`, `docs/13-operations/installation-backup-restore.md` | Corrected evidence; DB role requirements | `git checkout` the files |

No new dependencies. No services started. No model, provider, or container activated.

## 4. Test evidence (2026-11-23)

Environment: Node 22.23.5, pnpm 9.12.0, PostgreSQL 18.6 (local, shared server; disposable databases and roles were created for the run and dropped afterwards), bubblewrap at `/usr/bin/bwrap`.

| Check | Result |
|---|---|
| `pnpm typecheck`, `pnpm web:typecheck`, `pnpm api:build`, `pnpm web:build`, `prisma validate`, `git diff --check` | pass |
| `vitest run` | 126/126 (18 files) |
| `node --test` security/unit/web | 8/8 |
| `scripts/check-{architecture,contracts,structure,layer-01,layer-01-core}.mjs` | 5/5 pass |
| `prisma migrate deploy` on a fresh DB | 13/13 migrations |
| E2E before fix, app role non-superuser and non-BYPASSRLS | **2/5 pass**. Failures: api-project-flow, runtime-workspace-flow (D1), ops backup (D4). |
| E2E after fix, fresh DB, same role | **5/5 pass**: api-project-flow, api-error-contract, auth-session-flow, runtime-workspace-flow, process-sandbox |
| Ops E2E with a dedicated BYPASSRLS backup role | 1/1 pass |
| `freellmapi-local.test.cjs` | NOT RUN: it would start the FreeLLMAPI container, which is not approved |
| `pnpm audit --prod` | 4 high (D9, D10) |
| Live model inference | NOT VERIFIED: no approved provider or local model is configured |

## 5. Production-readiness blockers that remain

1. No verified model-inference path, so the core AI function is unproven.
2. No agent engine executes tasks. The agent registry holds metadata only.
3. About 20 domain modules are not wired to the API (§1).
4. Sandbox has no seccomp filter or cgroup CPU/memory accounting. Only prlimit is applied.
5. No TLS/reverse-proxy deployment, OS service supervision, upgrade or rollback procedure has been verified.
6. zod advisory (D9) is awaiting an upgrade decision.
7. No skill has been security-reviewed or licence-verified.
