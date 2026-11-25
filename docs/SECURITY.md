# Security

## Secrets

Environment files and private keys must remain untracked. `.env.example` contains placeholders only. Provider credentials, database credentials, session secrets, bootstrap tokens, and encryption keys must be supplied through secure local or secret-managed configuration.

## Authentication

The API uses server-persisted browser sessions, HttpOnly cookies, CSRF checks, tenant-scoped authorization, password rotation, lockout controls, and audited administrative operations.

## Provider connections

Provider URLs are validated. Remote endpoints require approved HTTPS destinations. Loopback endpoints require an explicitly local connector and DNS/SSRF protections. Credentials must not appear in logs or API responses.

## Runtime

Runtime devices use pairing tokens and tenant/project grants. Workspace file operations are descriptor-anchored and permission-intersected. Process execution requires explicit approval and allowlisted executable paths.

## Reporting

Follow `SECURITY.md` for vulnerability reporting. Do not publish exploit details or credentials in public issues.
