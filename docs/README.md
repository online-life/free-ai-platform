# Documentation

This index links to current setup and implementation guidance. Technical
specifications and older reports may describe proposed or historical behavior;
check [current status](STATUS.md) before relying on them.

## Getting started

- [Installation and first run](getting-started/installation.md)
- [First-run owner setup](03-specifications/layer-01-platform-core/first-run-owner-setup.md)
- [User Guide](user-guide/README.md)

## Development

- [Developer Guide](developer-guide/README.md)
- [Development setup and commands](DEVELOPMENT.md)
- [Engineering standards](16-standards/engineering-standards.md)
- [Contributing](../CONTRIBUTING.md)

## Architecture

- [Architecture overview](ARCHITECTURE.md)
- [Current module boundaries](17-architecture/module-boundaries.md)
- [Deployment topology](17-architecture/deployment-topology.md)
- [Data isolation](18-data-design/project-isolation.md)

## API and contracts

- The running API serves its OpenAPI document at `/api/v1/openapi.json`.
- Use the [developer guide](developer-guide/README.md#api-and-database) for
  API, database, and implementation pointers.
- [API contract proposal](09-api-contracts/api-contracts.md) and
  [contract guidelines](19-contracts/api-guidelines.md) are design references,
  not substitutes for the current runtime OpenAPI schema.

## Integrations

- [Provider setup and project execution](13-operations/provider-setup-and-execution.md)
- [Provider gateway specification](03-specifications/layer-05-provider-gateway/README.md)
- [Provider policy decision](21-technology-decisions/ADR-0008-free-provider-policy.md)

## Deployment and operations

- [Local installation and first run](getting-started/installation.md)
- [Local installation, backup, and restore](13-operations/installation-backup-restore.md)
- [Provider setup and project execution](13-operations/provider-setup-and-execution.md)
- [Operations design](13-operations/operations-design.md)
- [Production readiness status](STATUS.md)

## Security

- [Security policy and reporting](../SECURITY.md)
- [Security implementation guidance](SECURITY.md)
- [Authorization model](20-security/authorization-model.md)
- [Threat model](20-security/threat-model.md)

## Project

- [Roadmap](ROADMAP.md)
- [Final production-closure report](reports/FINAL-PRODUCTION-CLOSURE-REPORT.md)
- [Final audit report](reports/FINAL-AUDIT-REPORT.md)
