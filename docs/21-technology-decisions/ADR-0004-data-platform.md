# ADR-0004 — Data Platform

Status: Proposed

Candidates:
- PostgreSQL for transactional relational data.
- Redis only for a demonstrated cache, coordination, rate-limit or queue need.
- S3-compatible storage for artifacts.

Evaluation:
Isolation, row-level security, migrations, backup/restore, encryption, indexing,
search requirements, resource footprint, license and operational cost.

Redis is not the system of record.
Do not install services before data design and restore tests are approved.
