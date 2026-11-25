# Final Publication Readiness Report

Audit date: 2026-11-25

Authoritative checkout: `/root/Application/free-ai-platform`

Branch: `main`

Baseline and current `HEAD`: `a47781a3805801cccdaebf01d785189596c5afd6`

## Decision

**NOT PRODUCTION READY. NOT PUBLICATION READY.**

Local dependency remediation and targeted acceptance tests are complete, but this checkout must not be published yet. The release builder omits `LICENSE` and `NOTICE` while including internal documentation and credential-shaped scripts. Source and asset provenance is not fully established, existing archives are stale, and production deployment and live external-provider acceptance have not been verified.

No staging, commit, push, GitHub repository creation, release packaging, or publication was performed. The source-package reproducibility test created and cleaned temporary archives only; no release archive was created in the checkout. No Git remote is configured.

## Checkout reconciliation

The original baseline measurement recorded 7 modified tracked files and 298 untracked files. The final inventory covers the current checkout and preserved comparison snapshot. The final audit report is an untracked file in the current checkout. The previous “333 untracked files/directories” statement has no itemized inventory or reproducible command and cannot be reconciled exactly; a combined file-and-directory count is not comparable to Git's file-path count.

`FINAL-PUBLICATION-INVENTORY.csv` is the authoritative path-by-path inclusion/exclusion classification. “Include candidate” means proposed for owner review only; it is not legal clearance or publication authorization.

| Inventory measure | Count |
|---|---:|
| Unique current/preserved paths | 12,485 |
| Modified tracked / unchanged tracked | 7 / 1 |
| Untracked / ignored / preserved-snapshot-only | 305 / 12,170 / 2 |
| Include candidates | 284 |
| Excluded / credential-review pending / provenance-review pending / snapshot-reconciliation pending | 12,192 / 2 / 5 / 2 |
| Paths selected by the current source-package builder / not selected | 598 / 11,887 |

All 284 include candidates still have `third_party_material=unknown` in the inventory; they are not cleared for publication. The 5 provenance-pending exclusions are the SVG assets. The two credential-review exclusions are the scripts named below. The nine internal remediation-workspace files are explicitly inventoried and excluded.

## Dependency remediation

All four reported high-severity production advisories have patched versions in the lockfile:

| Advisory | Previously vulnerable package and dependency path | Affected range / patched floor | Current version |
|---|---|---|---|
| GHSA-mrhx-c7xc-m3w5 | Direct production `zod@3.25.76` | `<4.6.6` / `4.6.6` | `zod@4.6.7` |
| GHSA-38f7-945m-qr2g | `prisma@6.19.0` → `@prisma/config` → `effect@3.18.4` | `<3.20.0` / `3.20.0` | `effect@3.22.1` |
| GHSA-7589-6fvf-x4pw | Same Prisma config path → `effect@3.18.4` | `<=3.22.0` / `3.22.1` | `effect@3.22.1` |
| GHSA-ggr8-5vv4-36mx | `prisma@6.19.0` → `@prisma/config` → `deepmerge-ts@7.1.5` | `<8.0.0` / `8.0.0` | `deepmerge-ts@8.0.2` |

`prisma` and `@prisma/client` were upgraded together to `6.19.3`; pnpm regenerated the lockfile. Scoped config overrides address only the affected transitive dependencies. Prisma 7 was not selected because it would require a larger ESM/generator/driver-adapter migration. The current Prisma config path does not use the Map merge behavior changed in deepmerge-ts v8; an untested config edge case remains a compatibility risk.

Fresh command: `pnpm audit --prod --audit-level=high` — **exit 0**, no known vulnerabilities in the production dependency tree. This does not claim that every dev dependency or all classes of security risk are clean.

## Verification and acceptance evidence

| Command or suite | Result |
|---|---|
| `pnpm prisma:validate` and `pnpm prisma:generate` with a placeholder local `DATABASE_URL` | Exit 0; no real database contacted |
| `pnpm typecheck && pnpm web:typecheck && pnpm api:build && pnpm web:build` | Exit 0 |
| `pnpm exec vitest run` | 18 files; 124 passed |
| `node --test tests/security/layer-01/*.test.mjs tests/unit/layer-01/*.test.mjs tests/web/server-startup.test.mjs` | Exit 0; 9 passed; two existing `MODULE_TYPELESS_PACKAGE_JSON` warnings; package-reproducibility case created/cleaned temporary archives |
| `pnpm test:layer-01` | 3 files; 31 passed; overlaps the larger Vitest run |
| `DATABASE_URL="$APP_DATABASE_URL" node --test tests/e2e/api-project-flow.test.cjs tests/e2e/api-error-contract.test.cjs tests/e2e/auth-session-flow.test.cjs tests/e2e/runtime-workspace-flow.test.cjs tests/e2e/process-sandbox.test.mjs` | Exit 0; 5 passed |
| `DATABASE_URL="$OPS_DATABASE_URL" node --test tests/e2e/operations-install-backup-restore.test.mjs` | Exit 0; 1 passed |
| `python3 .superpowers/sdd/2026-11-25-free-ai-publication-remediation/verify-task-1.py` | Exit 0; complete inventory coverage |
| `git diff --check` | Exit 0 |

PostgreSQL 18.6 was used only on three newly created disposable local databases. Each received all 13 migrations using these commands, each with exit 0:

```sh
DATABASE_URL="$APP_DATABASE_URL" pnpm prisma:migrate:deploy
DATABASE_URL="$OPS_DATABASE_URL" pnpm prisma:migrate:deploy
DATABASE_URL="$FINAL_DATABASE_URL" pnpm prisma:migrate:deploy
```

Application E2E used non-superuser/non-BYPASSRLS roles; the separate operations E2E used a non-superuser `BYPASSRLS` role as documented. The two E2E groups were run separately because one shared `DATABASE_URL` cannot satisfy both role requirements. The final selected runs had zero skipped tests.

A local mocked provider path passed within project E2E. No live external provider credentials were available or used; live provider execution was not run. Production deployment, TLS/reverse-proxy operation, and authenticated full-browser administration acceptance remain unverified.

Two exploratory E2E attempts failed before the final clean runs: one due to `/root` traversal permissions for the test UID, another because an auth bootstrap test reused an already-bootstrapped database. The temporary traversal ACL was removed. These failures were not counted as passes or skipped tests. Their exact shell strings and numeric statuses were not preserved in the task ledger.

After testing, only the three task-created databases and their roles were dropped; catalog verification showed none remaining. The private temporary credential file was removed without printing its values.

## Implementation and documented capability

The current checkout contains authentication, tenant/project APIs, central provider routing, Runtime management and job dispatch, and process sandbox support. Dedicated OpenCode and FreeLLMAPI integrations are absent; remaining OpenCode references are explanatory text, not working integrations. Do not claim a successful live external-provider run.

## License and provenance review

- `LICENSE`, package manifests, and `NOTICE` retain Apache-2.0 and `Copyright 2026 Mr. Joe`. The owner and license were not changed.
- Installed package metadata lists 87 distinct package names / 90 version instances: 72 MIT, 10 Apache-2.0, 2 BSD-3-Clause, 1 BSD-2-Clause, and 2 ISC package names. No package was missing declared license metadata.
- Four installed packages have no adjacent license text: `stackback@0.0.2`, `@esbuild/linux-x64@0.28.2`, `@rollup/rollup-linux-x64-gnu@4.68.7`, and `@rollup/rollup-linux-x64-musl@4.68.7`. The esbuild and Rollup upstream MIT license texts were verified. Stackback declares MIT in metadata but has no upstream license file; keep its notice-text gap unresolved. Installed dependencies are excluded from the source archive.
- No font binaries or bundled icon library were found. Exclude these five SVG assets pending provenance confirmation: `apps/web/assets/free-ai-platform-app-icon.svg`, `apps/web/assets/free-ai-platform-favicon.svg`, `apps/web/assets/free-ai-platform-logo-dark.svg`, `apps/web/assets/free-ai-platform-logo-light.svg`, and `apps/web/assets/free-ai-platform-symbol.svg`.
- Exclude `skill-registry/`: all 79 catalog records remain license-unverified and security-review-pending.
- Exclude `scripts/fix-layer-01-types.sh` and `scripts/resume-layer-01.sh` pending review; each contains a credential-shaped loopback database URL. Values are withheld from reports.
- The untracked source tree has no complete provenance history in Git. Its presence in the inventory does not by itself prove authorship or grant rights.

`NOTICE` clarifies that the source builder does not bundle installed dependencies and that a distribution that does include dependency code/assets must carry the applicable notices.

## Publication inclusion and exclusion

The full exact path list, Git/snapshot state, proposed status, rationale, internal/generated/sensitive/third-party flags, and builder-inclusion result are in [`FINAL-PUBLICATION-INVENTORY.csv`](FINAL-PUBLICATION-INVENTORY.csv). Proposed application, test, configuration, and documentation paths remain candidates pending owner/provenance review—not approved files.

Exclude internal reports and work products, the `.superpowers/sdd/2026-11-25-free-ai-publication-remediation/` task workspace, generated caches/dependency trees, backup and candidate directories, all existing release archives and sidecars, the skill registry, the five SVG assets pending provenance, and the two credential-shaped scripts. Preserve all of these locally; no cleanup or deletion was performed.

The source builder `scripts/build-release-package.sh` selects `docs` and `scripts` wholesale, causing excluded/internal report content and the two credential-shaped scripts to be packaged, while omitting root `LICENSE` and `NOTICE`. It conflicts with the reviewed classification and must be corrected and tested before any release package is built.

Six existing archives and six SHA-256 sidecars were preserved, untouched:

- `release-artifacts/free-ai-platform-0.1.0.tar.gz`
- `release-candidate/free-ai-platform-0.1.0.tar.gz`
- `release-candidate-2026-11-22/free-ai-platform-0.1.0.tar.gz`
- `release-candidate-2026-11-22-runtime-config/free-ai-platform-0.1.0.tar.gz`
- `release-candidate-final/free-ai-platform-0.1.0.tar.gz`
- `release-candidate-latest/free-ai-platform-0.1.0.tar.gz`

Each archive contains 391–392 entries, lacks `LICENSE` and `NOTICE`, and includes two report documents. None is a verified current release.

## Owner review required

Before any public release, the owner must review the exact inventory, confirm source and SVG ownership, resolve Stackback notice text, confirm the public/security reporting channels, and approve a corrected release manifest that includes required license files and excludes internal/sensitive content. Live-provider and production deployment acceptance must also be completed. Until then, publication remains unauthorized and this repository remains **NOT PRODUCTION READY**.
