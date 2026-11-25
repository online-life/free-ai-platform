# Initial Error Catalog

| Code | Meaning | Retryable |
|---|---|---|
| AUTH_UNAUTHENTICATED | Missing or invalid identity | No |
| AUTH_FORBIDDEN | Action not permitted | No |
| PROJECT_NOT_FOUND | Project unavailable or not visible | No |
| PROJECT_SCOPE_MISMATCH | Resource belongs to another project | No |
| VALIDATION_FAILED | Input failed validation | No |
| CONFLICT_STATE | Requested transition is invalid | No |
| IDEMPOTENCY_CONFLICT | Same key used with different request | No |
| RATE_LIMITED | Request rate exceeded | Yes, after delay |
| DEPENDENCY_UNAVAILABLE | Required dependency unavailable | Usually |
| EXECUTION_TIMEOUT | Workload exceeded time limit | Policy-dependent |
| EXECUTION_POLICY_DENIED | Execution violates policy | No |
| APPROVAL_REQUIRED | Explicit approval is pending | After approval |
| INTERNAL_ERROR | Unexpected internal failure | Unknown |

Do not expose stack traces or secrets in client-facing errors.
