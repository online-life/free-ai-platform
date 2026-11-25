# Layer 01 Test Plan

Required test suites:

1. Unit:
   - Password hashing and verification.
   - Authorization allow and deny.
   - Tenant and project mismatch.
   - Session token hashing.
   - Secret encryption and decryption.
   - Storage scope validation.
   - Event envelope creation.

2. Integration:
   - Tenant creation and isolation.
   - User and session persistence.
   - Project ownership and scope.
   - Settings persistence.
   - Secret persistence.
   - Audit event persistence.
   - Outbox event persistence.

3. Security:
   - Invalid credentials.
   - Expired or revoked session.
   - Cross-tenant access.
   - Cross-project access.
   - Missing permission.
   - Explicit deny override.
   - Secret tampering.
   - Secret key absence.
   - Audit modification attempts.

4. Acceptance:
   - A tenant cannot read another tenant's records.
   - A project cannot read another project's records.
   - An unprivileged user cannot perform protected operations.
   - No secret plaintext appears in logs or database.
   - Audit evidence exists for sensitive operations.

A test suite must fail closed.
