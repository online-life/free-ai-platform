# ADR-0001: Architecture Style

Status: Accepted

Decision:
Start with a Modular Monolith with strict module boundaries and explicit
contracts. Consider service extraction only when measurable operational,
scaling or team-ownership needs justify it.

Consequences:
- Simpler initial deployment.
- Shared governance and security controls.
- Requires strict dependency boundaries.
- Modules must avoid hidden cross-module database coupling.
