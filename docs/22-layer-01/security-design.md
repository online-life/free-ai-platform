# Security Design

## Identity
Passwords are hashed using scrypt with a unique random salt.

## Authentication
Session tokens are generated using a cryptographically secure random source.
Only token hashes are persisted.

## Authorization
All operations are denied unless an explicit matching ALLOW exists.
An explicit DENY overrides an ALLOW.

## Tenant and project isolation
The active tenant and project scope must be verified before data access.
Database queries must include the tenant and project scope.

## Secrets
Secrets use AES-256-GCM authenticated encryption.
The master key must be delivered through a protected secret source.
Never log plaintext secrets.

## Audit
Audit records include actor, scope, action, outcome, time and correlation ID.
The database role used by the application must not be allowed to delete audit rows.

## Operations
Do not run untrusted code as root on the host.
Use isolated execution environments with explicit resource limits.
