#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/opt/free-ai"
cd "$ROOT"

[[ "$(id -u)" -eq 0 ]] || {
  echo "ERROR: Root shell required."
  exit 1
}

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".prelaunch-backups/layer-01-core-$STAMP"
mkdir -p "$BACKUP"

write_file() {
  local file="$1"
  mkdir -p "$(dirname "$file")"

  if [[ -f "$file" ]]; then
    mkdir -p "$BACKUP/$(dirname "$file")"
    cp -a "$file" "$BACKUP/$file"
  fi

  cat > "$file"
  echo "UPDATED: $file"
}

# ==================================================
# 1. DATABASE INFRASTRUCTURE
# ==================================================

write_file apps/api/src/infrastructure/database/prisma.ts <<'EOF'
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
EOF

write_file apps/api/src/infrastructure/database/transaction.ts <<'EOF'
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

export async function withTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(operation, {
    maxWait: 5000,
    timeout: 10000,
    isolationLevel: "Serializable"
  });
}
EOF

write_file apps/api/src/infrastructure/database/tenant-context.ts <<'EOF'
import { ForbiddenError } from "@free-ai/shared";

export interface RequestScope {
  userId: string;
  tenantId: string;
  projectId?: string;
}

export function validateScope(scope: RequestScope): void {
  if (!scope.userId || !scope.tenantId) {
    throw new ForbiddenError("Missing authenticated tenant scope");
  }
}
EOF

# ==================================================
# 2. IDENTITY SERVICE
# ==================================================

write_file apps/api/src/modules/identity/identity.service.ts <<'EOF'
import { prisma } from "../../infrastructure/database/prisma.js";
import { hashPassword } from "@free-ai/shared";

export interface RegisterIdentityInput {
  tenantId: string;
  email: string;
  username: string;
  password: string;
}

export async function registerIdentity(
  input: RegisterIdentityInput
) {
  if (!input.email.includes("@")) {
    throw new Error("Invalid email");
  }

  if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(input.username)) {
    throw new Error("Invalid username");
  }

  const passwordHash = await hashPassword(input.password);

  return prisma.user.create({
    data: {
      tenantId: input.tenantId,
      email: input.email.trim().toLowerCase(),
      username: input.username,
      passwordHash,
      status: "PENDING"
    },
    select: {
      id: true,
      tenantId: true,
      email: true,
      username: true,
      status: true,
      createdAt: true
    }
  });
}

export async function getIdentity(
  tenantId: string,
  userId: string
) {
  return prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: {
      id: true,
      tenantId: true,
      email: true,
      username: true,
      status: true,
      createdAt: true,
      updatedAt: true
    }
  });
}

export async function disableIdentity(
  tenantId: string,
  userId: string
) {
  return prisma.user.updateMany({
    where: { id: userId, tenantId },
    data: { status: "DISABLED" }
  });
}
EOF

# ==================================================
# 3. AUTHENTICATION SERVICE
# ==================================================

write_file apps/api/src/modules/authentication/authentication.service.ts <<'EOF'
import { prisma } from "../../infrastructure/database/prisma.js";
import {
  verifyPassword,
  ForbiddenError
} from "@free-ai/shared";
import { issueSessionToken } from "./session-token.js";

export async function authenticate(input: {
  tenantId: string;
  emailOrUsername: string;
  password: string;
  sessionTtlSeconds: number;
}) {
  const identifier = input.emailOrUsername.trim().toLowerCase();

  const user = await prisma.user.findFirst({
    where: {
      tenantId: input.tenantId,
      OR: [
        { email: identifier },
        { username: input.emailOrUsername }
      ]
    }
  });

  if (!user || user.status !== "ACTIVE") {
    throw new ForbiddenError("Invalid credentials");
  }

  const valid = await verifyPassword(
    input.password,
    user.passwordHash
  );

  if (!valid) {
    throw new ForbiddenError("Invalid credentials");
  }

  const issued = issueSessionToken();
  const expiresAt = new Date(
    Date.now() + input.sessionTtlSeconds * 1000
  );

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: issued.tokenHash,
      expiresAt
    }
  });

  return {
    token: issued.token,
    sessionId: session.id,
    expiresAt: expiresAt.toISOString(),
    userId: user.id
  };
}

export async function revokeSession(
  userId: string,
  sessionId: string
) {
  return prisma.session.updateMany({
    where: {
      id: sessionId,
      userId,
      revokedAt: null
    },
    data: { revokedAt: new Date() }
  });
}

export async function validateSession(tokenHash: string) {
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { }
  });

  if (
    !session ||
    session.revokedAt ||
    session.expiresAt.getTime() <= Date.now()
  ) {
    return null;
  }

  return session;
}
EOF

# ==================================================
# 4. AUTHORIZATION SERVICE
# ==================================================

write_file apps/api/src/modules/authorization/authorization.service.ts <<'EOF'
import { prisma } from "../../infrastructure/database/prisma.js";
import { ForbiddenError } from "@free-ai/shared";

export async function requirePermission(input: {
  tenantId: string;
  userId: string;
  resource: string;
  action: string;
}) {
  const assignments = await prisma.userRole.findMany({
    where: {
      userId: input.userId,
      role: { tenantId: input.tenantId }
    },
    include: {
      role: {
        include: {
          permissions: {
            include: { permission: true }
          }
        }
      }
    }
  });

  const permissions = assignments.flatMap((assignment) =>
    assignment.role.permissions.map((entry) => entry.permission)
  );

  const allowed = permissions.some(
    (permission) =>
      permission.resource === input.resource &&
      permission.action === input.action
  );

  if (!allowed) {
    throw new ForbiddenError("Required permission not granted");
  }
}
EOF

# ==================================================
# 5. SETTINGS SERVICE
# ==================================================

write_file apps/api/src/modules/settings/settings.service.ts <<'EOF'
import { prisma } from "../../infrastructure/database/prisma.js";

export async function readProjectSetting(
  tenantId: string,
  projectId: string,
  key: string
) {
  return prisma.setting.findFirst({
    where: { tenantId, projectId, key }
  });
}

export async function writeProjectSetting(input: {
  tenantId: string;
  projectId: string;
  key: string;
  value: unknown;
}) {
  const existing = await prisma.setting.findFirst({
    where: {
      tenantId: input.tenantId,
      projectId: input.projectId,
      key: input.key
    }
  });

  if (existing) {
    return prisma.setting.update({
      where: { id: existing.id },
      data: { value: input.value as object }
    });
  }

  return prisma.setting.create({
    data: {
      tenantId: input.tenantId,
      projectId: input.projectId,
      key: input.key,
      value: input.value as object
    }
  });
}
EOF

# ==================================================
# 6. AUDIT SERVICE
# ==================================================

write_file apps/api/src/modules/audit/audit.service.ts <<'EOF'
import { prisma } from "../../infrastructure/database/prisma.js";
import type { AuditOutcome } from "@free-ai/contracts";

export async function recordAudit(input: {
  actorId?: string;
  tenantId?: string;
  projectId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  outcome: AuditOutcome;
  correlationId: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      tenantId: input.tenantId,
      projectId: input.projectId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      outcome: input.outcome,
      correlationId: input.correlationId,
      metadata: input.metadata as object | undefined
    }
  });
}
EOF

# ==================================================
# 7. EVENT OUTBOX SERVICE
# ==================================================

write_file apps/api/src/modules/events/outbox.service.ts <<'EOF'
import { prisma } from "../../infrastructure/database/prisma.js";

export async function enqueueEvent(input: {
  type: string;
  tenantId?: string;
  projectId?: string;
  payload: object;
  correlationId: string;
}) {
  return prisma.outboxEvent.create({
    data: {
      type: input.type,
      tenantId: input.tenantId,
      projectId: input.projectId,
      payload: input.payload,
      correlationId: input.correlationId
    }
  });
}

export async function getPendingEvents(limit = 50) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new Error("Invalid event batch size");
  }

  return prisma.outboxEvent.findMany({
    where: { publishedAt: null },
    orderBy: { occurredAt: "asc" },
    take: limit
  });
}
EOF

# ==================================================
# 8. SECURITY MIDDLEWARE PRIMITIVES
# ==================================================

write_file apps/api/src/middleware/tenant.middleware.ts <<'EOF'
import { validateScope } from "../infrastructure/database/tenant-context.js";

export function requireTenantScope(input: {
  userId?: string;
  tenantId?: string;
  projectId?: string;
}) {
  if (!input.userId || !input.tenantId) {
    throw new Error("Unauthenticated tenant scope");
  }

  const scope = {
    userId: input.userId,
    tenantId: input.tenantId,
    ...(input.projectId ? { projectId: input.projectId } : {})
  };

  validateScope(scope);
  return scope;
}
EOF

write_file apps/api/src/middleware/authentication.middleware.ts <<'EOF'
import { createHash } from "node:crypto";
import { validateSession } from "../modules/authentication/authentication.service.js";

export async function authenticateBearerToken(
  authorization: string | undefined
) {
  if (!authorization?.startsWith("Bearer ")) return null;

  const token = authorization.slice(7);

  if (!token || token.length > 512) return null;

  const tokenHash = createHash("sha256")
    .update(token)
    .digest("hex");

  return validateSession(tokenHash);
}
EOF

# ==================================================
# 9. SECURITY DATABASE POLICIES
# ==================================================

mkdir -p apps/api/prisma/migrations/0001_layer01_security

write_file apps/api/prisma/migrations/0001_layer01_security/migration.sql <<'EOF'
-- Enable PostgreSQL row-level security on tenant-owned tables.
-- Policies are intentionally not activated until the application
-- sets verified transaction-local scope variables.

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Setting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Secret" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StoredObject" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Project" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Setting" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Secret" FORCE ROW LEVEL SECURITY;
ALTER TABLE "StoredObject" FORCE ROW LEVEL SECURITY;

CREATE POLICY user_tenant_isolation ON "User"
USING (
  "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
)
WITH CHECK (
  "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
);

CREATE POLICY project_tenant_isolation ON "Project"
USING (
  "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
)
WITH CHECK (
  "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
);

CREATE POLICY setting_tenant_isolation ON "Setting"
USING (
  "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
)
WITH CHECK (
  "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
);

CREATE POLICY secret_tenant_isolation ON "Secret"
USING (
  "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
)
WITH CHECK (
  "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
);

CREATE POLICY stored_object_tenant_isolation ON "StoredObject"
USING (
  "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
)
WITH CHECK (
  "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
);
EOF

# ==================================================
# 10. VALIDATION
# ==================================================

write_file scripts/check-layer-01-core.mjs <<'EOF'
import fs from "node:fs";

const required = [
  "apps/api/src/infrastructure/database/prisma.ts",
  "apps/api/src/infrastructure/database/transaction.ts",
  "apps/api/src/infrastructure/database/tenant-context.ts",
  "apps/api/src/modules/identity/identity.service.ts",
  "apps/api/src/modules/authentication/authentication.service.ts",
  "apps/api/src/modules/authorization/authorization.service.ts",
  "apps/api/src/modules/settings/settings.service.ts",
  "apps/api/src/modules/audit/audit.service.ts",
  "apps/api/src/modules/events/outbox.service.ts",
  "apps/api/src/middleware/authentication.middleware.ts",
  "apps/api/src/middleware/tenant.middleware.ts",
  "apps/api/prisma/migrations/0001_layer01_security/migration.sql"
];

const errors = required.filter(
  (file) => !fs.existsSync(file) || fs.statSync(file).size === 0
);

if (errors.length) {
  console.error("CORE VALIDATION FAILED");
  errors.forEach((file) => console.error(`INVALID: ${file}`));
  process.exit(1);
}

console.log("CORE STRUCTURE VALIDATION PASSED");
console.log(`Validated ${required.length} files.`);
EOF

node -e '
const fs = require("node:fs");
const p = JSON.parse(fs.readFileSync("package.json", "utf8"));
p.scripts = {
  ...p.scripts,
  "check:layer-01:core": "node scripts/check-layer-01-core.mjs"
};
fs.writeFileSync("package.json", JSON.stringify(p, null, 2) + "\n");
'

echo
echo "========== CORE VALIDATION =========="
node scripts/check-layer-01-core.mjs

echo
echo "========== ORIGINAL LAYER VALIDATION =========="
node scripts/check-layer-01.mjs

echo
echo "========== GIT DIFF CHECK =========="
git diff --check

echo
echo "LAYER 01 CORE SERVICES GENERATED"
echo "Backup: $BACKUP"
echo "No database migration executed."
echo "No dependencies installed."
echo "No services started."
