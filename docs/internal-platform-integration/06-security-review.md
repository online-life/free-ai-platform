# 06 — Security review: OpenCode integration

| Control | Implementation | Evidence |
|---|---|---|
| Tenant isolation | Jobs, devices, workspaces and status are tenant-scoped in the API. Another tenant sees no device and cannot queue on it. | `opencode-engine-flow` E2E |
| User authorization | `execution.submit` permission plus project membership plus a device→project grant | Existing E2E and the new E2E |
| Workspace isolation | Only the bound workspace is writable. Server and local permissions are intersected. Edits need write; the engine needs execute. | E2E; `parseTaskInput` unit tests |
| Engine policy cannot be weakened by repo content | `OPENCODE_DISABLE_PROJECT_CONFIG=1`; Free AI rules appended last | `opencode debug agents` inspection; unit test on config |
| Secret files | `read` denied for `*.env`, `*.env.*`, `*.pem`, `*.key`, `**/.ssh/**`, engine home. The host home is not mounted. | E2E: planted `.env` value absent from job result and Runtime logs |
| Credential exposure | No OpenCode credentials exist (no login). `/api/credential` is never called. The status API returns no settings. | E2E asserts no `apiKey`/`secret` in the status response; browser test asserts no `apiKey`/`baseURL` rendered |
| Process isolation | New user, PID, IPC and UTS namespaces; `--die-with-parent`; new session; process-group kill on cancel or timeout | E2E: no OpenCode process remains after cancel |
| Resource limits | prlimit: address space 8 GiB, CPU = timeout (≤ 1800 s), nproc 1024, nofile 1024, fsize 100 MiB, no core dumps. Wall timeout 10–1800 s. Output ≤ 16 MiB. Concurrency 1 by default. | Code review; sandbox E2E |
| Shell commands | Denied unless the user both allows them and approves them; the API rejects without approval. When allowed, commands run inside the same sandbox. | E2E (`OPENCODE_SHELL_APPROVAL_REQUIRED`) |
| Paid usage | API blocks non-free models. The Runtime re-checks the live catalog. Any non-zero reported cost fails the job. There is no fallback path in code. | Unit tests; E2E with the real 429 |
| Binary integrity | SHA-256 pinned; must be root-owned and not group- or world-writable | `loadOpenCodeEngineConfig` |
| Output redaction | Common key and token shapes and private keys are redacted from text, titles and stderr | Unit test |
| Audit | Each OPENCODE run records a workspace `EXECUTE` audit entry (`APPROVED_WITH_SHELL`/`APPROVED_NO_SHELL`); Runtime logs record job lifecycle | Code; E2E logs |

## Residual risks (accepted for this phase, documented)

1. **Outbound network is open inside the engine sandbox.** Inference needs it. If a user approves shell commands, those commands can reach the network too. Read access is limited to the workspace, the engine home is read-denied by policy, and there are no credentials to steal. A domain-restricted egress proxy is the next hardening step.
2. **Engine home retention.** OpenCode keeps its session database, including prompts and outputs, in the per-workspace engine home. There is no automatic purge yet.
3. **Provider data handling.** Prompts and workspace content that OpenCode reads are sent to OpenCode's free-tier providers. Retention varies per model per OpenCode's docs. Users must not run the engine on confidential code without accepting this.
4. **Deviation from CLAUDE.md rules 8–9.** The engine calls its provider directly instead of through the Free AI gateway, as the OpenCode directive explicitly requires for free-tier models. Recorded as decision D2 in 08.
5. **No seccomp filter or cgroup accounting** in the sandbox (pre-existing).
