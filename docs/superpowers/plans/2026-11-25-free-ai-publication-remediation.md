# Free AI Publication Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remediate the four high production dependency advisories, establish a complete local publication and license inventory, and document verified acceptance evidence without publishing the repository.

**Architecture:** Keep the existing Modular Monolith, package manager, and authoritative checkout. Prefer compatible patch-level Prisma updates plus only necessary transitive overrides, and upgrade Zod to a patched v4 release because no patched v3 version is identified. Verify behavior through existing checks and genuinely isolated PostgreSQL E2E runs; treat unavailable provider credentials or infrastructure as blocked, not passed.

**Tech Stack:** Node.js 22, pnpm 9.12.0, TypeScript, Prisma, Zod, PostgreSQL, Vitest, Node test runner.

**Spec:** Owner-approved in-place design and safeguards in the 2026-11-25 task/conversation. No separate product specification is being introduced.

## Global Constraints

- Work only in `/root/Application/free-ai-platform`; do not create another checkout or repository copy.
- Preserve existing user work, backups, candidate directories, internal files, and release artifacts.
- Do not stage, commit, push, create a GitHub repository, or publish.
- Do not run database operations against real or production databases; use only newly created disposable local test databases.
- Do not expose secrets in logs, output, or reports.
- Keep `pnpm-lock.yaml` reproducible by using pnpm, not manual lockfile edits.
- Do not skip, weaken, or rewrite tests to obtain passing results.
- Report failed, skipped, blocked, and not-implemented checks separately; do not claim production readiness without evidence.

## Review Focus

- Prisma transitive overrides must be compatible with the pinned Prisma 6 CLI/client; prove with Prisma validation/generation, build, and the complete advisory audit.
- Zod 4 changes can alter schema inference/validation; specifically exercise existing strict objects, records, refinements, and API error contracts with type checks and tests.
- PostgreSQL E2E must use the documented non-superuser, non-BYPASSRLS application role where required; identify and report any suite that cannot run safely.
- Backup/restore and migration tests may create/drop databases; inspect their cleanup targets and ensure all targets are newly created disposable databases before execution.
- Publication decisions must not include secrets, backup/candidate/internal/generated material, or third-party assets with unverified provenance; record exact candidate paths and reasons.

---

### Task 1: Capture authoritative checkout and publication inventory

**Files:**
- Create: `docs/reports/FINAL-PUBLICATION-INVENTORY.csv`
- Read: Git status, ignore rules, release-package inclusion rules, existing reports, repository file tree

**Interfaces:**
- Produces a path-level inventory with columns for exact relative path, Git state, file category, publication decision, reason, and internal/generated/sensitive/third-party flags.
- All source paths are relative to the authoritative repository root. Do not store file contents or secret values in the inventory.

- [ ] Record baseline commit, current branch, tracked modifications, untracked files/directories, ignored paths, and exact counts; reconcile why the prior “333 untracked items” differs from current Git file/path counts.
- [ ] Inventory tracked, modified, untracked, ignored, generated, backup, candidate, and release paths. Classify every file eligible for publication as include or exclude with a path-specific reason; explicitly exclude internal and generated payloads.
- [ ] Compare candidates against `scripts/build-release-package.sh` and `.gitignore`; flag any path included by the archive builder that conflicts with the approved publication classification.
- [ ] Review the inventory for missing paths, accidental content disclosure, and unclassified candidate files before using it in the final reports.

### Task 2: Remediate production dependency advisories

**Files:**
- Modify: `package.json`
- Regenerate: `pnpm-lock.yaml`
- Read: current Zod schema consumers, Prisma 6.19.3 and `@prisma/config` dependency metadata, official migration guidance, package release notes

**Interfaces:**
- Preserve the existing package manager (`pnpm@9.12.0`) and Prisma 6 line unless compatibility evidence requires another choice.
- Ensure all direct and transitive resolved versions are at or above the patched floors: `effect >=3.22.1`, `deepmerge-ts >=8.0.0`, and `zod >=4.6.6`.

- [ ] Confirm the Prisma patch/transitive dependency combination and Zod v4 migration implications before editing; do not assume Prisma 6.19.3 alone resolves all findings.
- [ ] Upgrade `prisma` and `@prisma/client` together to the smallest compatible Prisma 6 patch, and use the minimum necessary pnpm overrides only if the resulting tree otherwise retains affected transitive versions.
- [ ] Upgrade direct `zod` to a patched v4 release and make only compatibility fixes required by compiler/tests; do not relax validation or remove tests.
- [ ] Regenerate the lockfile with pnpm and inspect the manifest/lock diff for unrelated upgrades, unexpected sources, or install scripts.
- [ ] Run a fresh `pnpm audit --prod --audit-level=high`; record exact advisories, paths, versions, command exit status, and whether all four are cleared.
- [ ] Run Prisma validation/generation, API and web type checks/builds, Vitest, security/unit/web Node tests, and focused compatibility tests. Record exact pass/fail counts.

### Task 3: Run isolated database integration and acceptance tests

**Files:**
- Read: all `tests/e2e/*`, `scripts/run-e2e.mjs`, Prisma migrations, database scripts, E2E configuration
- Modify only if required to safely isolate tests: relevant test harness/configuration and focused regression tests

**Interfaces:**
- Every test database must be newly created for this run with an explicit disposable name and connection.
- Use a non-superuser, non-BYPASSRLS application role for application E2E; use the documented backup role only for backup/restore coverage.
- Never reuse the shell's ambient `DATABASE_URL`; none was configured during reconnaissance.

- [ ] Inspect each E2E suite's database creation, migration, and cleanup logic; verify it cannot target an existing database before running it.
- [ ] Provision isolated local test databases and roles only after validating their names and privilege boundaries; apply migrations there and record each command's exit status.
- [ ] Run auth, authorization/tenant isolation, project API, Runtime dispatch/workspace, process sandbox, web startup, and operations backup/restore suites where safe local prerequisites exist.
- [ ] Run provider execution only if safe local infrastructure and approved credentials are already available; otherwise report it as blocked/not run and do not activate or download providers.
- [ ] Report executed/passed/failed/skipped/blocked/not-implemented counts separately; do not count skipped tests as passed.

### Task 4: Complete third-party license and attribution review

**Files:**
- Read: all package manifests and lockfile entries, vendored/copied assets, fonts, icons, generated content, skill registry, `LICENSE`, `NOTICE`, package/archive contents
- Modify only if evidence shows the existing NOTICE or attribution is inaccurate; do not change owner or license without approval

**Interfaces:**
- Produce evidence-backed license and provenance findings for direct/transitive packages and included non-code assets.
- Unestablished ownership/license remains explicitly unresolved and excluded from publication candidates.

- [ ] Enumerate direct/transitive packages and retrieve license metadata/notices from the installed package tree or authoritative package sources; identify missing or conflicting data.
- [ ] Inspect project assets and generated/copied content for provenance and attribution; do not infer ownership from a filename or visual style.
- [ ] Compare Apache-2.0 attribution and `NOTICE` against verified project and third-party notices; retain `Copyright 2026 Mr. Joe` unless the owner authorizes a change.
- [ ] Record exact paths with unknown ownership/licensing, third-party notices needed, and publication exclusions.

### Task 5: Reconcile reports and verify claims

**Files:**
- Create: `docs/reports/FINAL-AUDIT-REPORT.md` (currently absent)
- Modify: `docs/reports/FINAL-PUBLICATION-READINESS-REPORT.md`
- Modify: `docs/STATUS.md`
- Reference: `docs/reports/FINAL-PUBLICATION-INVENTORY.csv`

**Interfaces:**
- Reports state the audit date, baseline and checkout state, exact commands/statuses, advisory IDs and dependency paths, test counts/classifications, inventory artifact, license findings, and unresolved risks.
- Historical reports remain historical; do not silently reuse their test evidence as current results.

- [ ] Verify every dependency, implementation, publication, license, and readiness claim against the final checkout or current test output.
- [ ] Document any unresolved advisory, test failure/blocker, unverified license, or file-classification discrepancy plainly.
- [ ] Ensure reports state NOT PRODUCTION READY unless all relevant acceptance evidence supports a different conclusion.
- [ ] Run `git diff --check`, review only files changed for this task, and confirm no stage/commit/push/publication occurred.
- [ ] Stop after local verification and present the owner review summary; wait for explicit authorization before any publication action.
