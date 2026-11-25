# Free AI Platform Engineering Rules

## Architecture
- One shared platform core for all projects.
- Modular Monolith first.
- Modules communicate through defined interfaces and contracts.
- No duplicated platform foundation per project.
- No premature microservices.
- Every module has explicit ownership and boundaries.

## Project isolation
- Every project has independent data, memory, files, settings and permissions.
- Cross-project access is denied by default.
- Project context must never leak into another project.

## Agent governance
- Agents operate only within assigned permissions.
- Agents cannot modify platform governance or override user instructions.
- All agent actions are attributable and auditable.
- Agent creation and updates require versioning and evaluation.

## AI provider governance
- Model and provider integrations are deferred.
- No paid service may be activated.
- No provider may be accessed outside the future unified gateway.
- Free-tier claims must be verified before activation.

## Execution
- Never execute untrusted code on the host.
- Never execute agent-generated commands as unrestricted root.
- Use isolated execution environments.
- Network access is denied by default.
- Resource and time limits are mandatory.

## Quality
- No feature is complete without acceptance tests.
- No undocumented architectural change.
- No secrets in source control.
- Every change must include a verification report.
