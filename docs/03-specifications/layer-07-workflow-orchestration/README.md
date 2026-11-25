# Layer 07 — Workflow & Orchestration Engine

Responsibilities:
- Versioned workflow definitions.
- Step dependencies.
- Cycle detection.
- Workflow runs.
- Approval checkpoints.
- Pause and resume.
- Cancellation.
- Scheduling.
- Timeline and trace events.

A workflow waiting for approval must remain paused.
Silence is never approval.
A resumed workflow must continue from persisted state.
Use idempotency keys to prevent duplicate runs.
