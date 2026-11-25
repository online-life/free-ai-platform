# 08 — Decisions and known limitations

## Decisions

**D1. Official CLI instead of the in-process SDK.** `@opencode/sdk@2.3.2` cannot load on Node.js 22.23.5 because its dependencies use `await using`. Changing the project or global Node version was not authorized. The CLI is the directive's sanctioned fallback. Revisit when the project moves to Node ≥ 24: the SDK would remove the per-call process start (about 1–2 s per catalog call).

**D2. OpenCode calls its free-tier provider directly.** CLAUDE.md rules 8–9 say agents must not call model providers directly and must go through the Free AI gateway. OpenCode's free models only work through OpenCode itself, and the OpenCode directive (section 5.4) explicitly requires running them through the OpenCode runtime. This is a scoped exception for the OpenCode engine only. It is bounded by free-first enforcement in three places (API, Runtime live catalog, per-run cost) and by the `provider.use` policy. **Confirm or reject this exception.**

**D3. OpenCode account login is not enabled.** It was verified that:

1. Free models need no account.
2. Every model an account login unlocks (Console credits, Go, Copilot or ChatGPT subscriptions) is paid or subscription-based, which the free-first policy disables anyway.
3. Login would store OAuth tokens or API keys in OpenCode's SQLite database on the Runtime host. That contradicts the approved Runtime spec ("The Runtime … stores no provider credentials").

Enabling login therefore needs an explicit decision. Either the Runtime may hold per-workspace engine credentials (encrypted at rest, a revocation flow, approved paid-spend policy), or credentials are stored in the API vault and injected per job. Until then the UI states this plainly and shows connected integrations as "none".

**D4. Classification.** `FREE_TEMPORARY` is used for zero-priced `opencode/*` models, because OpenCode documents them as limited-time. `FREE_VERIFIED` is used only after a real successful zero-cost task with that model in the tenant. Anything priced, unpriced, from another provider or inactive is never runnable.

**D5. No automatic fallback.** If the chosen free model fails, the job fails with the provider's reason. The UI lists the other free models for the user to choose from. Note that OpenCode's free limit is per host, so switching to another free model does not help when the limit is reached.

## Known limitations

- **The OpenCode free tier is not unlimited.** On this host it was exhausted after a single test call, and every free model returned 429 with a ~23.5 h reset.
- **A live successful coding task through Free AI has not been observed** (see 07).
- Engine output is relayed by polling: the Runtime reports about every 1.5 s and the UI polls every 2 s. This is not a push stream.
- Each catalog sync starts four short engine processes, which is slow (~5–8 s) but bounded.
- Engine sessions are not resumed across jobs; each job is a new archived session.
- No orchestrator chooses the engine automatically. The user picks OpenCode explicitly.
- The other nine platforms were not started, as instructed. Moving to the next platform requires approval of this phase.
