# Security Threat Model

## Assets
- Identity and sessions.
- Project data and memory.
- Files and artifacts.
- Agent instructions and tools.
- Credentials and secret references.
- Execution infrastructure.
- Audit records.

## Threats
- Cross-project data leakage.
- Prompt injection.
- Unauthorized tool execution.
- Malicious dependencies.
- Container escape.
- Secret disclosure.
- Privilege escalation.
- Supply-chain compromise.
- Denial of service.
- Audit tampering.

## Controls
- Least privilege.
- Explicit project authorization.
- Input and output validation.
- Secret redaction.
- Sandbox execution.
- Network deny-by-default.
- Resource limits.
- Dependency provenance checks.
- Tamper-evident audit strategy.
- Security tests for every trust boundary.

## Root host
The setup operator currently uses root. This does not authorize application
workloads to run as unrestricted root. Never execute generated or untrusted
code directly on the host as root. Never expose the Docker socket to workloads.

## Incident response
Document detection, containment, credential rotation, evidence preservation,
recovery and post-incident review before production use.
