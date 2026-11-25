# Layer 06 — Execution Engine

Responsibilities:
- Execution request validation.
- Project authorization.
- Tool registry.
- Sandbox interface.
- Resource policy enforcement.
- Cancellation.
- Artifact metadata.

Security requirements:
- Never execute untrusted code on the host.
- Never execute user code as root.
- No unrestricted host filesystem access.
- Network access disabled by default.
- Apply CPU, memory and timeout limits.
- Require approval for sensitive tools.
- Use isolated containers or dedicated sandbox infrastructure.
- Persist execution state and audit events.
