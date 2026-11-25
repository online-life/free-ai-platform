# 05 — OpenCode integration: what was verified and how to operate it

## Verified facts about OpenCode (2026-11-23)

| Fact | How verified |
|---|---|
| `@opencode/sdk`, `@opencode/cli` 2.3.2: MIT, `github.com/anomalyco/opencode`, maintainer `thdxr`, npm SLSA provenance | `npm view` |
| No install scripts in the SDK, server or core packages | Package manifests inspected |
| SDK does not load on Node 22.23.5 (`await using`) | Reproduced in an isolated scratch install |
| CLI binary `@opencode/cli-linux-x64@2.3.2`, SHA-256 `e6543f6e…f27ad`, reports `opencode v2.3.2` | `install-opencode-engine.sh` |
| Without any login: one provider `opencode`, 12 models, all priced 0/0 | `opencode api GET /api/model --standalone` |
| Free models are documented as "free on OpenCode for a limited time" and "require OpenCode" | opencode.ai/docs/zen |
| A real free inference succeeded (`opencode/big-pickle` → "PONG", `cost: 0`, 456/4 tokens) | Captured in `tests/fixtures/opencode/run-success-big-pickle.jsonl` |
| Free tier is rate-limited per host: HTTP 429 `FreeUsageLimitError`, `retryAfterMs` ≈ 84,490,000 (~23.5 h), same for every free model | Captured in `tests/fixtures/opencode/run-free-limit-429.jsonl` |
| Account login (`opencode auth login`) stores credentials in the engine's SQLite DB under `XDG_DATA_HOME`; OAuth/device flows exist for GitHub Copilot and ChatGPT | Official docs, CLI help |

## Operate

On the Runtime host, as root:

```
scripts/install-opencode-engine.sh            # → /opt/free-ai-engines/opencode/2.3.2/opencode
```

Start the Runtime as its unprivileged user with the existing variables plus:

```
FREEAI_OPENCODE_BIN=/opt/free-ai-engines/opencode/2.3.2/opencode
FREEAI_OPENCODE_SHA256=e6543f6e5c39c40971ba38afd1819ac852c29ac735b5a89065d3d148d47f27ad
FREEAI_OPENCODE_HOME=/home/<runtime-user>/.local/share/free-ai/opencode   # created 0700
FREEAI_OPENCODE_MAX_CONCURRENCY=1                                         # 1–4
```

The Runtime refuses to enable the engine if the binary is writable by the Runtime user, owned by it, or does not match the checksum. On success it logs `OPENCODE_ENGINE_ENABLED`. The workspace binding must allow `execute`, which the API also enforces. Then, in the web console under **OpenCode**: **Sync engine catalog** → pick workspace and free model → **Run with OpenCode**.

## Not done in this phase (see 08)

- OpenCode account login from Free AI (decision D3, requires approval).
- Use of the in-process SDK (blocked by Node 22).
- Any second platform.
