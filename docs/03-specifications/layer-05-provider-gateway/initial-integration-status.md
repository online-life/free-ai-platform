# Initial Provider Integration Status

Status is based on source and tests in this repository as of 2026-11-22. A
catalog entry or compatible API format is not evidence of a working integration.
No external credentials were supplied and no external or paid provider was
activated. FreeLLMAPI was exercised as a local, no-inference integration test.

Closure patch update: anonymous signup remains disabled and the browser uses
cookie-backed server sessions. The local FreeLLMAPI E2E was rerun on this tree:
container authentication and real catalog discovery passed. No inference was
requested, no external provider credentials were supplied, and paid calls were
not made. Project details now expose a chat request form which sends through
the existing central gateway, requiring privacy approval and verified-free or
self-hosted model eligibility. The form and routing policy are covered by a
source contract test; no authenticated browser execution or live inference has
yet been verified. The adapter currently rejects streaming. OpenCode remains
unintegrated.

Public UI update (2026-11-22): the supported connector identity registry now
mirrors the API's three current connector types (generic OpenAI-compatible,
local OpenAI-compatible, FreeLLMAPI). Neutral accessible marks are used because
official asset provenance was not established. Provider editing, encrypted
credential rotation, health/catalog testing, enable/disable, and model controls
are exposed in the authenticated provider screen. The project request form
offers eligible-model selection and the server revalidates the requested
model key. The public provider catalog does not reveal configured connections.
Browser route acceptance and provider identity unit coverage passed. The
authenticated provider/editor and model-selection browser flow remains
unverified; neither this UI nor the connection test proves real inference.

| Integration | Connector | Credentials | Discovery | Tested | Free/Paid |
|---|---|---|---|---|---|
| OpenAI-compatible APIs | Generic chat/completions and models adapter | Encrypted API key reference; bearer auth | `/models` endpoint | Adapter contract tests pass; no live provider test | Per-model metadata; unknown blocked from selectors |
| Google Gemini / AI Studio | Not implemented (native API format differs) | Not configured | Not available | No | Not verified |
| DeepSeek | Compatible endpoint can be configured; not provider-verified | Encrypted key supported | Generic `/models` only | No provider-specific test | Not verified |
| Groq | Compatible endpoint can be configured; not provider-verified | Encrypted key supported | Generic `/models` only | No provider-specific test | Not verified |
| Mistral AI | Compatible endpoint can be configured; not provider-verified | Encrypted key supported | Generic `/models` only | No provider-specific test | Not verified |
| Cerebras | Compatible endpoint can be configured; not provider-verified | Encrypted key supported | Generic `/models` only | No provider-specific test | Not verified |
| Together AI | Compatible endpoint can be configured; not provider-verified | Encrypted key supported | Generic `/models` only | No provider-specific test | Not verified |
| Fireworks AI | Compatible endpoint can be configured; not provider-verified | Encrypted key supported | Generic `/models` only | No provider-specific test | Not verified |
| Cloudflare Workers AI | Not implemented (account-specific API format) | Not configured | Not available | No | Not verified |
| NVIDIA NIM / Build | Compatible endpoint may work; not provider-verified | Encrypted key supported | Generic `/models` only | No provider-specific test | Not verified |
| Hugging Face | Not implemented (multiple inference APIs) | Not configured | Not available | No | Not verified |
| OpenRouter | Compatible endpoint may work; not provider-verified | Encrypted key supported | Generic `/models` only | No provider-specific test | Not verified |
| FreeLLMAPI | Named OpenAI-compatible `/v1` gateway adapter | Encrypted unified key | Authenticated account `/models` endpoint | Pinned v0.16.23 local container tested loopback-only; real auth and 325-model discovery passed through Free AI Platform. No upstream model keys or inference were used. Chat/stream/usage and lifecycle management are not tested | Individual model metadata remains disabled and UNKNOWN; never presumed free |
| Ollama | Generic local OpenAI-compatible endpoint; no Ollama-native connector | No-auth local configuration supported | OpenAI-compatible `/models` | No actual Ollama service test; generic local mock route is covered | Per-model metadata; unknown blocked from selectors |
| LM Studio | Generic local OpenAI-compatible endpoint; no LM Studio-native connector | No-auth local configuration supported | OpenAI-compatible `/models` | No actual LM Studio service test; generic local mock route is covered | Per-model metadata; unknown blocked from selectors |
| ComfyUI (image/video) | Not implemented | Not configured | Not available | No | Not verified |
| Pollinations (image/video) | Not implemented | Not configured | Not available | No | Not verified |
| Runware (image/video) | Not implemented | Not configured | Not available | No | Not verified |
| fal (image/video) | Not implemented | Not configured | Not available | No | Not verified |
| WaveSpeed (image/video) | Not implemented | Not configured | Not available | No | Not verified |
| Replicate (image/video) | Not implemented | Not configured | Not available | No | Not verified |
| Stability AI (image) | Not implemented | Not configured | Not available | No | Not verified |
| Stable Audio | Not implemented | Not configured | Not available | No | Not verified |
| OpenCode | Runtime engine (`OPENCODE`, `OPENCODE_CATALOG` jobs) running the pinned v2.3.2 CLI in the bubblewrap engine profile | No account required for free models; account login not enabled (D3) | Catalog discovered through Free AI (1 provider, 12 zero-priced models) | Real E2E 2026-11-23: discovery passed; task reached provider and got free-tier 429; one direct free inference succeeded outside Free AI | Free models classified FREE_TEMPORARY from the engine catalog; paid models blocked |
| Aider | Not implemented; coding-agent integration category required | Not configured | Not available | No | N/A |
| Cline | Not implemented; editor/agent integration category required | Not configured | Not available | No | N/A |
| Continue | Not implemented; editor/agent integration category required | Not configured | Not available | No | N/A |
| LangGraph | Not implemented; agent framework integration category required | Not configured | Not available | No | N/A |
| CrewAI | Not implemented; agent framework integration category required | Not configured | Not available | No | N/A |

## Current central controls and verified lifecycle

The platform owner can set platform-wide free, paid, local, custom-provider,
automatic-discovery, and refresh controls; tenant free/paid/local controls are
separate. Global and tenant settings intersect. Both model classes default to
disabled. Hidden and disabled model records remain stored. Paid visibility is
not spending authorization: paid spending authorization is locked off under
the accepted free-only policy. The selector does not yet expose every requested
search, capability, modality, pricing, or health filter.

Provider configuration, encrypted credential references, connection tests,
generic model discovery, per-model enablement and visibility, and model route
preview exist in the backend. A real local mock-provider E2E verified an
encrypted credential, authenticated model discovery, unknown-by-default
classification, manual verification/configuration, free-only routing, and
execution through the central router and gateway. Discovery still returns
identifiers; it does not verify capabilities, entitlement, or pricing. Those
must be configured and reviewed before enablement.

## Blockers and remaining implementation

- No external provider credentials were available for live connection tests.
- Native connectors are missing for the provider-specific APIs listed above.
- FreeLLMAPI setup/lifecycle UI, health monitoring, chat/streaming through the
  central gateway, usage/quota integration, and installation management are
  not implemented. The local real-service test covers auth and discovery only.
- OpenCode is integrated as a Runtime engine (see `docs/internal-platform-integration/`); a live successful
  coding task through Free AI is not yet verified because the free tier was rate-limited. Other
  coding-agent/framework integrations are not started.
- A separately approved paid-spending policy, budget enforcement, richer
  pricing schema, and audited classification overrides are required before any
  paid execution can be considered.
- Trusted-local endpoints are opt-in, loopback-only, and redirects are rejected.
  Production HTTP/TLS connections pin their socket lookup to the vetted DNS
  address and reject mixed public/private DNS answers. Adversarial IPv4/IPv6
  and redirect coverage remains a production-hardening follow-up.
