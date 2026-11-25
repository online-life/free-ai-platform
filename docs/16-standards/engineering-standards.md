# Free AI Platform Engineering Standards

Status: Project engineering baseline.

## 1. Purpose
These standards govern architecture, implementation, testing, security,
documentation, and changes across the entire Free AI Platform platform.

Normative terms:
- MUST: mandatory.
- MUST NOT: prohibited.
- SHOULD: recommended unless an exception is documented.
- MAY: optional.

Exceptions require an approved Architecture Decision Record (ADR).

## 2. Reference frameworks
The project uses these as engineering references, not as certification claims:

- ISO/IEC 25010: software product quality.
- OWASP ASVS: application security verification.
- OWASP Top 10: web application risk awareness.
- NIST SSDF SP 800-218: secure development practices.
- C4 Model: architecture documentation.
- Domain-Driven Design: bounded contexts and domain ownership.
- OpenAPI: HTTP API descriptions.
- AsyncAPI: asynchronous interface descriptions when applicable.
- Semantic Versioning: contract and package versioning.
- Conventional Commits: commit message conventions.
- Test Pyramid: unit, integration, contract, and acceptance tests.

## 3. Architecture principles
1. Modular Monolith first.
2. Separate control plane from execution plane.
3. Explicit module boundaries.
4. One authoritative owner for each domain aggregate.
5. No direct access to another module's private repository.
6. Cross-module calls use published application interfaces.
7. Events are versioned and consumers are idempotent.
8. Microservices require a documented business and operational reason.
9. No technology is accepted solely because it is popular.
10. Every architectural decision is documented.

## 4. Code standards
- TypeScript strict mode.
- No implicit any.
- Validate all untrusted inputs.
- Use explicit error types or stable error codes.
- Avoid circular dependencies.
- Avoid hidden global mutable state.
- Keep domain logic independent of frameworks.
- Keep infrastructure adapters outside the domain layer.
- Use dependency injection at composition boundaries.
- Keep functions and modules focused.
- Do not duplicate business rules.
- Do not introduce abstractions without a demonstrated need.

## 5. API standards
- Public APIs are versioned.
- Request and response schemas are explicit.
- Authentication and authorization are server-side.
- State-changing operations support idempotency where appropriate.
- Errors use stable machine-readable codes.
- Pagination is standardized.
- Sensitive data is never returned in error messages.
- API contracts are tested independently of implementation.

## 6. Data standards
- Every entity has an owner.
- Every project-owned record has project scope.
- Every state transition is validated.
- Database migrations are versioned.
- Data retention and deletion are documented.
- Audit events are protected against unauthorized modification.
- Timestamps are stored in UTC.
- Secrets are stored as references, not ordinary domain fields.

## 7. Security standards
- Deny by default.
- Least privilege.
- No secrets in source control.
- No secrets in logs.
- No untrusted code on the host.
- No unrestricted root execution for agents.
- No Docker socket exposure to untrusted workloads.
- Sandbox network access is denied by default.
- Resource limits are mandatory.
- Dependencies and images require provenance review.
- Sensitive operations require explicit authorization.

## 8. Testing standards
Every feature requires relevant:
- Unit tests.
- Contract tests.
- Integration tests.
- Architecture tests.
- Security tests.
- Acceptance tests.
- Failure and recovery tests.

A successful build is not proof of correctness.

## 9. Git standards
- Small, reviewable commits.
- Conventional Commit messages.
- No credentials or generated secrets.
- No model weights in source control.
- No local databases in source control.
- Architectural changes require ADR updates.
- Lockfiles must be committed when dependencies are approved.

## 10. Definition of Done
A feature is complete only when:
1. Requirements are documented.
2. Acceptance criteria pass.
3. Relevant automated tests pass.
4. Security implications are reviewed.
5. Documentation is updated.
6. Failure behavior is documented.
7. Auditability is verified where applicable.
8. Remaining limitations are recorded.

## 11. Required module artifacts
Each module must contain:
- README.md
- module-spec.md
- interfaces/
- tests/
- ownership declaration
- data ownership declaration
- security requirements
- acceptance criteria
