# Layer 06 — Execution Engine

## Purpose
Execute approved tools and workloads in controlled isolated environments.

## Components
- Tool registry.
- Execution job manager.
- Runtime abstraction.
- Sandbox manager.
- Container lifecycle.
- Filesystem policy.
- Network policy.
- CPU, memory and disk limits.
- Timeout enforcement.
- Output capture.
- Artifact validation.
- Cleanup and evidence collection.

## Security requirements
- Untrusted code never runs directly on the host.
- Host root credentials are never passed to workloads.
- Workloads run with least privilege.
- Network is disabled unless explicitly authorized.
- Filesystem access is restricted to approved mounts.
- CPU, memory, disk and execution time are limited.
- Images and dependencies require provenance checks.
- Containers must not receive the Docker socket.
- Secrets are not exposed to arbitrary workloads.
- Cleanup runs after success, failure or cancellation.

## Acceptance criteria
- Unauthorized execution is rejected.
- Resource limits are enforced.
- Network restrictions are tested.
- Workload outputs are captured.
- Temporary environments are removed.
- Host files remain inaccessible unless explicitly mounted.
