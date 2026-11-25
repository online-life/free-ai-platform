# Module Boundaries

| Module | Owns | Must not own |
|---|---|---|
| Identity | Principals, sessions, credentials metadata | Project task content |
| Authorization | Roles, permissions, grants, policies | User passwords |
| Projects | Project lifecycle and settings | Global identity |
| Tasks | Tasks, dependencies, acceptance criteria | Tool execution |
| Agents | Agent definitions and versions | Permission decisions |
| Model Catalog | Model metadata and evaluations | Provider credentials |
| Provider Gateway | Connectors, quotas, usage | Workflow planning |
| Tools | Tool metadata and schemas | Host execution |
| Execution | Jobs, sandbox lifecycle, outputs | Unrestricted host access |
| Workflows | Definitions, runs, approvals | Bypassing module policies |
| Audit | Audit records | Mutable business state |
| Artifacts | Artifact metadata and storage adapter | Business authorization rules |

## Rules
- One module owns writes to its aggregate data.
- Other modules use public interfaces or approved projections.
- Domain logic must not join private tables from other modules.
- Cross-module transactions should be avoided.
- Use an outbox pattern when reliable event publication is required.
- Shared tables require an ADR and explicit ownership.
