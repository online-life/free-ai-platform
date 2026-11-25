# Layer 05 — Provider Management & Unified Gateway

Responsibilities:
- Provider registry.
- Adapter registry.
- Credential resolution through secret references.
- Unified request and response contracts.
- Provider health.
- Usage recording.
- Quota reservations.
- Provider disablement.

Provider secrets must be stored in Layer 01 secret infrastructure.
Never log API keys, authorization headers, or raw credentials.
Free-tier eligibility must be verified before enabling a provider.
A provider becoming paid must be disabled until policy review.
