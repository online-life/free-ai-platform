# Workspace Hardening

Status: Prepared for local validation.

This step establishes:
- Explicit pnpm workspace membership.
- Package manifests.
- Internal workspace dependency declarations.
- Shared TypeScript compiler defaults.
- Structure, architecture-document, and contract-entry checks.

This step does not:
- Install dependencies.
- Start application services.
- Select or connect AI providers.
- Download models.
- Claim production readiness.

Validation commands:

    node scripts/check-structure.mjs
    node scripts/check-architecture.mjs
    node scripts/check-contracts.mjs
    git diff --check
