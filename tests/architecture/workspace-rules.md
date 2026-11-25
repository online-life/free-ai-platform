# Workspace Rules

1. Every workspace package has a unique package name.
2. Internal dependencies use workspace:*.
3. Shared contracts must not depend on application packages.
4. Shared utilities must not contain business-specific workflows.
5. Applications may depend on packages, not the reverse.
6. AI Runtime communicates with providers only through the unified gateway.
7. No package may bypass authorization or project isolation.
8. No untrusted code may execute on the host.
9. Secrets must never be committed to Git.
10. Architecture changes require an ADR.
