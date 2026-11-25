# 01 — Project inventory (verified 2026-11-23)

Inventory taken from the working tree at `/opt/free-ai` (git HEAD `a47781a` holds only 8 documentation files; all code is uncommitted and was inspected in place). Nothing was deleted or reset.

## Host (measured, not taken from older reports)

| Item | Value |
|---|---|
| OS | Kali Linux (kernel 7.2.15), not Ubuntu 24.04 |
| CPU / RAM / swap | 6 cores / 15 GiB / 7.4 GiB |
| Free disk on `/` | ~82 GB |
| Node.js / pnpm | 22.23.5 / 9.12.0 |
| PostgreSQL | 18.6, shared with unrelated projects' databases |
| Sandbox tools | `/usr/bin/bwrap`, `/usr/bin/prlimit`, unprivileged user namespaces enabled |
| GPU | none used |

## Repository map

| Area | Location | Notes |
|---|---|---|
| API (modular monolith, Node `http`) | `apps/api/src/main.ts` | Hand-written router; ~70 routes |
| Database | `apps/api/prisma/schema.prisma`, 13 migrations | PostgreSQL, FORCE row-level security on tenant tables |
| Web console | `apps/web` (vanilla JS, `server.mjs`) | English/LTR, public site + authenticated workspace |
| Local Runtime | `services/ai-runtime` | Unprivileged device agent: pairing, heartbeat job pull, workspace file ops, bubblewrap sandbox, OpenCode engine (new) |
| Shared packages | `packages/{config,contracts,database,shared}` | |
| Skills registry | `skill-registry/catalog.json` | 79 skills, all `pending_review`, licence `unverified` |
| Ops scripts | `scripts/*.sh` | install, backup, restore, release package, OpenCode engine install (new) |
| Tests | `tests/**` | Vitest, `node --test`, E2E (real PostgreSQL), browser (Chromium/CDP) |

## OpenCode-related files found before this work

| File | What it was |
|---|---|
| `apps/api/src/modules/execution/runtime.schemas.ts` | Job kind enum already reserved `OPENCODE`; no validation, no handler |
| `apps/web/index.html`, `apps/web/src/main.js` | An "OpenCode" nav entry that rendered a static "unavailable" message |
| `services/ai-runtime/README.md`, `module-spec.md` | Stated OpenCode was unsupported |
| `docs/03-specifications/layer-05-provider-gateway/initial-integration-status.md` | Status row: v2.3.2 CLI verified under `/tmp` earlier; no integration |
| `docs/STATUS.md`, `docs/reports/FINAL-PRODUCTION-CLOSURE-REPORT.md` | "OpenCode not implemented" |

There was no SDK dependency, adapter, config, credential handling or test. No duplicate or parallel implementation existed. Other `.opencode` directories on the host belong to unrelated projects under `/root/Application` and were not touched.
