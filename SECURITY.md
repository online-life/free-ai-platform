# Security Policy

## Supported status

Free AI Platform is a development project and is not production-ready. Security fixes are handled on a best-effort basis until a supported release is declared.

## Reporting a vulnerability

Open a minimal GitHub issue requesting a private reporting channel and do not include exploit code, credentials, personal data, or sensitive runtime details. The maintainers will reply privately through the repository's communication channel.

Include:

- Affected component and version or commit
- Reproduction steps
- Impact assessment
- Safe proof of concept
- Proposed mitigation, if available

Do not test against systems or data you do not own or have permission to assess.

## Deployment guidance

- Keep API and Runtime loopback or otherwise appropriately isolated.
- Use a dedicated non-root database role.
- Never commit database URLs, bootstrap tokens, API keys, or encryption keys.
- Store provider credentials only through the configured secret-management path.
- Apply the database, authentication, SSRF, sandbox, and Runtime guidance in `docs/SECURITY.md`.
