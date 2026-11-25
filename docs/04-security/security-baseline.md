# Free AI Platform Security Baseline

## Host Security

- The development host is operated by root as requested.
- No untrusted agent code may run directly on the host.
- Host secrets must never be committed.
- Host-level changes must be documented.

## Container Security

- Containers must use restricted permissions.
- Avoid privileged containers.
- Avoid mounting the Docker socket into application containers.
- Set CPU, memory, process, and storage limits.
- Restrict network access.
- Persist only approved volumes.
- Do not expose internal service ports publicly by default.

## Project Isolation

- Each project has separate data boundaries.
- Cross-project access requires explicit authorization.
- Project memory must not leak into other projects.
- Files must be accessed through permission-checked services.

## Agent Security

- Every agent has a declared role and capability set.
- Agents receive minimum required permissions.
- Agents cannot grant themselves permissions.
- Agents cannot bypass user instructions.
- Sensitive actions require explicit approval.

## Provider Security

- Secrets are stored in a dedicated secure mechanism.
- Provider requests pass through the unified gateway.
- Usage and quota changes are audited.
- Paid services are disabled and excluded from routing.

## Execution Security

- Untrusted code runs in isolated environments.
- Network access is denied by default unless approved.
- Resource limits and execution timeouts are mandatory.
- Outputs are captured and validated.
- Temporary environments are cleaned after execution.
