# ADR-0003: Untrusted Execution Isolation

Status: Accepted

Decision:
Untrusted code must execute in a restricted isolated environment, never as
an unrestricted host process.

Mandatory controls:
- Least privilege.
- No host Docker socket exposure.
- Restricted filesystem mounts.
- Network deny-by-default.
- CPU, memory, disk and time limits.
- Cleanup and audit evidence.

The exact sandbox technology remains subject to security evaluation.
