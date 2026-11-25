#!/usr/bin/env bash
set -Eeuo pipefail

cd /opt/free-ai

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".repair-backups/layer-01-types-$STAMP"

mkdir -p "$BACKUP"

echo "=================================================="
echo "FREE AI — LAYER 01 TYPESCRIPT REPAIR"
echo "=================================================="

# 1. Backup
for f in \
  apps/api/package.json \
  apps/api/tsconfig.json \
  apps/api/src/modules/audit/audit.service.ts \
  apps/api/src/modules/events/outbox.service.ts \
  apps/api/src/modules/authentication/authentication.service.ts
do
  if [ -f "$f" ]; then
    mkdir -p "$BACKUP/$(dirname "$f")"
    cp -a "$f" "$BACKUP/$f"
  fi
done

echo "[PASS] Backup created: $BACKUP"

# 2. Register internal workspace packages and correct monorepo rootDir
python3 <<'PY'
import json
from pathlib import Path

api_package = Path("apps/api/package.json")
data = json.loads(api_package.read_text())

dependencies = data.setdefault("dependencies", {})
dependencies["@free-ai/contracts"] = "workspace:*"
dependencies["@free-ai/shared"] = "workspace:*"

api_package.write_text(
    json.dumps(data, indent=2) + "\n"
)

tsconfig_path = Path("apps/api/tsconfig.json")
config = json.loads(tsconfig_path.read_text())

compiler = config.setdefault("compilerOptions", {})
compiler["rootDir"] = "../.."

tsconfig_path.write_text(
    json.dumps(config, indent=2) + "\n"
)

print("[PASS] Workspace dependencies and TypeScript rootDir updated")
PY

# 3. Add safe Prisma JSON conversion helper
mkdir -p apps/api/src/infrastructure/database

cat > apps/api/src/infrastructure/database/prisma-json.ts <<'TS'
import type { Prisma } from "@prisma/client";

/**
 * Converts serializable application data into a Prisma JSON input value.
 * JSON serialization also rejects circular references and unsupported
 * top-level values instead of silently passing invalid database input.
 */
export function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  const serialized = JSON.stringify(value);

  if (serialized === undefined) {
    throw new TypeError("Value cannot be represented as JSON");
  }

  return JSON.parse(serialized) as Prisma.InputJsonValue;
}
TS

echo "[PASS] Prisma JSON conversion helper created"

# 4. Fix audit service
python3 <<'PY'
from pathlib import Path

p = Path("apps/api/src/modules/audit/audit.service.ts")
s = p.read_text()

if 'from "../../infrastructure/database/prisma-json"' not in s:
    s = s.replace(
        'import { prisma } from "../../infrastructure/database/prisma";',
        'import { prisma } from "../../infrastructure/database/prisma";\n'
        'import { toPrismaJson } from "../../infrastructure/database/prisma-json";'
    )

old = '        metadata: input.metadata as object | undefined,'
new = '''        ...(input.metadata !== undefined
          ? { metadata: toPrismaJson(input.metadata) }
          : {}),'''

if old in s:
    s = s.replace(old, new)
elif new not in s:
    raise SystemExit("Could not locate audit metadata expression; no further changes made.")

p.write_text(s)
print("[PASS] Audit JSON handling fixed")
PY

# 5. Fix outbox service
python3 <<'PY'
from pathlib import Path

p = Path("apps/api/src/modules/events/outbox.service.ts")
s = p.read_text()

if 'from "../../infrastructure/database/prisma-json"' not in s:
    s = s.replace(
        'import { prisma } from "../../infrastructure/database/prisma";',
        'import { prisma } from "../../infrastructure/database/prisma";\n'
        'import { toPrismaJson } from "../../infrastructure/database/prisma-json";'
    )

old = '        payload,'
new = '        payload: toPrismaJson(payload),'

if old in s:
    s = s.replace(old, new, 1)
elif new not in s:
    raise SystemExit("Could not locate outbox payload expression.")

p.write_text(s)
print("[PASS] Outbox JSON handling fixed")
PY

# 6. Fix optional nullable session fields
python3 <<'PY'
from pathlib import Path

p = Path("apps/api/src/modules/authentication/authentication.service.ts")
s = p.read_text()

s = s.replace(
    "        ipAddress: options.ipAddress,",
    "        ipAddress: options.ipAddress ?? null,"
)
s = s.replace(
    "        userAgent: options.userAgent,",
    "        userAgent: options.userAgent ?? null,"
)

if "ipAddress: options.ipAddress," in s or "userAgent: options.userAgent," in s:
    raise SystemExit("Optional session fields were not fully corrected.")

p.write_text(s)
print("[PASS] Authentication optional fields fixed")
PY

# 7. Link workspace packages without downloading dependencies
echo
echo "========== PNPM WORKSPACE INSTALL =========="
pnpm install --offline

# 8. Prisma validation and client generation
echo
echo "========== PRISMA VALIDATION =========="
export DATABASE_URL="postgresql://127.0.0.1:5432/freeai?schema=public"
pnpm exec prisma validate --schema apps/api/prisma/schema.prisma

echo
echo "========== PRISMA CLIENT GENERATION =========="
pnpm exec prisma generate --schema apps/api/prisma/schema.prisma

# 9. TypeScript
echo
echo "========== TYPESCRIPT TYPECHECK =========="
pnpm typecheck

# 10. Unit tests
echo
echo "========== LAYER 01 TESTS =========="
pnpm test:layer-01

# 11. Diff validation
echo
echo "========== GIT DIFF CHECK =========="
git diff --check

echo
echo "=================================================="
echo "REPAIR COMMANDS COMPLETED"
echo "Backup: $BACKUP"
echo "=================================================="
