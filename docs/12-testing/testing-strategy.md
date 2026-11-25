# Testing Strategy

## Test levels
1. Static analysis and formatting.
2. Unit tests.
3. Contract tests.
4. Integration tests.
5. Architecture tests.
6. Security tests.
7. Acceptance tests.
8. Recovery and resilience tests.
9. Performance tests.

## Mandatory scenarios
- Cross-project access denial.
- Missing permission denial.
- Invalid state transition rejection.
- Duplicate event delivery.
- Workflow pause and resume.
- Approval required before sensitive action.
- Secret redaction.
- Sandbox resource limit enforcement.
- Network deny-by-default.
- Failed execution cleanup.
- Backup restoration.
- Audit trace completeness.

## Definition of Done
- Acceptance criteria pass.
- Security tests pass.
- No unresolved critical vulnerabilities.
- Documentation is updated.
- Migrations are tested where applicable.
- Failure behavior is documented.
- Evidence is attached to the task report.
