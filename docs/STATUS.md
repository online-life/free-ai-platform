# Free AI Platform Status

Last verified: 2026-11-25. Release decision: **NOT PRODUCTION READY** and **NOT PUBLICATION READY**.

## Current authoritative status

The current checkout is on `main` at baseline `a47781a3805801cccdaebf01d785189596c5afd6`. Remediation remains local and uncommitted. No remote is configured; no repository, release archive in the checkout, or publication was created. The source-package test generated and cleaned only temporary archives.

- The four identified high-severity production dependency advisories have patched versions in the lockfile. A fresh `pnpm audit --prod --audit-level=high` reported no known vulnerabilities.
- Current resolved versions: `prisma` and `@prisma/client` 6.19.3, `zod` 4.6.7, `effect` 3.22.1, and `deepmerge-ts` 8.0.2.
- Current implementation includes authentication, tenant/project APIs, central provider routing, Runtime management and job dispatch, and process sandbox support. Dedicated OpenCode and FreeLLMAPI integrations are absent; historical sections below do not describe current capabilities.
- Current evidence: 124 Vitest tests across 18 files, 9 Node security/unit/web-startup tests, 31 focused Layer 01 tests, and six isolated E2E tests passed. The focused Layer 01 results overlap with Vitest. All 13 migrations were applied on each of three disposable local PostgreSQL databases. Core E2E used non-superuser/non-BYPASSRLS roles; operations backup/restore used its documented non-superuser BYPASSRLS role.
- The `pnpm test` aggregate was not run as one command because its E2E runner uses a single database URL for suites requiring different PostgreSQL role attributes; the component suites were run separately. No skipped test was counted as passing.
- A local mocked provider path passed within project E2E. No live external provider credentials or production deployment environment were available. Live provider execution, TLS/reverse-proxy operation, and authenticated full-browser administration acceptance remain unverified.
- The final file-by-file classification covers 12,485 unique current/preserved paths: 7 modified tracked, 1 unchanged tracked, 305 untracked, 12,170 ignored, and 2 preserved-snapshot-only, including nine internal task-workspace files. The earlier “333 untracked files/directories” statement has no itemized manifest and cannot be reconciled exactly; the initial checkout measurement recorded 298 untracked files.
- The source-package builder includes `docs` and `scripts` wholesale but omits root `LICENSE` and `NOTICE`. It therefore includes internal/sensitive candidates and cannot be used for publication as-is. Five SVG brand assets and all 79 skill-catalog entries have unresolved provenance/license review. Six existing release archives and their sidecars remain preserved and are not current verified releases.

See [`FINAL-AUDIT-REPORT.md`](reports/FINAL-AUDIT-REPORT.md) and [`FINAL-PUBLICATION-READINESS-REPORT.md`](reports/FINAL-PUBLICATION-READINESS-REPORT.md) for commands, results, exclusions, and remaining risks.

## Historical status records — preserved, not current evidence

The following entries describe earlier checkout states and test runs. They are retained for context only; use the current evidence above and the final reports for present capabilities and release decisions.

### Historical (2026-11-23): OpenCode engine integration

Details: [`docs/internal-platform-integration/`](internal-platform-integration/07-test-and-production-readiness.md).

- **INTEGRATED:** OpenCode 2.3.2 (official CLI; the in-process SDK does not load on Node 22) runs as Runtime jobs `OPENCODE_CATALOG` and `OPENCODE` inside a new bubblewrap `engine` profile, with Free AI's permission policy injected, workspace config ignored, free-only model enforcement in the API, a live Runtime catalog check and a per-run cost check, and no fallback. Web console **OpenCode** page: engine status, models with free filter, task run with live progress, cancel. `GET /api/v1/integrations/opencode`.
- **TESTED_WITH_REAL_SERVICE:** catalog discovery (12 zero-priced models), API policy gates, tenant isolation, cancellation and cleanup, and the provider's real free-limit 429 (job failed, no fallback, workspace untouched). Browser acceptance of the page passed. Vitest 138/138; all 7 runnable E2E suites passed.
- **NOT VERIFIED:** a successful live coding task through Free AI. The OpenCode free tier on this host returned HTTP 429 for every free model (~23.5 h reset) after one direct test call succeeded.
- **REQUIRES APPROVAL:** D2 (OpenCode calls its provider directly, an exception to CLAUDE.md rules 8–9); D3 (OpenCode account login and credential storage on the Runtime).

### Historical (2026-11-23): Audit and repair

Full report: [`docs/free-ai-audit/01-phase1-discovery-and-repairs.md`](free-ai-audit/01-phase1-discovery-and-repairs.md).

- **Correction to the 2026-11-22 entry below:** the "6/6 E2E passed" result was obtained with the `postgres` superuser, which bypasses `FORCE ROW LEVEL SECURITY`. Re-run with a role that is neither superuser nor `BYPASSRLS`, 3 of 5 runnable suites **failed**: project creation returned 500 (RLS `WITH CHECK` on `project_members`), project lists were always empty, project-scoped runtime/provider membership checks always denied, and `backup-postgres.sh` aborted on the first RLS table.
- **FIXED:** `ProjectService.create` re-scopes its transaction to the new project before inserting the owner membership. Additive migration `0013_project_member_self_read` adds a permissive `SELECT`-only policy exposing a user's own membership rows in their tenant.
- **FIXED:** about 60 client/upstream error codes (invalid JSON, wrong content type, oversized body, bad query limit, provider URL/SSRF rejections, task/workflow rule violations, upstream provider faults) were returned as HTTP 500 `retryable: true`. They now map to 400/403/404/409/413/415/429/502. Malformed session tenant IDs now return 401 instead of 500. 5xx responses now write a structured stderr record (requestId, code; no messages).
- **FIXED:** backup/restore scripts check for `BYPASSRLS` first and exit `3` with an explicit code. Database role requirements are documented in `docs/13-operations/installation-backup-restore.md`.
- **TESTED (fresh PostgreSQL 18.6 database, non-superuser, non-BYPASSRLS app role):** 13/13 migrations applied. E2E 5/5 passed: `api-project-flow`, new `api-error-contract`, `auth-session-flow`, `runtime-workspace-flow`, `process-sandbox`. `operations-install-backup-restore` passed 1/1 with a dedicated `BYPASSRLS` backup role. Vitest 126/126, node tests 8/8, five `scripts/check-*.mjs` passed, Prisma validate, API/web typecheck and build passed.
- **NOT RUN:** `freellmapi-local.test.cjs`, because it starts the locally cached FreeLLMAPI container. FreeLLMAPI and OpenCode adoption are not approved.
- **OPEN:** `pnpm audit --prod` reports 4 high advisories: zod 3.25.76 (request path; the fix is a zod 4 major upgrade awaiting approval) and effect/deepmerge-ts via the Prisma CLI config loader (tooling path). Execution service, tool registry, execution policy, intake/requirements, project files/context/activity, workflow scheduler, settings and provider quota modules exist but are not wired to any HTTP route.

### Historical (2026-11-23): This closure patch

- Browser authentication now uses server-side persisted sessions and random opaque identifiers in `HttpOnly`, `SameSite=Strict` cookies; production cookies are `Secure`. Cookie-authenticated state-changing requests require CSRF token and matching Origin. Idle expiry (30 minutes), absolute expiry (12 hours), renewal, password-change rotation, logout revocation, lockout, and authentication audit events are implemented.
- Passwords are stored with salted Node scrypt (N=32768, r=8, p=1; legacy N=16384 hashes remain verifiable). Bootstrap and owner-provisioned users have generated temporary passwords and an API-enforced mandatory password change. The initial bootstrap response is one-time; login does not return a session token.
- Owner-only tenant-scoped user, role, and session routes provide provisioning, username changes, credential reset, lockout recovery, deactivation, role assignment, and session revocation. Provisioned users receive no role by default. `platform.manage` protects these routes; operations are audited.
- Added user administration pages to the protected workspace. The latest public-site patch adds and tests all 13 requested public routes; authenticated administration browser coverage remains incomplete.
- Project details now provide chat execution through `/api/v1/projects/:id/ai/execute`, requesting only privacy-approved verified-free or self-hosted models. The live authenticated browser flow has not been tested with an available model.
- `scripts/build-release-package.sh` creates a reproducible source archive and SHA-256 sidecar. The tested candidate is `release-candidate-latest/free-ai-platform-0.1.0.tar.gz`; it excludes local secrets/dependencies/model weights/build output, but requires Node.js, pnpm, registry access, and does not install system services.
- Added migrations `0010_optional_email_identity` and `0011_auth_lifecycle`. Both were applied to a newly created disposable PostgreSQL database.

### Historical (2026-11-23): Verification from that tree

- `DATABASE_URL=$DISPOSABLE_DATABASE_URL pnpm prisma:migrate:deploy` — all 11 migrations applied on a fresh disposable PostgreSQL database.
- `pnpm prisma:validate` with `DATABASE_URL=postgresql://localhost/freeai` — passed.
- `pnpm typecheck`, `pnpm web:typecheck`, `pnpm api:build`, `pnpm web:build`, and `git diff --check` — passed.
- `node --test tests/security/layer-01/*.test.mjs tests/unit/layer-01/*.test.mjs tests/web/server-startup.test.mjs` — 8/8 passed, including occupied-port handling, listener reuse, runtime API origin config/CSP, and reproducible source packaging.
- `node --test tests/unit/layer-01/release-package.test.mjs` with process execution permission — 1/1 passed; two independently built source archives had identical hashes and excluded secrets, dependencies, and build outputs.
- Original auth closure `pnpm exec vitest run` — 123/123 passed. Latest full suite after public website, connector identity, and model-selection changes — 126/126 passed (18 files) with loopback networking permission. A restricted attempt reproduced the known two loopback-listener `EPERM` failures; no tests were weakened.
- `DATABASE_URL=.../freeai_auth_test_5 pnpm test:e2e:auth` — 1/1 PostgreSQL auth integration passed, including cookie attributes, CSRF/origin rejection, bootstrap replay denial, forced password change, session rotation/revocation, user and role administration, lockout, and audit evidence.
- Full `pnpm test:e2e` against `freeai_auth_test_8` — all 6 E2E scenarios passed, including API CRUD and tenant isolation, auth lifecycle, local FreeLLMAPI discovery, Runtime workspace execution/cancellation, sandbox isolation, and install/backup/restore. Final TAP summary: 6 passed, 0 failed, 0 skipped.
- `node scripts/browser-smoke.mjs` passed after the project chat form and runtime API config changes: English-only/LTR identity, public landing page, anonymous workspace gate, no signup copy, theme persistence, and responsive 390px public navigation. No full viewport matrix or accessibility audit was run. Runtime workspace, sandbox, and install/restore E2E also passed in the final 6-scenario run.
- After adding the project chat form, web typecheck and focused browser-source contract test passed (3/3), followed by the full Vitest suite (17 files, 123/123). Authenticated browser execution and live model inference remain unverified.
- The web server now serves non-secret `API_BASE_URL` runtime config and generates `connect-src` from its validated origin; API-origin unit/contract tests (2/2) and server integration tests (3/3) passed. Same-origin reverse-proxy routing is documented but has not been deployed behind a real proxy.

### Historical (2026-11-23): Remaining release blockers

- A reproducible source package exists at `release-candidate-latest/`, but production installation, OS service management, upgrades and recovery are incomplete.
- The public route set, owner-configurable contact/social/footer/Terms/Privacy content, and public browser viewport matrix are now implemented and tested. Authenticated provider administration and project execution still need browser acceptance across viewports.
- OpenCode integration is not implemented; no CLI binary/cache was present. FreeLLMAPI was tested through authenticated model discovery; the project execution form uses the central gateway with a free-only policy, but successful live inference, streaming, quotas, and managed lifecycle are not verified/completed. No provider credentials or local model cache were present.
- Native provider coverage and full agent/tool/workflow management remain partial.
- Final-tree runtime workspace isolation, SSRF/DNS rebinding, authenticated admin browser checks, and production security acceptance suite are not fully rerun. The public page browser matrix passed this closure patch.
- No production deployment, TLS termination, real external provider account, or production secret-management configuration was available.

The classifications and evidence are detailed in `docs/reports/FINAL-PRODUCTION-CLOSURE-REPORT.md`.

### Historical (2026-11-22): Public website and provider identity patch

- **IMPLEMENTED:** Public routes for Home, About, Features, Platform Modules, AI Providers, Models, Pricing and Plans, Contact, Documentation, FAQ, Terms of Service, Privacy Policy, and Login render distinct English/LTR content with route titles/descriptions, responsive navigation, footer links, and semantic page structure.
- **INTEGRATED:** `GET /api/v1/public/site` exposes only schema-validated public fields. Owner-only `GET/PUT /api/v1/admin/public-site` stores public name/description, contact methods, HTTPS social/support links, footer, and Terms/Privacy text in the additive `platform_public_settings` singleton. Updates are permission checked and audited. The public endpoint fails closed to `{}` if stored JSON does not match the public schema.
- **IMPLEMENTED:** Central provider identity registry covers only API-supported connector types: OpenAI-compatible API, local OpenAI-compatible server, and FreeLLMAPI model gateway. No verified official logo files were present; neutral accessible SVG marks are used and unrecognized values fall back neutrally.
- **INTEGRATED:** Provider edit/credential rotation, health/catalog test, enable/disable, and model catalog controls use existing authenticated API operations. Provider credentials remain server-side. Project execution now exposes eligible models and sends the selected `modelKey`; the API rechecks the selection against enabled, available, privacy-approved, verified-free/self-hosted policy.
- **TESTED:** Migration `0012_platform_public_settings` applied after all 11 prior migrations to fresh disposable PostgreSQL database `freeai_public_site_20261122`. Auth E2E passed 1/1 with anonymous public read, anonymous editor denial, owner persistence, non-owner update denial, and audit event checks. Vitest now passed 126/126 across 18 files. Web/API typechecks and production builds passed. Chromium browser acceptance passed the 13 routes at 390/768/1024/1440 px, public/private boundary, link labels, neutral provider marks, no horizontal overflow, and mobile menu navigation. API live requests returned 200 for public settings and 401 for anonymous admin/project routes.
- **NOT IMPLEMENTED / BLOCKED:** No official provider logos were added because authenticity/use could not be established. Authenticated browser coverage of the provider editor and project model dropdown is not yet live-verified. FreeLLMAPI inference, OpenCode, production installer/service lifecycle, reverse-proxy/TLS hardening, and deployment security acceptance remain blockers. Release remains **NOT PRODUCTION READY**.
### Historical publication preparation note

OpenCode and FreeLLMAPI dedicated operational integrations were removed from the repository on 2026-11-25. Historical audit documents may describe earlier implementation work but must not be interpreted as current product capabilities.
