# 04 — Integration architecture

```
Browser ──REST (cookie+CSRF)──▶ API (control plane) ──PostgreSQL (RLS)
                                  ▲   │ owns users, tenants, projects, workspaces,
                                  │   │ jobs, model classification, audit
               heartbeat / report │   ▼ queued RuntimeJob {kind: OPENCODE | OPENCODE_CATALOG}
                         Local Runtime (unprivileged UID, paired device)
                                  │ workspace binding + permission intersection
                                  ▼
                bubblewrap "engine" profile (per job)
                  /usr ro, /etc/{resolv.conf,ssl,ca-certificates,hosts,nsswitch.conf} ro
                  /tool = pinned OpenCode binary (ro)
                  /workspace = bound project workspace (rw)
                  /home/engine = private per-workspace engine home (rw, 0700)
                  new user/pid/ipc/uts namespaces, cleared env, prlimit
                  network: shared (inference requires outbound HTTPS)
                                  │
                                  ▼
                       opencode run --standalone --format json -m <free model>
                                  │ HTTPS
                                  ▼
                       OpenCode free-tier inference (opencode.ai)
```

## Ownership

| Concern | Owner |
|---|---|
| Users, tenants, projects, workspaces, permissions, tasks, audit, UI | Free AI. There is no second store. |
| Which model may run (free-first) | Free AI API, from the engine catalog, plus a live re-check on the Runtime |
| Engine session, tool loop, file edits inside the workspace | OpenCode, inside the sandbox |
| OpenCode state (sessions SQLite) | Private engine home per workspace binding on the Runtime host |

OpenCode session IDs are stored only as `result.engineSessionId` on the Free AI job, linked to the Free AI tenant, project, workspace, device, requesting user and model. They never replace Free AI identifiers.

## Why the CLI rather than the in-process SDK

`@opencode/sdk@2.3.2` (`OpenCode.create()`) is the preferred route, but it does not load on the project's Node.js 22.23.5. Its dependencies use `await using`, which Node 22 cannot parse, even with `--js-explicit-resource-management` (reproduced: `SyntaxError: Unexpected identifier '_'` in `@opencode/util/dist/flock.js`). Upgrading Node is out of scope without approval. The directive's sanctioned fallback is the official CLI. Each job runs one short-lived `opencode run --standalone` process. It opens no HTTP listener, and Free AI controls its lifetime, working directory, configuration and cancellation.

## Policy injection

Every engine process receives:

- `OPENCODE_CONFIG_CONTENT`. Permission rules are appended after OpenCode's agent defaults; later rules win, which was verified with `opencode debug agents`. The rules deny `external_directory`, `webfetch`, `websearch`, `browser`, `question`, `subagent` and `skill`. They deny `shell` unless the job is approved. They allow `edit` only with workspace write permission. They deny reading `*.env`, `*.pem`, `*.key`, `**/.ssh/**` and `/home/engine/**`. The `policies` key denies `provider.use` except `opencode`, and denies `mcp.use`, `plugin.use`, `skill.use`, `websearch.use` and `integration.connect`. Sharing and update checks are disabled.
- `OPENCODE_DISABLE_PROJECT_CONFIG=1`, so a workspace's own `opencode.json` cannot loosen the policy. Also `OPENCODE_DISABLE_CLAUDE_CODE=1` and `OPENCODE_DISABLE_AUTOUPDATE=1`.

## Job kinds

| Kind | Requires | Does |
|---|---|---|
| `OPENCODE_CATALOG` | workspace read | `--version`, `api GET /api/model`, `/api/provider`, `/api/integration` (never `/api/credential`, which returns secrets) |
| `OPENCODE` | read + execute, plus write if edits are allowed, plus `approved` if shell is allowed, plus a free model in the latest catalog | Live free re-check → workspace snapshot → `opencode run` → events relayed as progress → result with session ID, final text, files created/modified/deleted, cost and tokens, last 200 events, redacted stderr tail |

Failure codes include `OPENCODE_FREE_LIMIT_REACHED`, `OPENCODE_PROVIDER_ERROR`, `OPENCODE_MODEL_NOT_FREE`, `OPENCODE_MODEL_NOT_AVAILABLE`, `OPENCODE_TIMEOUT`, `OPENCODE_UNEXPECTED_COST` and `RUNTIME_JOB_CANCELLED`.

## Files

| File | Role |
|---|---|
| `services/ai-runtime/src/opencode-engine.ts` | Engine: binary verification, policy, catalog, task run, events, snapshot diff, redaction, concurrency limit |
| `services/ai-runtime/src/process-sandbox.ts` | `engine` profile added to the existing sandbox |
| `services/ai-runtime/src/workspace-handlers.ts`, `runtime-entry.ts`, `runtime-client.ts` | Handler registration, progress callback |
| `apps/api/src/modules/engines/opencode-catalog.ts` | Central classification and free-first selection |
| `apps/api/src/modules/execution/runtime-management.service.ts` | Enqueue validation, progress storage, `openCodeStatus` |
| `apps/api/src/main.ts` | `GET /api/v1/integrations/opencode`, error codes |
| `apps/web/src/main.js` | OpenCode page |
| `scripts/install-opencode-engine.sh` | Pinned, checksum-verified engine install |
