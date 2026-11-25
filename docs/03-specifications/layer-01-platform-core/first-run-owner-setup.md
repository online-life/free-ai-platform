# First-run Owner Setup

Public self-registration is disabled in every environment. The legacy endpoint
returns `403 REGISTRATION_DISABLED`. A fresh installation can create its first
owner through `POST /api/v1/auth/bootstrap` when `BOOTSTRAP_TOKEN` is configured
to a unique random value at least 32 characters long. The token is compared in
constant time and is never returned by the status endpoint or persisted. The
singleton setup row and PostgreSQL advisory transaction lock make first-owner
creation single-use across concurrent requests. Existing tenants complete the
setup state.

`GET /api/v1/auth/bootstrap/status` only returns whether setup is available.
Bootstrap generates an unpredictable username and 256-bit random temporary
password on the server. Passwords use salted scrypt (N=32768, r=8, p=1; legacy
N=16384 hashes are supported). Credentials appear only in the successful,
single-use bootstrap response, marked `Cache-Control: no-store`; the setup
screen displays them once and does not persist them in browser storage. The
initial owner must change the temporary password before normal API access.
Remove the bootstrap token from the service environment after owner creation.
Login uses username and password; email is optional profile metadata.

Browser sessions use opaque random identifiers whose digests are stored in
PostgreSQL. The browser receives an HttpOnly cookie with production Secure,
SameSite=Strict, CSRF protection, server-side renewal and revocation. Authorized
owners can create users and reset credentials; temporary credentials are
shown once and force a password change. Focused auth integration tests exercise
these behaviors.

This remains a bootstrap API flow, not a complete package installer. There is
no local owner-readable credential file option. Production service setup,
packaging, full browser acceptance, and production deployment verification
remain incomplete.
