# Configure a provider and run a project request

## Configure a gateway connection

1. Sign in as an owner or user with provider-management permission.
2. Open **Providers** and add a provider endpoint, provider type, and credential.
   Provider credentials are stored encrypted by the API and are not returned
   in provider list responses.
3. Test the connection and discover the provider's models.
4. Review each model's official pricing and privacy terms. Discovery does not
   establish price, free quota, data residency, or model capabilities.
5. Leave unknown pricing as `UNKNOWN`. Configure required capabilities and
   privacy approval from evidence, enable the provider/model, and enable the
   appropriate model-availability policy.

The current Free AI Platform policy blocks unknown and paid provider/model
records from project execution. The project chat form requires verified-free
or self-hosted eligibility, privacy approval, text-generation capability, and
uses no automatic fallback. Never classify a model as free based only on a
catalog listing or the existence of a free provider account.

## FreeLLMAPI

FreeLLMAPI is managed as a model gateway. Configure its authenticated `/v1`
endpoint and unified API key as a FreeLLMAPI provider. The repository's live
local integration test currently verifies service authentication and model
discovery. A successful inference has not yet been verified, and the current
adapter does not support streaming. Do not treat discovery or connection health
as proof that a model can generate responses.

## Run a project chat request

1. Create or open a project.
2. From the project's **Run a project request** panel, enter a prompt and
   submit it.
3. The API checks project access and `execution.submit`, selects an eligible
   text-generation model, and sends the request through the central provider
   gateway. The result includes the provider/model identity and token usage if
   the provider returns it.
4. If no eligible model exists, configure one based on verified pricing,
   privacy, capability, and provider health evidence. Unknown/paid models stay
   blocked by the free-first policy.

The request form has contract-test coverage and its API route is covered by the
PostgreSQL feature E2E with a mock provider. It has not been browser-tested with
a configured live model. Do not enter sensitive project data until the
provider's data handling is reviewed.

## Supported connector identities and provider administration

The API registry currently contains `OPENAI_COMPATIBLE`,
`LOCAL_OPENAI_COMPATIBLE`, and `FREELLMAPI`. The web identity registry mirrors
these connector types. No official brand images are included because verified
asset provenance was unavailable; the UI uses accessible neutral SVG marks.
These names do not imply that a specific external provider account is
configured or supported through a native adapter.

The owner can edit the endpoint and pricing classification, rotate the
credential, test health/catalog discovery, enable or disable a connection, and
manage model metadata from **Providers**. The test-connection action performs
health/catalog discovery and does not send a model inference request. Secrets
are not returned to the browser. Model prices and free-tier state must be
reviewed per model; unknown is not free. The project selector lists only
currently available, privacy-approved, verified-free or self-hosted text
models. The API validates the selected model again before dispatch.
