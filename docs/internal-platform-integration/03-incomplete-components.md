# 03 — Incomplete components

| Component | Current state | Gap | Priority | Action taken | Test result |
|---|---|---|---|---|---|
| OpenCode Runtime handler | Missing | Reserved kind had no handler | P0 | Implemented `OPENCODE`, `OPENCODE_CATALOG` | `opencode-engine-flow` E2E pass |
| OpenCode payload validation | Missing | Arbitrary payload accepted | P0 | Strict schema, permissions, shell approval, free-first | E2E + unit pass |
| Engine sandbox profile | Missing | Tool profile: no network, 5 min max, nproc 64 | P0 | `engine` profile (network opt-in, 30 min, private home) | E2E pass; existing sandbox E2E still passes |
| Job progress relay | Missing | Final result only | P1 | `RUNNING` + `progress` | E2E pass (browser shows live status) |
| OpenCode UI | Static placeholder | No function | P1 | Status, models, free filter, task run, cancel | `opencode-browser` test pass |
| OpenCode account login | Requires approval | See 08, decision D3 | — | Not enabled | Not tested |
| Live successful coding task | Blocked | OpenCode free-tier limit on this host (HTTP 429) | P0 | Failure path verified for real; success path verified with real captured events | See 07 |
| Orchestrator auto-selection of engine | Partially implemented | User selects engine and model explicitly | P2 | None | — |
| Execution service / tool registry / execution policy | Implemented but not integrated | No route | P2 | None (independent of OpenCode) | — |
| Workflow scheduler, provider quota, project context/files/activity, settings | Implemented but not integrated | No route | P2 | None | — |
| Tenant budget / cost limits | Missing | Only per-task zero-cost enforcement | P2 | None | — |
| Sandbox seccomp / cgroups | Missing | prlimit only | P2 | None | — |
| Metrics / alerting | Missing | | P2 | None | — |
| zod 3.25.76 advisory | Requires approval | Major upgrade | P1 | None | `pnpm audit` 4 high |
