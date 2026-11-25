# ADR-0002: Defer AI Provider Selection

Status: Accepted

Decision:
Do not select, download or activate AI models or providers during foundation
preparation.

Reason:
Provider selection requires task benchmarks, license verification, pricing
and quota verification, privacy review and gateway contracts.

Consequences:
The platform must use provider-neutral interfaces.
No API keys or model weights are required for foundation preparation.
