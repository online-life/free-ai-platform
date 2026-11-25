# Security Threat Model

## Assets
- User identities and sessions.
- Project data and memory.
- Source code and artifacts.
- Secrets and credentials.
- Agent instructions and tools.
- Execution infrastructure.
- Audit records.

## Threats
- Cross-project data leakage.
- Prompt injection and instruction manipulation.
- Unauthorized tool execution.
- Malicious dependencies.
- Container escape.
- Secret disclosure.
- Privilege escalation.
- Supply-chain compromise.
- Denial of service.
- Audit tampering.

## Mandatory controls
- Least privilege.
- Explicit project authorization.
- Input and output validation.
- Secret isolation and redaction.
- Sandboxed execution.
- Network deny-by-default.
- Resource limits.
- Dependency and image provenance checks.
- Immutable or tamper-evident audit strategy.
- Security tests for every trust boundary.

## Root host warning
The development host currently uses root. This does not authorize workloads
or agents to run as unrestricted root. Untrusted workloads must use a
separate restricted execution boundary.

## Incident handling
Document detection, containment, credential rotation, recovery, evidence
preservation and post-incident review before production use.
