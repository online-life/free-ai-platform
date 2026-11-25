# ADR-0001 — Modular Monolith

Status: Accepted

Decision:
Start with one control-plane application using strict bounded contexts.
Keep untrusted execution in a separate restricted execution plane.

Reason:
Avoid premature distributed-system complexity while preserving module ownership.

Consequences:
Module boundaries must be enforced by tests.
Service extraction requires a new evidence-based ADR.
