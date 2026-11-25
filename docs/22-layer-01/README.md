# Layer 01 - Platform Core & Foundation

This layer provides the common security and platform foundation.

Modules:
- Identity
- Authentication
- Authorization
- Tenant isolation
- Project isolation
- Settings
- Secrets
- Audit events
- Storage
- Event outbox
- Observability
- Backup and recovery

Security defaults:
- Deny by default.
- Tenant and project scope are mandatory for scoped resources.
- Passwords are stored as password hashes.
- Session tokens are stored as hashes.
- Secrets use authenticated encryption.
- Audit records must be append-only at the application boundary.
- Untrusted execution is forbidden on the host.

This package is a foundation implementation, not a production certification.
