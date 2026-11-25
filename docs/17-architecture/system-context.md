# System Context — C4 Level 1

## System purpose
Free AI Platform is a multi-project AI agent platform. It receives user instructions,
maintains isolated project contexts, plans work, coordinates governed agents,
executes approved tools in restricted environments, validates deliverables,
and records evidence.

## Actors
- Platform Owner.
- Project Owner.
- Project Member.
- Platform Operator.
- Future AI Provider.
- Future external storage and notification systems.

## Trust boundaries
1. Client to API.
2. API to application modules.
3. Application modules to persistence.
4. Control plane to execution plane.
5. Sandbox to host.
6. Platform to external provider.
7. Project A to Project B.

## Main flow
User Request
-> Authentication
-> Project Authorization
-> Intake
-> Analysis
-> Planning
-> Approval when required
-> Workflow Scheduling
-> Agent Assignment
-> Tool Authorization
-> Isolated Execution
-> Validation
-> Delivery
-> Audit and Archiving

## Out of scope
- Model downloads.
- Provider selection.
- API key configuration.
- Provider activation.
- Production deployment.
