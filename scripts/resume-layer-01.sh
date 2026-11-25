#!/usr/bin/env bash
set -uo pipefail

cd /opt/free-ai || exit 1

STAMP="$(date +%Y%m%d-%H%M%S)"
REPORT="docs/22-layer-01/FINAL-REPORT-$STAMP.txt"
MIGRATION="apps/api/prisma/migrations/0001_layer01_security/migration.sql"
SCHEMA="apps/api/prisma/schema.prisma"

mkdir -p docs/22-layer-01
mkdir -p apps/api/prisma/migrations/0001_layer01_security
mkdir -p tests/layer-01

# Temporary URL for Prisma CLI configuration and generation only.
# No database connection is performed by validate, generate or diff.
export DATABASE_URL="postgresql://127.0.0.1:5432/freeai?schema=public"

PASS=0
FAIL=0
BLOCKED=0

run_check() {
  local name="$1"
  shift

  echo
  echo "========== $name ==========" | tee -a "$REPORT"

  if "$@" 2>&1 | tee -a "$REPORT"; then
    echo "[PASS] $name" | tee -a "$REPORT"
    PASS=$((PASS + 1))
  else
    local status=$?
    echo "[FAIL] $name (exit $status)" | tee -a "$REPORT"
    FAIL=$((FAIL + 1))
  fi
}

run_blocked() {
  echo "[BLOCKED] $1" | tee -a "$REPORT"
  BLOCKED=$((BLOCKED + 1))
}

{
  echo "FREE AI — LAYER 01 RESUME REPORT"
  echo "Timestamp: $STAMP"
  echo "Project: /opt/free-ai"
  echo "Database URL: temporary local placeholder; no DB connection"
} > "$REPORT"

echo "=================================================="
echo "FREE AI — RESUME LAYER 01"
echo "=================================================="

# 1. Validate schema before generating anything.
if pnpm exec prisma validate --schema "$SCHEMA" 2>&1 | tee -a "$REPORT"; then
  echo "[PASS] Prisma schema validation" | tee -a "$REPORT"
  PASS=$((PASS + 1))
else
  echo "[FAIL] Prisma schema validation" | tee -a "$REPORT"
  FAIL=$((FAIL + 1))
fi

# 2. Generate Prisma Client.
if [ "$FAIL" -eq 0 ]; then
  run_check "PRISMA CLIENT GENERATION" \
    pnpm exec prisma generate --schema "$SCHEMA"
else
  run_blocked "Prisma Client generation: schema validation failed"
fi

# 3. Generate a fresh initial migration from the actual schema.
if [ "$FAIL" -eq 0 ]; then
  echo
  echo "========== GENERATE INITIAL MIGRATION =========="

  TEMP_SQL="$(mktemp)"

  if pnpm exec prisma migrate diff \
    --from-empty \
    --to-schema-datamodel "$SCHEMA" \
    --script > "$TEMP_SQL" 2>> "$REPORT"; then

    if [ -s "$TEMP_SQL" ]; then
      cp "$TEMP_SQL" "$MIGRATION"

      cat >> "$MIGRATION" <<'SQL'

-- ==========================================================
-- FREE AI: TENANT AND PROJECT ROW LEVEL SECURITY
-- ==========================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE stored_objects ENABLE ROW LEVEL SECURITY;

ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE roles FORCE ROW LEVEL SECURITY;
ALTER TABLE permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE user_roles FORCE ROW LEVEL SECURITY;
ALTER TABLE role_permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE settings FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE outbox_events FORCE ROW LEVEL SECURITY;
ALTER TABLE secrets FORCE ROW LEVEL SECURITY;
ALTER TABLE stored_objects FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON tenants
USING (
  id::text = current_setting('app.tenant_id', true)
)
WITH CHECK (
  id::text = current_setting('app.tenant_id', true)
);

CREATE POLICY project_tenant_isolation ON projects
USING (
  tenant_id::text = current_setting('app.tenant_id', true)
  AND (
    current_setting('app.project_id', true) = ''
    OR id::text = current_setting('app.project_id', true)
  )
)
WITH CHECK (
  tenant_id::text = current_setting('app.tenant_id', true)
);

CREATE POLICY users_tenant_isolation ON users
USING (
  tenant_id::text = current_setting('app.tenant_id', true)
)
WITH CHECK (
  tenant_id::text = current_setting('app.tenant_id', true)
);

CREATE POLICY sessions_tenant_isolation ON sessions
USING (
  tenant_id::text = current_setting('app.tenant_id', true)
)
WITH CHECK (
  tenant_id::text = current_setting('app.tenant_id', true)
);

CREATE POLICY roles_tenant_isolation ON roles
USING (
  tenant_id::text = current_setting('app.tenant_id', true)
)
WITH CHECK (
  tenant_id::text = current_setting('app.tenant_id', true)
);

CREATE POLICY permissions_tenant_isolation ON permissions
USING (
  tenant_id::text = current_setting('app.tenant_id', true)
)
WITH CHECK (
  tenant_id::text = current_setting('app.tenant_id', true)
);

CREATE POLICY user_roles_tenant_isolation ON user_roles
USING (
  tenant_id::text = current_setting('app.tenant_id', true)
)
WITH CHECK (
  tenant_id::text = current_setting('app.tenant_id', true)
);

CREATE POLICY role_permissions_tenant_isolation ON role_permissions
USING (
  tenant_id::text = current_setting('app.tenant_id', true)
)
WITH CHECK (
  tenant_id::text = current_setting('app.tenant_id', true)
);

CREATE POLICY settings_scope_isolation ON settings
USING (
  tenant_id::text = current_setting('app.tenant_id', true)
  AND (
    project_id IS NULL
    OR project_id::text = current_setting('app.project_id', true)
  )
)
WITH CHECK (
  tenant_id::text = current_setting('app.tenant_id', true)
  AND (
    project_id IS NULL
    OR project_id::text = current_setting('app.project_id', true)
  )
);

CREATE POLICY audit_scope_isolation ON audit_logs
USING (
  tenant_id::text = current_setting('app.tenant_id', true)
  AND (
    project_id IS NULL
    OR project_id::text = current_setting('app.project_id', true)
  )
)
WITH CHECK (
  tenant_id::text = current_setting('app.tenant_id', true)
);

CREATE POLICY outbox_scope_isolation ON outbox_events
USING (
  tenant_id::text = current_setting('app.tenant_id', true)
  AND (
    project_id IS NULL
    OR project_id::text = current_setting('app.project_id', true)
  )
)
WITH CHECK (
  tenant_id::text = current_setting('app.tenant_id', true)
);

CREATE POLICY secrets_scope_isolation ON secrets
USING (
  tenant_id::text = current_setting('app.tenant_id', true)
  AND (
    project_id IS NULL
    OR project_id::text = current_setting('app.project_id', true)
  )
)
WITH CHECK (
  tenant_id::text = current_setting('app.tenant_id', true)
);

CREATE POLICY stored_objects_scope_isolation ON stored_objects
USING (
  tenant_id::text = current_setting('app.tenant_id', true)
  AND (
    project_id IS NULL
    OR project_id::text = current_setting('app.project_id', true)
  )
)
WITH CHECK (
  tenant_id::text = current_setting('app.tenant_id', true)
);

CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Audit records are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
SQL

      echo "[PASS] Migration generated from Prisma schema" | tee -a "$REPORT"
      echo "Migration lines: $(wc -l < "$MIGRATION")" | tee -a "$REPORT"
      PASS=$((PASS + 1))
    else
      echo "[FAIL] Generated migration is empty" | tee -a "$REPORT"
      FAIL=$((FAIL + 1))
    fi
  else
    echo "[FAIL] Migration generation failed" | tee -a "$REPORT"
    FAIL=$((FAIL + 1))
  fi

  rm -f "$TEMP_SQL"
else
  run_blocked "Migration generation: schema validation failed"
fi

# 4. Security and primitive tests.
cat > tests/layer-01/security.test.ts <<'EOF'
import { describe, expect, it, beforeEach } from "vitest";
import {
  encryptSecret,
  decryptSecret,
} from "../../apps/api/src/modules/secrets/encryption";
import {
  validateStoredObject,
  DEFAULT_STORAGE_POLICY,
} from "../../apps/api/src/modules/storage/storage-policy";
import { buildHealthStatus } from "../../apps/api/src/modules/observability/health";
import { requireTenantScope } from "../../apps/api/src/middleware/tenant.middleware";

beforeEach(() => {
  process.env.SECRETS_MASTER_KEY =
    Buffer.alloc(32, 7).toString("base64");
  process.env.SECRETS_KEY_VERSION = "test-v1";
});

describe("Layer 01 security primitives", () => {
  it("encrypts and decrypts secrets", () => {
    const encrypted = encryptSecret("sensitive-value");
    expect(encrypted.ciphertext).not.toBe("sensitive-value");
    expect(decryptSecret(encrypted)).toBe("sensitive-value");
  });

  it("rejects tampered authentication tags", () => {
    const encrypted = encryptSecret("secret");
    expect(() => decryptSecret({
      ...encrypted,
      authTag: Buffer.alloc(16, 1).toString("base64"),
    })).toThrow();
  });

  it("rejects disallowed file types", () => {
    expect(() =>
      validateStoredObject("application/x-executable", 100),
    ).toThrow();
  });

  it("rejects oversized files", () => {
    expect(() =>
      validateStoredObject(
        "application/pdf",
        DEFAULT_STORAGE_POLICY.maxBytes + 1,
      ),
    ).toThrow();
  });

  it("accepts allowed file types and sizes", () => {
    expect(() =>
      validateStoredObject("application/pdf", 1024),
    ).not.toThrow();
  });

  it("requires tenant scope", () => {
    expect(() => requireTenantScope(undefined)).toThrow();
    expect(() => requireTenantScope({})).toThrow();
  });

  it("normalizes optional scope values", () => {
    const scope = requireTenantScope({ tenantId: "tenant-id" });
    expect(scope.projectId).toBeNull();
    expect(scope.userId).toBeNull();
  });

  it("reports healthy when all checks pass", () => {
    expect(buildHealthStatus({
      database: true,
      storage: true,
    }).status).toBe("healthy");
  });

  it("reports degraded for mixed checks", () => {
    expect(buildHealthStatus({
      database: true,
      storage: false,
    }).status).toBe("degraded");
  });
});
EOF

cat > tests/layer-01/schema-structure.test.ts <<'EOF'
import { describe, expect, it } from "vitest";
import fs from "node:fs";

const schema = fs.readFileSync(
  "apps/api/prisma/schema.prisma",
  "utf8",
);

describe("Prisma schema", () => {
  for (const model of [
    "Tenant", "Project", "User", "Session",
    "Role", "Permission", "UserRole", "RolePermission",
    "Setting", "AuditLog", "OutboxEvent",
    "Secret", "StoredObject",
  ]) {
    it(`contains model ${model}`, () => {
      expect(schema).toMatch(
        new RegExp(`model\\s+${model}\\s*\\{`),
      );
    });
  }

  it("defines Prisma relations", () => {
    expect(schema).toContain("@relation");
  });

  it("uses PostgreSQL", () => {
    expect(schema).toContain('provider = "postgresql"');
  });

  it("contains tenant and project scopes", () => {
    expect(schema).toContain("tenantId");
    expect(schema).toContain("projectId");
  });
});
EOF

cat > tests/layer-01/migration-security.test.ts <<'EOF'
import { describe, expect, it } from "vitest";
import fs from "node:fs";

const migration = fs.readFileSync(
  "apps/api/prisma/migrations/0001_layer01_security/migration.sql",
  "utf8",
);

describe("Database migration security", () => {
  it("enables row level security", () => {
    expect(migration).toMatch(/ENABLE ROW LEVEL SECURITY/i);
  });

  it("forces row level security", () => {
    expect(migration).toMatch(/FORCE ROW LEVEL SECURITY/i);
  });

  it("uses tenant context", () => {
    expect(migration).toContain("app.tenant_id");
  });

  it("uses project context", () => {
    expect(migration).toContain("app.project_id");
  });

  it("defines policies", () => {
    expect(migration).toMatch(/CREATE POLICY/i);
  });

  it("protects audit records against update and delete", () => {
    expect(migration).toContain("audit_logs_immutable");
    expect(migration).toContain("prevent_audit_mutation");
  });
});
EOF

# 5. Run independent checks even if one fails.
if [ "$FAIL" -eq 0 ]; then
  run_check "PRISMA VALIDATION" \
    pnpm exec prisma validate --schema "$SCHEMA"

  run_check "PRISMA CLIENT GENERATION" \
    pnpm exec prisma generate --schema "$SCHEMA"
else
  run_blocked "Prisma checks blocked by migration/schema generation failure"
fi

run_check "TYPESCRIPT TYPECHECK" \
  pnpm exec tsc --noEmit -p apps/api/tsconfig.json

run_check "LAYER 01 UNIT TESTS" \
  pnpm exec vitest run tests/layer-01

run_check "GIT DIFF CHECK" \
  git diff --check

echo
echo "========== MIGRATION INVENTORY ==========" | tee -a "$REPORT"
wc -l "$MIGRATION" 2>&1 | tee -a "$REPORT"

echo
echo "========== SOURCE INVENTORY ==========" | tee -a "$REPORT"
find apps/api/src -type f -name '*.ts' | sort | tee -a "$REPORT"

echo
echo "========== TEST INVENTORY ==========" | tee -a "$REPORT"
find tests/layer-01 -maxdepth 2 -type f | sort | tee -a "$REPORT"

echo
echo "========== GIT STATUS ==========" | tee -a "$REPORT"
git status --short --branch 2>&1 | tee -a "$REPORT"

echo
echo "========== FINAL SUMMARY ==========" | tee -a "$REPORT"
echo "PASS: $PASS" | tee -a "$REPORT"
echo "FAIL: $FAIL" | tee -a "$REPORT"
echo "BLOCKED: $BLOCKED" | tee -a "$REPORT"
echo "REPORT: $REPORT" | tee -a "$REPORT"

if [ "$FAIL" -eq 0 ] && [ "$BLOCKED" -eq 0 ]; then
  echo "RESULT: LOCAL STATIC AND UNIT CHECKS PASSED" | tee -a "$REPORT"
  exit 0
else
  echo "RESULT: NOT ACCEPTED — REVIEW FAILURES" | tee -a "$REPORT"
  exit 1
fi
