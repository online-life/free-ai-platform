# Project Isolation

## Access decision
Allow only when:
1. Principal is authenticated and active.
2. Project exists and is active.
3. Principal has active membership or explicit service grant.
4. Action is permitted for the resource and scope.
5. Resource belongs to the requested project.
6. Classification and approval conditions are satisfied.

## Enforcement points
- API authentication and scope guard.
- Application-level authorization.
- Project-scoped repository methods.
- Database row-level security where supported.
- Object storage authorization broker.
- Project-scoped cache keys.
- Mandatory project filters in search.
- Background job authorization.
- Export and download authorization.

## Prohibited
- Query by resource ID without project scope.
- Trusting client-supplied project ID.
- UI-only isolation.
- Shared cache keys without project namespace.
- Unfiltered global search.
- Cross-project memory retrieval by similarity alone.

## Required tests
Use at least two projects and test read, update, delete, search, cache,
download, export, and background jobs for cross-project access denial.
