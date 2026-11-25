# Configure a provider and run a project request

## Supported connector types

The API currently registers two connectors:

- `OPENAI_COMPATIBLE` for remote OpenAI-compatible endpoints. The endpoint must
  use HTTPS and must not embed credentials in its URL.
- `LOCAL_OPENAI_COMPATIBLE` for an explicitly local endpoint. The URL must
  use a loopback hostname or address; a remote endpoint cannot use this
  connector.

These are protocol-compatible connectors, not dedicated integrations for
specific provider brands. Dedicated OpenCode and FreeLLMAPI integrations are
not present in the current implementation.

## Configure a provider

1. Sign in as a user with provider-management permission.
2. In **Providers**, configure the connector type, endpoint, and supported
   authentication. Keep credentials out of URLs and documentation. Provider
   secrets are stored by the API and are not returned in provider-list
   responses.
3. Test the connection and discover the endpoint's model catalog.
4. Review each model's authoritative pricing, privacy terms, and capabilities.
   Catalog discovery does not establish price, free quota, data residency, or
   model capability.
5. Keep unknown values classified as `UNKNOWN`. Set privacy approval,
   capabilities, pricing, and availability only from evidence.

Connection testing checks health or discovers models; it does not issue a
model-inference request. The current gateway adapter does not support
streaming. Neither a successful connection test nor model discovery proves
that inference will succeed.

## Model eligibility and project requests

The project request flow routes through the central provider gateway. The API
rechecks project authorization and model eligibility before dispatch. The
free-first policy permits only enabled, available, privacy-approved,
text-generation models with `SELF_HOSTED` billing, or `FREE` billing plus
`VERIFIED_FREE` status. Other billing/free-tier combinations are blocked. The
workspace form sets `maxFallbacks` to zero. API callers may request up to two
fallback attempts for retryable provider errors, subject to their selected
model and provider constraints.

1. Create or open a project.
2. From **Run a project request**, choose an eligible model, enter a prompt,
   and submit the request.
3. The API dispatches the request through the provider gateway and returns
   routing evidence and token usage when provided by the endpoint.

The project request route is covered by PostgreSQL E2E tests using a mock
provider. Successful inference with a live external model and browser
acceptance with a configured live model have not been verified. Review the
provider's data-handling terms before sending sensitive project information.
