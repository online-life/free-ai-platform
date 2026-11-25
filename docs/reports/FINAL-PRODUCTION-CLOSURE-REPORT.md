# Free AI Platform — Final Production Closure Report

Review date: 2026-11-22  
Repository: `/opt/free-ai`  
Release decision: **NOT PRODUCTION READY**

## A. Executive summary

This patch closes important authentication gaps: browser credentials are no
longer stored in web storage; sessions are persisted server-side and carried in
HttpOnly cookies; CSRF and Origin checks protect cookie-authenticated writes;
temporary passwords require a change enforced by the API; and owner-managed
user, role, and session operations are available through tenant-scoped routes.
The project page now offers chat execution through the central provider gateway
with a verified-free or self-hosted selection policy. Provider setup and the
execution policy are documented. A reproducible source archive builder emits
a SHA-256 checksum. Previous repository work was preserved.

Fresh PostgreSQL migrations, auth integration tests, builds, and all Vitest
tests passed. The final E2E command completed with 6 scenarios passed and no
failures, including Runtime workspace execution and installer backup/restore.
The public site now has 13 distinct tested routes, owner-managed public content,
and a responsive public browser acceptance run. Provider/model identity is
registry-driven with neutral fallbacks, and the project request UI sends an
explicit server-revalidated eligible model choice. Production service
installation, OpenCode, successful FreeLLMAPI inference, authenticated
administration browser coverage, and production security acceptance remain
incomplete or unverified. No paid provider requests were made.

## B. Authentication and installation

| Requirement | Classification | Evidence / limitation |
|---|---|---|
| First owner bootstrap and no public signup | TESTED | Single-use, advisory-locked bootstrap; generated owner name and temporary password; dedicated HTTP integration flow verifies replay rejection. |
| Credential entropy and password storage | IMPLEMENTED | Cryptographic random username/password; salted scrypt N=32768, r=8, p=1; legacy N=16384 verification retained. |
| Browser session storage | TESTED | 32-byte opaque session identifier; only SHA-256 digest persisted; login JSON does not return token; auth E2E verifies cookie attributes and revocation. |
| Cookie/session protections | TESTED | HttpOnly, SameSite=Strict, Secure in production; 30-minute idle/12-hour absolute expiry; renewal, CSRF/origin validation, password-change rotation, logout/session revocation. Reverse proxy/TLS production behavior is not live-verified. |
| Brute-force protection and auth audit | TESTED | Progressive lockout after five failures; lock/reject/success/password/session operations emit audit entries in auth E2E. |
| Mandatory temporary-password change | TESTED | Bootstrap and provisioned users are gated at API level; change rotates session and revokes prior sessions. |
| Owner user/role/session operations | TESTED | Tenant-scoped provision, username change, reset, unlock, disable, explicit role assignment, session listing/revocation; new users have no role by default; one focused PostgreSQL E2E. |
| User recovery and full account lifecycle | IMPLEMENTED | Reset/unlock/deactivate operations exist; account activation, comprehensive dependency-safe deletion, last-activity presentation and full admin UX are not complete. |
| Public/private route and API boundary | TESTED | Chromium verified that anonymous hashes for private workspace routes remain on the public surface; live API requests to admin settings and projects returned 401; authenticated public settings read remained available. |
| Username/tenant trust boundary | IMPLEMENTED | Tenant selector is only a lookup hint; principal and roles derive from persisted session/user; tenant-scoped queries. API bearer mode remains for non-browser clients. |

## C. Public website

| Requirement | Classification | Evidence / limitation |
|---|---|---|
| Home, About, Features, Platform Modules, AI Providers, Models, Pricing and Plans, Contact, Documentation, FAQ, Terms, Privacy, Login | TESTED | Distinct route renderer and page-specific content in `apps/web/src/main.js`; browser smoke exercised all 13 public routes. |
| Public header/footer, internal navigation and login entry | LIVE-VERIFIED | Browser smoke verified route links, mobile details menu, login modal, footer links, app identity and anonymous workspace boundary. |
| Owner-controlled platform description, contact, social links, footer and Terms/Privacy content | INTEGRATED | `PlatformPublicSettings` singleton with migration `0012_platform_public_settings`; owner settings UI; public allow-listed API; auth E2E validates persistence, unauthenticated denial, non-owner denial and audit. |
| English-only, LTR and viewport overflow | TESTED | Chromium browser test at 390, 768, 1024 and 1440 px; each public route checked for horizontal overflow and one semantic H1. |
| Accessibility | TESTED (focused) | Semantic headings, labelled navigation, accessible neutral provider marks, named links/buttons, visible focus rules and keyboard traversal of the mobile menu were checked in browser acceptance. Automated contrast and screen-reader testing remain unverified. |
| Public API secret exclusion | TESTED | `GET /api/v1/public/site` projects only schema-valid public settings; live API returned 200 anonymously, while `/api/v1/admin/public-site` and `/api/v1/projects` returned 401. |

## D. UI/UX

No UI framework was added; the repository's vanilla JavaScript/CSS architecture
was retained. The public site uses reusable route data and shared layout styles;
provider marks are neutral SVG code from `apps/web/src/provider-identity.js`,
not unverified provider trademarks. Public route controls were browser-checked
for working destinations and accessible names. Chromium verified 390/768/1024/
1440 px without horizontal overflow, and the native mobile navigation was
keyboard traversed. This was a focused public-page accessibility review, not a
complete authenticated administration audit, contrast certification, or
screen-reader test.

## E. Platform modules

| Module | Classification | Tested | Production-ready | Remaining limitations |
|---|---|---|---|---|
| Identity/auth/session | TESTED | Focused PostgreSQL HTTP E2E; Vitest hash and browser contract tests | No | No production TLS/proxy/security acceptance. |
| User/role/session administration | TESTED | Auth E2E covers creation, role assignment, reset, lockout, deactivation, session revocation and audit | No | Full account lifecycle and audit presentation remain partial. |
| Projects/tasks and project chat UI | INTEGRATED | PostgreSQL feature E2E covers gateway execution; focused UI contract test checks the gateway route and free-only policy | No | Authenticated browser execution against a live model remains unverified. |
| Providers/models and public identity | TESTED | Existing connector/policy tests; new provider identity unit tests; browser catalog marks; owner settings/auth E2E; PostgreSQL migration `0012` | No | No official artwork provenance; FreeLLMAPI inference and full provider live lifecycle remain incomplete. Authenticated editor/model-selector browser testing remains unverified. |
| Agents | INTEGRATED | PostgreSQL API test covers registry/version/evaluation/activation/selection | No | Tool authorization, factory, isolated execution and full user flows incomplete. |
| Workflows | INTEGRATED | Existing workflow code is present; no complete final-tree lifecycle acceptance | No | Visual editor and robust parallel/retry/recovery lifecycle incomplete. |
| Runtime/sandbox | INTEGRATED | Runtime workspace E2E and process sandbox tests passed in final full-suite run | No | Broader hostile-input, syscall, and production deployment review remains. |
| Installer/operations | TESTED (prior evidence) | Prior clean migration and PostgreSQL backup/restore E2E; this patch's additive migration applied to a fresh disposable database | No | Archive requires Node.js/pnpm and registry access; no system service lifecycle or upgrade rollback. |

## F. Integrations

| Integration | Implemented | Integrated | Tested | Live-verified | Inference-tested | Status |
|---|---:|---:|---:|---:|---:|---|
| Provider identity registry and public catalog | Yes | Yes | Vitest + browser route/asset fallback acceptance | Public catalog live in Chromium | N/A | Supported connector identities only; neutral marks used because official artwork provenance was unavailable. |
| Generic OpenAI-compatible connector | Yes | Adapter/gateway | Unit and feature E2E | No external provider | Mock only | Unknown/paid models blocked unless policy permits. |
| FreeLLMAPI | Partial | Authenticated discovery; project chat UI sends through the central gateway | Local pinned container discovery and gateway contract tests | Local service only | No successful live inference | **BLOCKED** on approved model access; streaming, usage/quota and managed lifecycle remain incomplete. |
| OpenCode | No | No | No CLI binary or cache found in current workspace | No | No | **NOT IMPLEMENTED** as a coding-agent integration; gateway-controlled credentials and Runtime-bound adapter remain required. |
| Native provider-specific connectors | Partial | Generic compatibility only for some | Adapter tests only | No | No | **BLOCKED** for provider account testing; many native APIs not implemented. |
| Internal Runtime | Partial | Process sandbox is available | Sandbox unit test; historical integration evidence | Local only | N/A | **NOT VERIFIED** across every current agent/OpenCode execution route. |

No credentials for external model providers were supplied and no model weights
were present in a local cache. Unknown pricing is not classified as free. No
paid request was made. The FreeLLMAPI test proves container authentication and
model discovery only, not inference.

## G. Security evidence

| Security check | Result |
|---|---|
| Authentication, CSRF, Origin, forced password change, session rotation and logout revocation | TESTED in focused PostgreSQL HTTP E2E (1/1 passed). |
| User/role/session tenant scoping and privilege checks | TESTED in focused auth E2E. |
| Password hash behavior and browser token-storage contract | TESTED in Vitest; latest full suite 126/126 passed with loopback permission. |
| SQL/authorization and route matrix beyond covered endpoints | NOT VERIFIED comprehensively. |
| SSRF/DNS rebinding | Prior adapter adversarial tests exist; not rerun as a full security acceptance suite in this patch. |
| Symlink escape, network isolation, process timeout/cancel and resource limits | Prior runtime evidence exists; current E2E sandbox test passed; full final-tree API-to-Runtime matrix NOT VERIFIED. |
| XSS, dependency audit, production secret/key rotation, backup encryption | NOT VERIFIED. |

## H. Installer and operations

Migration `0011_auth_lifecycle` and preceding migrations were applied to a new
disposable PostgreSQL database (`freeai_auth_test_8`); all 11 migrations
reported success. The E2E install/backup/restore case passed: clean local
migration path, backup inspection, populated-target refusal, explicit
confirmation, restore to empty database, and data/migration comparison.
The reproducible source archive is
[`release-candidate-latest/free-ai-platform-0.1.0.tar.gz`](/opt/free-ai/release-candidate-latest/free-ai-platform-0.1.0.tar.gz)
with a validated checksum. It excludes credentials, dependency caches, model
weights, and build output. It still requires Node.js/pnpm and registry access;
it is not a self-contained installer. OS service definitions, secret-manager
configuration, upgrade rollback, uninstall, and production restore remain
incomplete.

## I. Test evidence

Commands and actual results:

- `DATABASE_URL=postgresql://localhost/freeai pnpm prisma:validate` — PASS.
- `pnpm typecheck` — PASS.
- `pnpm web:typecheck` — PASS.
- `pnpm api:build` — PASS.
- `pnpm web:build` — PASS.
- `git diff --check` — PASS after implementation changes and before the final documentation-only edits.
- `node --test tests/security/layer-01/*.test.mjs tests/unit/layer-01/*.test.mjs tests/web/server-startup.test.mjs` after package work — 8/8 passed. The release-package subtest built two byte-identical archives and confirmed secrets, dependencies, and build output were excluded.
- Runtime web API-origin configuration — API-origin Vitest 2/2 and server startup/integration 3/3 passed. `/config.js` is no-store; its validated origin matches the generated CSP. Actual reverse-proxy/TLS deployment remains unverified.
- `scripts/build-release-package.sh release-candidate-latest`, `sha256sum -c`, and `tar -tzf` — PASS.
- `DATABASE_URL=postgresql://localhost/freeai pnpm prisma:validate`, `pnpm typecheck`, `pnpm web:typecheck`, `pnpm api:build`, and `pnpm web:build` after the public-site/model-selector patch — PASS.
- `pnpm exec vitest run` after adding provider identity and explicit model selection coverage — sandbox run had 124 pass and 2 loopback listener failures (`listen EPERM`); rerun with loopback permission — **18 files, 126/126 passed**.
- `DATABASE_URL=$DISPOSABLE_DATABASE_URL pnpm prisma:migrate:deploy` — PASS on a newly created disposable PostgreSQL database; migrations 0001 through 0012 applied.
- `DATABASE_URL=$DISPOSABLE_DATABASE_URL pnpm test:e2e:auth` — **1/1 passed** on a second fresh disposable database with the final API build, including anonymous public settings read, anonymous settings-editor rejection, owner save/read persistence, non-owner update rejection, and `PUBLIC_SITE_SETTINGS_UPDATED` audit event.
- `node scripts/browser-smoke.mjs` with the web server connected to the local API — **LIVE-VERIFIED** all 13 public page routes at 390/768/1024/1440 px; no horizontal overflow; responsive menu, named links/buttons, app name metadata, provider icon fallback, theme, and anonymous private-route boundary passed. Public/private API checks: `GET /api/v1/public/site` returned 200; anonymous `GET /api/v1/admin/public-site` and `/api/v1/projects` returned 401.
- `pnpm exec vitest run tests/web/brand-language.test.ts tests/web/auth-cookie-contract.test.ts tests/web/provider-identity.test.ts` after the final provider health display change — **3 files, 7/7 passed**; final browser matrix rerun also passed.
- The full `pnpm test:e2e` orchestration was not rerun in this patch because it starts and removes a Docker FreeLLMAPI service; repository instructions prohibit starting services without explicit approval. The prior closure's recorded full E2E result remains 6/6; this patch ran the focused PostgreSQL auth/public-settings case against fresh disposable databases. No model inference request was made.
- `pnpm web:typecheck`, `pnpm web:build`, and `pnpm exec vitest run tests/web/auth-cookie-contract.test.ts` after project chat UI change — PASS, 3/3 focused tests; then full Vitest passed: 17 files, 123/123 tests.
- `DATABASE_URL=.../freeai_auth_test_5 pnpm prisma:migrate:deploy && DATABASE_URL=.../freeai_auth_test_5 pnpm test:e2e:auth` — 11 migrations applied; 1/1 auth test passed.
- `DATABASE_URL=.../freeai_auth_test_6 node --test tests/e2e/api-project-flow.test.cjs` — 1/1 passed after converting obsolete registration fixtures to persisted test identities; users without project-read permissions receive 403.
- `DATABASE_URL=.../freeai_auth_test_7 node --test tests/e2e/freellmapi-local.test.cjs` — 1/1 passed; real local FreeLLMAPI authentication and model catalog discovery only.
- `DATABASE_URL=.../freeai_auth_test_8 pnpm prisma:migrate:deploy` — all 11 migrations applied.
- `DATABASE_URL=.../freeai_auth_test_8 pnpm test:e2e` — 6 passed, 0 failed, 0 skipped. This included Runtime workspace integration, process sandbox, and installer/backup/restore scenarios.
- `node scripts/browser-smoke.mjs` with the local web preview — PASS after the project chat UI and runtime API config changes: English/LTR, anonymous public landing and workspace gate, no signup, theme persistence, 390px navigation. Wider viewport matrix and accessibility audit not run; authenticated model execution was not browser-driven.
- FreeLLMAPI live inference, OpenCode execution, production installation, and full security acceptance suite — **NOT RUN / NOT VERIFIED**. The workspace has no `.env`, provider credentials, local model cache, or OpenCode binary.

Earlier failed E2E attempts led to test fixture corrections; no tests were
weakened or skipped to obtain a passing result. Test databases were disposable
and separate; no production data was used.

## J. Remaining blockers

| Severity | Blocker | Impact | Exact next action |
|---|---|---|---|
| Critical | Production deployment/session model not tested behind actual TLS/proxy | Cookie security and operational behavior are not established in deployment | Configure a staging TLS deployment and run auth, CSRF, expiry, rotation, revocation and lockout acceptance tests. |
| High | Source package exists but production installer/service management does not | Operators cannot perform supported production install/upgrade | Implement OS service lifecycle, protected environment provisioning, upgrades, rollback and data-preserving uninstall; test on a disposable Linux deployment. |
| High | Authenticated provider/editor and project execution screens have not received browser acceptance across viewports | Management controls may have unobserved interaction or layout defects even though APIs and public pages pass | Use a disposable authenticated browser fixture to test provider create/edit/rotation, model selection, errors, and admin layouts at required viewport sizes. |
| High | Successful FreeLLMAPI inference and full lifecycle unverified | Local gateway discovery works, but no generation was verified | Configure an approved free credential/model or local server, verify pricing, then run inference through the project UI and implement streaming/usage/lifecycle. |
| High | OpenCode adapter absent | Coding-agent integration requirements unmet | Implement isolated Runtime dispatch, cancellation, result capture, credential setup and audit; test actual execution in sandbox. |
| High | Agent/tool/workflow execution and approval coverage partial | AI operations lifecycle incomplete | Complete authorized tool execution, workflow persistence/recovery and final Runtime-bound integration tests. |
| High | SSRF, DNS rebinding, XSS, dependency and sandbox acceptance not rerun comprehensively | Security assurance incomplete | Execute dedicated security suite against final deployed paths and retain evidence. |

## K. Final release decision

**NOT PRODUCTION READY**

The authentication improvement is material and its focused integration test
passes, and the public website has focused live browser evidence. Production
installation, successful AI inference and coding-agent execution, authenticated
administration browser verification, final runtime proof, and complete
security acceptance still have critical or high-severity gaps.
