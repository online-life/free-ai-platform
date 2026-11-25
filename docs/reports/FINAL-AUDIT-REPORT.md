# Final Audit Report

Audit date: 2026-11-25

Authoritative checkout: `/root/Application/free-ai-platform`

Branch and baseline: `main`, `a47781a3805801cccdaebf01d785189596c5afd6`

## Executive result

The four identified high-severity production dependency advisories have patched versions in the lockfile, and a fresh production audit reports no known vulnerabilities. Targeted type checks, builds, Prisma checks, unit tests, Node tests, and isolated PostgreSQL E2E tests passed as recorded below.

The repository is **not production-ready or publication-ready**. The source-package builder omits `LICENSE` and `NOTICE`, includes internal documentation and credential-shaped maintenance scripts, and existing release archives are stale and lack the license files. Five SVG brand assets and the third-party skill catalog have unresolved provenance. Live external-provider execution and production deployment acceptance were not verified.

No file was staged or committed; no remote, repository, release archive in the checkout, or publication was created by this remediation. The source-package reproducibility test built only temporary archives and cleaned its test outputs.

## Checkout reconciliation

- The working tree is on `main` at the original baseline commit `a47781a3805801cccdaebf01d785189596c5afd6`. The preserved comparison branch remains `preserved/online-life-publication-preparation-20261125060124659`, pointing at `11e32bb8298d984c7f2e458cded65bd29bdcf835`.
- The baseline measurement recorded 7 modified tracked files and 298 untracked files. The final inventory covers 12,485 unique paths: 7 modified tracked, 1 unchanged tracked, 305 untracked, 12,170 ignored, and 2 preserved-snapshot-only paths. It includes the nine ignored files in this remediation's own internal workspace and the new audit report as an untracked path. The earlier “333 untracked files/directories” statement has no itemized manifest or reproducible count and cannot be reconciled exactly; its file/directory wording is not comparable to Git's file-path count.
- The final path-by-path classification is `FINAL-PUBLICATION-INVENTORY.csv`. It includes ignored/generated paths as well as tracked, modified, untracked, and preserved-snapshot-only paths. `include candidate` is a review classification, not publication approval.
- Existing backup, candidate, release, and internal directories were preserved. No Git remote is configured.

## Production dependency advisories

| Advisory | Previously resolved package and path | Affected range / fixed floor | Remediation in current lockfile |
|---|---|---|---|
| GHSA-mrhx-c7xc-m3w5 | Direct production dependency `zod@3.25.76` | `<4.6.6`; fixed `4.6.6` | `zod@4.6.7` |
| GHSA-38f7-945m-qr2g | `prisma@6.19.0` → `@prisma/config` → `effect@3.18.4` | `<3.20.0`; fixed `3.20.0` | Prisma/config `6.19.3`; scoped override `effect@3.22.1` |
| GHSA-7589-6fvf-x4pw | `prisma@6.19.0` → `@prisma/config` → `effect@3.18.4` | `<=3.22.0`; fixed `3.22.1` | Prisma/config `6.19.3`; scoped override `effect@3.22.1` |
| GHSA-ggr8-5vv4-36mx | `prisma@6.19.0` → `@prisma/config` → `deepmerge-ts@7.1.5` | `<8.0.0`; fixed `8.0.0` | Prisma/config `6.19.3`; scoped override `deepmerge-ts@8.0.2` |

`prisma` and `@prisma/client` were upgraded together from `6.19.0` to `6.19.3`; `pnpm-lock.yaml` was regenerated with pnpm 9.12.0. `pnpm why @prisma/config effect deepmerge-ts zod --depth 4` confirmed the current paths and versions. Zod v4 usage passed the existing compiler and test suites without weakening validation.

**Current audit:** `pnpm audit --prod --audit-level=high` — exit 0; “No known vulnerabilities found.” This is a fresh production-tree high-severity audit, not a claim that every dev dependency or all classes of security risk are clean.

**Compatibility ruling:** Prisma 7 was not selected. The tested Prisma 6 patch plus narrowly scoped config overrides avoids the larger ESM, generator-output, and driver-adapter migration. The v8 `deepmerge-ts` default Map behavior is not used by the current Prisma config path; an untested config edge case remains a possible compatibility risk.

## Verification evidence

| Command / scope | Result |
|---|---|
| `pnpm audit --prod --audit-level=high` | Exit 0; no known vulnerabilities |
| `pnpm prisma:validate` and `pnpm prisma:generate` with a placeholder local `DATABASE_URL` | Exit 0; no real database was contacted |
| `pnpm typecheck && pnpm web:typecheck && pnpm api:build && pnpm web:build` | Exit 0 |
| `pnpm exec vitest run` | 18 files; 124 passed |
| `node --test tests/security/layer-01/*.test.mjs tests/unit/layer-01/*.test.mjs tests/web/server-startup.test.mjs` | Exit 0; 9 passed; emitted two existing `MODULE_TYPELESS_PACKAGE_JSON` warnings; its package-reproducibility case created and removed temporary test archives |
| `pnpm test:layer-01` | 3 files; 31 passed |
| `pnpm licenses list --json` and `pnpm licenses list --prod --json` | Exit 0; package metadata enumerated |
| `python3 .superpowers/sdd/2026-11-25-free-ai-publication-remediation/verify-task-1.py` | Exit 0; complete inventory coverage |
| `git diff --check` | Exit 0 |

The 31 focused Layer 01 tests overlap with the larger Vitest run and are not added to its total.

## Isolated integration and acceptance evidence

PostgreSQL 18.6 was used only on three uniquely named, task-created local databases. Each received all 13 migrations. These commands each exited 0 and applied all 13 migrations:

```sh
DATABASE_URL="$APP_DATABASE_URL" pnpm prisma:migrate:deploy
DATABASE_URL="$OPS_DATABASE_URL" pnpm prisma:migrate:deploy
DATABASE_URL="$FINAL_DATABASE_URL" pnpm prisma:migrate:deploy
```

Two application roles were non-superuser and did not have `BYPASSRLS`; the separate operations role was non-superuser and used `BYPASSRLS` only for the documented backup/restore test.

- `DATABASE_URL="$APP_DATABASE_URL" node --test tests/e2e/api-project-flow.test.cjs tests/e2e/api-error-contract.test.cjs tests/e2e/auth-session-flow.test.cjs tests/e2e/runtime-workspace-flow.test.cjs tests/e2e/process-sandbox.test.mjs` — exit 0; 5/5 passed (project API and tenant isolation, API error contract, authentication lifecycle, Runtime workspace/dispatch, and process sandbox).
- `DATABASE_URL="$OPS_DATABASE_URL" node --test tests/e2e/operations-install-backup-restore.test.mjs` — exit 0; 1/1 passed (install, backup, and restore using the dedicated operations role).
- Web startup tests are included in the 9 passing Node tests above. A local mocked provider path passed within project E2E.
- Final selected runs had zero skipped tests. The complete `pnpm test` aggregate was not run as one command because its E2E runner shares one `DATABASE_URL`, while RLS application tests and backup/restore require different role attributes; the suites were run separately with their appropriate roles.
- Live external-provider execution, provider credentials, production deployment, TLS/reverse-proxy operation, and authenticated full-browser administration acceptance were not tested. They are blocked or unverified, not passed.

Two exploratory E2E attempts failed before the final clean runs: one could not traverse `/root` as the sandbox test UID; another reused a database whose one-time auth bootstrap had already completed. The root traversal ACL was temporary and is absent now. The exact exploratory shell invocations and numeric exit statuses were not retained in the task ledger, so they are disclosed as failures without inventing commands or counts. No test was weakened or skipped to obtain the final passing results.

The three task-owned databases and roles were dropped after verification, and the private temporary connection file was removed without printing its values. A first combined multi-statement `DROP DATABASE` attempt exited 1 because PostgreSQL disallows that statement in a transaction block; each exact database and role was then dropped in an individual command, and a catalog query confirmed zero remaining task-owned databases or roles.

## Implementation and product-claim check

The current API routes and services include authentication, tenant/project APIs, central provider routing, Runtime management and job dispatch, and process sandbox support. Dedicated OpenCode and FreeLLMAPI implementations/routes are absent. Remaining OpenCode text is limited to explanatory UI/comment text, not an integration. A successful live request to an external provider has not been demonstrated.

## License, attribution, and provenance

- The project `LICENSE` and package manifests retain Apache-2.0 and `Copyright 2026 Mr. Joe`; no owner or license change was made. `NOTICE` now clarifies that the source builder excludes installed dependencies and that dependency-including distributions need applicable notices.
- Installed package metadata covered 87 distinct names and 90 resolved package-version instances. Declared licenses: 72 package names MIT, 10 Apache-2.0, 2 BSD-3-Clause, 1 BSD-2-Clause, and 2 ISC. The production tree contained 36 package names: 25 MIT, 9 Apache-2.0, 1 BSD-3-Clause, and 1 BSD-2-Clause.
- Four installed packages lacked adjacent license text: `stackback@0.0.2`, `@esbuild/linux-x64@0.28.2`, and Rollup Linux gnu/musl packages `4.68.7`. The esbuild and Rollup upstream MIT license texts were verified. Stackback declares MIT in package metadata, but no upstream license file was found; its notice-text provenance remains unresolved. These dependencies are not bundled in the source archive.
- No font binaries or bundled icon library were found. Ownership/provenance is not established for `apps/web/assets/free-ai-platform-app-icon.svg`, `apps/web/assets/free-ai-platform-favicon.svg`, `apps/web/assets/free-ai-platform-logo-dark.svg`, `apps/web/assets/free-ai-platform-logo-light.svg`, and `apps/web/assets/free-ai-platform-symbol.svg`; exclude them pending owner confirmation.
- All 79 records in `skill-registry/catalog.json` have `license_status: unverified` and `security_status: pending_review`. Exclude `skill-registry/` until source ownership and applicable terms are established.
- The broad set of untracked application and documentation files has no complete provenance history in Git. Inventory classification does not itself establish authorship; owner confirmation is still required before publication.

## Publication blockers and remaining risks

`scripts/build-release-package.sh` explicitly archives `docs` and `scripts`, so internal reports and the two credential-shaped maintenance scripts (`scripts/fix-layer-01-types.sh`, `scripts/resume-layer-01.sh`) enter its source list. It does not include root `LICENSE` or `NOTICE`. This conflicts with the inventory and license review. No release archive was generated in the checkout; the package-reproducibility test created and cleaned temporary archives only.

Six existing archives and their six checksum sidecars were left untouched under `release-artifacts/`, `release-candidate/`, `release-candidate-2026-11-22/`, `release-candidate-2026-11-22-runtime-config/`, `release-candidate-final/`, and `release-candidate-latest/`. Each archive contains 391–392 entries, omits `LICENSE` and `NOTICE`, and includes two report documents; none is approved as a current release artifact.

The repository remains **NOT PRODUCTION READY** and **NOT PUBLICATION READY**. Resolve the builder manifest, confirm source and asset ownership, close the Stackback notice gap, review the exact inventory, and complete blocked production/provider acceptance before any publication decision.
