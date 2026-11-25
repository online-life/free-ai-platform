# 02 — Internal engines audit

Status values: **Complete and tested**, **Implemented but not integrated**, **Integrated but not tested**, **Partially implemented**, **Missing**, **Blocked**, **Requires approval**. "Tested" means a test that actually runs in this repository passed on 2026-11-23. The evidence lists the test.

A file or class existing was not counted as evidence. Reachability from `main.ts` was checked with a static import-graph scan.

| Engine | Status | Evidence / gap |
|---|---|---|
| A. Core platform: tenants, users, roles, sessions, projects | Complete and tested | `auth-session-flow`, `api-project-flow`, `api-error-contract` E2E under a non-superuser, non-BYPASSRLS role. Two RLS defects were fixed earlier the same day (migration 0013). |
| B. Agent orchestration | Partially implemented | Agent registry, versions, evaluations and capability selection are wired. There is no request→plan→engine dispatch loop. OpenCode is selected explicitly by the user, not by an orchestrator. |
| C. Model registry | Partially implemented | Provider-gateway models: tested with mocks only. OpenCode models: discovered from the engine catalog and classified centrally (tested, real engine). |
| D. Provider management | Partially implemented | OpenAI-compatible/local/FreeLLMAPI connectors with encrypted credentials and an SSRF guard (mock-tested). No live inference through the gateway. |
| E. Execution engine | Integrated, tested for Runtime jobs | Runtime jobs: idempotency key, claim, progress, cancel, result, error code. `execution.service.ts`, `execution-policy.service.ts` and `tool-registry.service.ts` are **implemented but not integrated** (no route). |
| F. Local Runtime and sandbox | Complete and tested | `runtime-workspace-flow`, `process-sandbox`, `opencode-engine-flow` E2E. New `engine` profile added (see 04). No seccomp filter and no cgroup accounting. |
| G. Tools and skills | Partially implemented | Tool registry is in-memory and unreachable. 79 skills are unreviewed. Nothing executes skills. OpenCode's own skills, MCP and plugins are denied by policy. |
| H. Project context and knowledge | Implemented but not integrated | `project-context`, `project-files`, `project-activity`, `intake`, `requirements` services have no routes. |
| I. Workflow and scheduling | Partially implemented | Definitions, runs, approvals and resume are routed. `workflow-scheduler` and `workflow-observability` are not wired. |
| J. Usage, billing, quota | Partially implemented | `provider-quota.service` is not wired. OpenCode jobs record per-task cost and tokens from engine events and refuse non-zero cost. There is no tenant-level budget. |
| K. Security and audit | Complete and tested for auth/RLS/CSRF | Audit log, CSRF+Origin, rate limiting (in-memory, single process), log sanitization for 5xx. OAuth state: not applicable (no OAuth flow is enabled). |
| L. Monitoring and reliability | Partially implemented | `/health` checks the DB. Structured stderr for 5xx. Runtime heartbeat and online state. No metrics, alerting or error tracking. |

## Closed in this phase because they blocked OpenCode

1. The Runtime had no `OPENCODE` handler, even though the API accepted the kind. Added.
2. The API did not validate `OPENCODE` payloads at all, so any JSON would have been queued. Strict schema, permission and free-first checks added.
3. The sandbox could not host a long-running, networked engine. An explicit `engine` profile was added; the default `tool` profile is unchanged.
4. Jobs could report only a final result, so live progress was impossible. `RUNNING` reports now carry interim `progress`.
5. There was no engine catalog or model classification. `OPENCODE_CATALOG` job and central classifier added.

## Left as documented gaps (they do not block OpenCode)

Unwired modules in rows B, E, G, H, I, J and L. A tenant budget engine. An orchestrator that picks an engine automatically.
