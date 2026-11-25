# ADR-0006 — Execution Isolation

Status: Security requirement accepted; implementation technology open.

Untrusted code must run outside the control-plane process in a restricted
execution boundary. It must never run directly on the host as unrestricted root.

Evaluate:
- rootless containers;
- hardened OCI runtimes;
- gVisor;
- microVM isolation;
- other maintained sandbox technologies.

Compare kernel attack surface, privilege model, networking, filesystem,
resource enforcement, compatibility, license and maintenance.

Docker alone is not automatically a sufficient hostile-code sandbox.
Never expose the Docker socket to a workload.
