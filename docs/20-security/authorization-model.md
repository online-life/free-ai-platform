# Authorization Model

## Principal types
Human user, service principal, system process, and future agent identity.

Agents are not inherently trusted and have no implicit permissions.

## Scope hierarchy
Platform -> Tenant (optional future scope) -> Project -> Resource.

A broad grant applies downward only when policy explicitly permits it.

## Permission tuple
(subject, action, resource, scope, conditions, expiry)

## Default
Deny unless an explicit active grant and all conditions match.

## Separation of duties
- Platform owner manages platform policy.
- Project owner manages project membership and grants.
- Agents receive task-scoped, time-bounded capabilities.
- Execution workers receive job-scoped grants.
- Auditors can inspect audit data but cannot modify business state.

## Sensitive operations
Credential changes, provider activation, external network access, destructive
operations, privilege elevation, data export and production deployment require
explicit approval according to policy.

## Revocation
Revocation must affect subsequent authorization checks and constrain active
sessions/jobs according to risk policy.

## Current authentication implementation

The browser receives an opaque random identifier in an HttpOnly cookie. Only
its digest is persisted with the server-side session; the user and tenant are
derived from the active database row. The tenant component in the cookie and
the `X-Tenant-ID` header are lookup hints and never grant membership or
permissions. API/service bearer authentication remains available for
non-browser clients. The browser does not persist bearer credentials in
`localStorage` or `sessionStorage`.

Cookie-authenticated state-changing requests require exact Origin validation
and a CSRF token bound to the server-side session. Sessions have a 30-minute
idle and 12-hour absolute expiry, are renewed during use, rotate on password
change, and are revoked on logout or administrative revocation. Production
cookies use `Secure`, `HttpOnly`, and `SameSite=Strict`. Failed login attempts
trigger progressive lockout. Password changes and administrative account,
role, session, and credential operations generate audit records.

The first owner and subsequently provisioned users must change generated
temporary passwords before normal API access. New non-owner users receive no
role by default. These controls have a focused PostgreSQL-backed integration
test; production reverse-proxy, TLS, complete CSRF/XSS audit, and threat-model
acceptance remain unverified. The platform is not production ready.
