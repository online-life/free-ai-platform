# User guide

Free AI Platform is under active development and is **not production-ready**.
This guide covers verified user flows and calls out partial capabilities.
Start with [installation](../getting-started/installation.md), then return
here after the API and web client are running.

## First run and sign-in

1. Complete the one-time owner bootstrap using the configured bootstrap token.
2. Save the generated temporary credentials securely when displayed.
3. Sign in and change the temporary password.

Public self-registration is disabled. The API enforces the setup and
credential lifecycle. See [first-run owner setup](../03-specifications/layer-01-platform-core/first-run-owner-setup.md);
never copy bootstrap tokens or temporary credentials into issues, screenshots,
or logs.

## Projects and requests

Create a project from the workspace after signing in. Project access and
actions are checked by the API; knowing a project identifier does not grant
access. See the [authorization model](../20-security/authorization-model.md).

To submit a project request:

1. Create or open a project.
2. Configure an eligible provider and model (see
   [provider setup](../13-operations/provider-setup-and-execution.md)).
3. Use **Run a project request**, enter a prompt, and submit it.
4. Review the returned response and routing/usage information.

The current form uses the central gateway and sets fallback count to zero.
Its free-first eligibility requires an enabled, available,
privacy-approved text-generation model classified as `SELF_HOSTED`, or
`FREE` with `VERIFIED_FREE` status. API callers may request up to two fallback
attempts for retryable provider errors, subject to the selected model and
provider constraints. A mock-provider E2E path has been tested; live external
inference has not been verified.

## Providers and models

The supported connector types are remote `OPENAI_COMPATIBLE` endpoints and
loopback-only `LOCAL_OPENAI_COMPATIBLE` endpoints. Provider configuration
requires the relevant management permission. Review endpoint security,
credential validity, pricing, privacy, and model capabilities before
enabling a connection.

Connection tests perform health checks or catalog discovery; they do not
submit an inference request or prove pricing, availability, or data handling.
The current gateway adapter does not support streaming. Dedicated OpenCode
and FreeLLMAPI integrations are not present. For provider errors and model
eligibility, use the [provider setup guide](../13-operations/provider-setup-and-execution.md).

## Agents

The **Agents** view can create and list agent definitions. Permissioned API
operations also support versioning, activation/disable/archive, evaluation
records, capability-based selection, and project-isolated memory. These
definitions describe instructions and capabilities; they do not run a model
or execute tools by themselves. A complete agent-to-model execution loop is
not wired into project requests yet. See the
[agent ecosystem specification](../03-specifications/layer-03-agent-ecosystem/README.md)
for the boundary and the [current status](../STATUS.md).

## Workflows

The **Workflows** view is project-scoped. It can create an approval-and-wait
example, start a run, and expose approval/resume actions. Persisted workflow
runs and their state are also available through the API.

Current workflow validation connects `APPROVAL`, `CONDITION`, and `WAIT`
steps. Other step types appear in the schema but are not connected to an
executor and are rejected by validation. Do not treat workflows as a general
AI-agent task runner. See the
[workflow orchestration specification](../03-specifications/layer-07-workflow-orchestration/README.md).

## Runtime, workspaces, and execution

The API coordinates paired Runtime devices and dispatches approved work to
the separate Runtime service. Runtime processes must run as an unprivileged
user; process execution requires Linux Bubblewrap and `prlimit` and fails
closed when prerequisites are missing. Workspace paths and command
allowlists are configured locally on the Runtime host and are not sent to the
API. Review the [Runtime guide](../../services/ai-runtime/README.md),
[architecture](../ARCHITECTURE.md), and
[security guidance](../SECURITY.md) before connecting a device.

## Common questions and troubleshooting

**The web page says the API is offline.** Check that the API is running, that
`/api/v1/health` reports a healthy database, and that `API_BASE_URL` and
`WEB_ORIGIN` match the actual local origins. Node services do not
automatically load `.env`; load it into the service process as described in
the [installation guide](../getting-started/installation.md).

**A provider connection test succeeds but a request fails.** Connection
testing only checks health or discovers a catalog. Confirm the selected model
is enabled, available, privacy-approved, and eligible under the pricing
policy; check the provider’s model identifier, credentials, and logs without
exposing secrets.

**Why can’t I create an account?** Public registration is disabled. The
installation owner provisions users.

**Does the platform require Redis or Docker?** Neither is required by the
current application, and there is no supported Docker Compose installation
configuration in this repository.

**Is this production-ready?** No. Read [status](../STATUS.md) and the
[roadmap](../ROADMAP.md). A successful local setup or mock-provider test is
not production acceptance.

For dependency, migration, port, and Runtime troubleshooting, see the
[installation guide](../getting-started/installation.md). For API details, use
the running service’s `/api/v1/openapi.json`.
