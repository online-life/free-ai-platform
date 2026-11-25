# Free AI Platform Web Application

The web application uses English-only copy and a left-to-right layout. Brand assets live in `assets/` and are copied into the production build along with the web manifest. The interface supports light and dark themes and responsive layouts.

## Development

Run `pnpm --filter @free-ai/web dev` for the loopback preview and `pnpm web:build` to generate `dist/`. The preview is not a production reverse proxy; configure the API origin, TLS, security headers, and service lifecycle in the deployment environment.

## Acceptance checks

- `tests/web/brand-language.test.ts` checks shipped resources for Arabic text and RTL behavior and checks required product identity assets.
- `scripts/browser-smoke.mjs` uses Chromium to verify brand display, English-only text, LTR, theme persistence, responsive navigation, and an authentication-gated model view.

Authorization is always enforced by the API; client-side controls are not a security boundary.
