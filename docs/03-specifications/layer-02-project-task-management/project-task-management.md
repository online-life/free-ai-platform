# Layer 02 — Project & Task Management

## Purpose
Translate user instructions into manageable, traceable project work.

## Components
- Project registry.
- Project settings and lifecycle.
- Project Specialist.
- Project-specific memory and context.
- File and artifact registry.
- Requirement intake.
- Task decomposition.
- Dependency graph.
- Task status and priority.
- Milestone and version tracking.
- Project activity history.

## Task lifecycle
RECEIVED -> ANALYZING -> PLANNED -> READY -> RUNNING ->
VALIDATING -> COMPLETED

Alternative states:
WAITING_FOR_APPROVAL, BLOCKED, FAILED, CANCELLED, PAUSED.

## Requirements
- Every task belongs to a project or an explicitly global scope.
- Every task has an owner, status and traceable history.
- Dependencies must be validated before execution.
- Project context is isolated.
- A task plan must identify deliverables and acceptance criteria.
- Changes to approved scope require authorization.
- Failed tasks preserve diagnostic information.
- Long-running tasks support pause and resume.

## Acceptance criteria
- A user request can be recorded and assigned to a project.
- The system can represent tasks and dependencies.
- Invalid dependency cycles are rejected.
- Task state transitions are validated.
- Project history is queryable.
