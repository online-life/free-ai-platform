#!/usr/bin/env bash
set -euo pipefail

echo "Free AI Platform installer: validating environment and applying database migrations."
fail() { echo "$1" >&2; exit 2; }
command -v node >/dev/null || fail "NODE_REQUIRED"
command -v pnpm >/dev/null || fail "PNPM_REQUIRED"
node -e 'if (Number(process.versions.node.split(".")[0]) < 22) process.exit(1)' || fail "NODE_22_OR_NEWER_REQUIRED"
[[ -n "${DATABASE_URL:-}" ]] || fail "DATABASE_URL_REQUIRED"
[[ -n "${BOOTSTRAP_TOKEN:-}" && ${#BOOTSTRAP_TOKEN} -ge 32 ]] || fail "BOOTSTRAP_TOKEN_MINIMUM_32_CHARACTERS_REQUIRED"
[[ -n "${SECRETS_MASTER_KEY:-}" ]] || fail "SECRETS_MASTER_KEY_REQUIRED"
key_bytes="$(printf '%s' "$SECRETS_MASTER_KEY" | base64 --decode 2>/dev/null | wc -c | tr -d '[:space:]')"
[[ "$key_bytes" == "32" ]] || fail "SECRETS_MASTER_KEY_MUST_DECODE_TO_32_BYTES"
[[ -f pnpm-lock.yaml && -f apps/api/prisma/schema.prisma ]] || fail "RUN_FROM_FREE_AI_PROJECT_ROOT"

if [[ ! -x node_modules/.bin/prisma ]]; then
  pnpm install --frozen-lockfile
fi
pnpm prisma:validate
pnpm prisma:generate
pnpm prisma:migrate:deploy
pnpm api:build
pnpm web:build
pnpm --filter @free-ai/ai-runtime build
echo "FREE_AI_PLATFORM_INSTALLATION_READY: migrations and builds passed; configure the API service and complete owner bootstrap before use."
