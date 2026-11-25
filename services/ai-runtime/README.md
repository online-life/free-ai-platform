# Free AI Platform Local Runtime

Node.js client for outbound device enrollment, heartbeat, job polling, cancellation observation, and health-check reporting. It refuses to start as root and requires HTTPS for non-loopback API endpoints. Pairing codes are one-use; device tokens are written with owner-only permissions on Linux.

Implemented handlers: `RUNTIME_HEALTH_CHECK`, workspace list/read/write/delete, and explicitly approved `SANDBOX_PROCESS`. Workspace paths and executable command allowlists are configured locally in a mode-0600 JSON file selected by `FREEAI_WORKSPACE_BINDINGS_FILE`; they are never sent to the API. The API dispatches the workspace alias, pairing key, permissions, and operation, and the runtime intersects server grants with local permissions and command allowlists. Delete and process execution require per-job approval. Process jobs run through the Linux Bubblewrap sandbox and fail closed when its prerequisites are absent. File access remains descriptor-anchored.

## Run

Build with `pnpm --filter @free-ai/ai-runtime build`. Start as a dedicated unprivileged OS account with `FREEAI_API_URL` and a short-lived `FREEAI_PAIRING_CODE` for first enrollment. The identity file defaults to `$HOME/.config/free-ai/runtime-device.json`; set `FREEAI_RUNTIME_IDENTITY_FILE` to choose another path. The Runtime creates the parent directory and stores the identity with owner-only permissions. The pairing code is consumed once; subsequent starts load the local device identity. Never put tokens in command-line arguments or logs.

## Security and ownership

- Owns the outbound runtime client and Linux descriptor-anchored workspace filesystem primitives.
- Does not own authentication, project authorization, model/provider routing, or sandbox policy.
- `workspace-access.ts` enforces root directory containment for individual Linux filesystem calls and requires explicit approval for delete operations. It is not process isolation.
- `process-sandbox.ts` launches only allowlisted executable paths through a fail-closed Linux Bubblewrap sandbox with separate user, PID, network, IPC, and UTS namespaces, read-only system binaries, a writable workspace bind, and `prlimit` CPU, address-space, process, file-size, descriptor, wall-clock, and output bounds. It refuses root execution and honors Runtime cancellation.

## Acceptance evidence

`tests/runtime/runtime-client.test.ts` covers pairing/heartbeat/job handling/revocation behavior. Workspace access and handler tests exercise actual local file operations, symlink escapes, directory-swap races, local binding configuration, permission intersection, and delete approval. `tests/e2e/runtime-workspace-flow.test.cjs` pairs an unprivileged Runtime with the API, binds a workspace, dispatches approved file and sandbox process jobs, and verifies output, cancellation, and device revocation. `tests/e2e/process-sandbox.test.mjs` verifies filesystem/network isolation and resource termination.

Example local binding file (protect it with mode `0600`, owned by the runtime user):

```json
{
  "project-a": {
    "path": "/srv/free-ai/workspaces/project-a",
    "workspaceKey": "copy-the-workspace-key-from-your-trusted-provisioning-flow",
    "permissions": { "read": true, "write": true, "delete": false, "execute": false },
    "commands": {}
  }
}
```

The local `workspaceKey` must match the key configured for the paired device in Free AI Platform. To enable process execution, set `execute` true only alongside read/write grants and configure a narrow command map, for example `"commands": { "node": "/usr/bin/node" }`. Only command keys in this local map can be requested. Do not place this file in a project repository or expose it through the API.
