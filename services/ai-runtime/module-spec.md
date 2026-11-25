# Local Runtime Module Specification

## Ownership
The Runtime owns device-side outbound connectivity, local identity storage, health reporting, polling, and cancellation observation. The API remains authoritative for tenant ownership, project grants, job state, and revocation.

## Security requirements
- Never start privileged as root.
- Require TLS except for explicitly loopback API URLs.
- Store only token material locally with restrictive permissions; never log tokens.
- Fail closed for unrecognized job kinds.
- Do not execute arbitrary code until a restricted OS sandbox is verified.
- Workspace operations must be descriptor-anchored, permission-checked, audited, and confined to the granted root.

## Current acceptance criteria
- Enrollment, outbound heartbeat, health-check job completion, and revocation are proven by a live local API smoke running as an unprivileged OS user.
- Workspace path primitives reject traversal and symlink escapes and withstand a tested concurrent parent replacement on Linux.
- Local workspace binding and file-operation dispatch are implemented for Linux using a private host-owned config file, an API-supplied alias/key/permission envelope, permission intersection, and descriptor-anchored file operations. Approved `SANDBOX_PROCESS` jobs use locally allowlisted executables through Bubblewrap with network isolation and `prlimit` resource bounds; they fail closed when unavailable.

## Data ownership
The Runtime keeps a device token and device identity locally. It stores no provider credentials. The API stores only a hash of the device token and workspace aliases, not local absolute paths.
