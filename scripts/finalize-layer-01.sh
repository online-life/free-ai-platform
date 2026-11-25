#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/opt/free-ai"
cd "$ROOT"

echo "=================================================="
echo " FREE AI — LAYER 01 FINALIZATION"
echo "=================================================="

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.repair-backups/layer-01-$STAMP"

mkdir -p "$BACKUP"
mkdir -p apps/api/prisma/migrations/0001_layer01_security
mkdir -p apps/api/src/infrastructure/database
mkdir -p apps/api/src/modules/{identity,authentication,authorization,settings,audit,events,secrets,storage,observability,projects}
mkdir -p apps/api/src/middleware
mkdir -p tests/layer-01

echo "[1/12] Backing up files..."

for file in \
  package.json \
  pnpm-workspace.yaml \
  tsconfig.base.json \
  apps/api/package.json \
  apps/api/tsconfig.json \
  apps/api/prisma/schema.prisma \
  apps/api/prisma/migrations/0001_layer01_security/migration.sql \
  apps/api/src/infrastructure/database/prisma.ts \
  apps/api/src/infrastructure/database/transaction.ts \
  apps/api/src/infrastructure/database/tenant-context.ts \
  apps/api/src/modules/identity/identity.service.ts \
  apps/api/src/modules/authentication/authentication.service.ts \
  apps/api/src/modules/authorization/authorization.service.ts \
  apps/api/src/modules/settings/settings.service.ts \
  apps/api/src/modules/audit/audit.service.ts \
  apps/api/src/modules/events/outbox.service.ts \
  apps/api/src/modules/secrets/encryption.ts \
  apps/api/src/modules/storage/storage-policy.ts \
  apps/api/src/modules/observability/health.ts
do
  if [ -f "$file" ]; then
    mkdir -p "$BACKUP/$(dirname "$file")"
    cp -a "$file" "$BACKUP/$file"
  fi
done

echo "[2/12] Writing workspace configuration..."

cat > package.json <<'EOF'
{
  "name": "free-ai-platform",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "typecheck": "tsc --noEmit -p apps/api/tsconfig.json",
    "test:layer-01": "vitest run tests/layer-01",
    "test:watch": "vitest tests/layer-01",
    "prisma:validate": "prisma validate --schema apps/api/prisma/schema.prisma",
    "prisma:generate": "prisma generate --schema apps/api/prisma/schema.prisma",
    "check:layer-01": "pnpm prisma:validate && pnpm typecheck && pnpm test:layer-01"
  },
  "devDependencies": {
    "@types/node": "^22.15.0",
    "prisma": "6.19.0",
    "typescript": "^5.8.3",
    "vitest": "^3.2.4"
  },
  "dependencies": {
    "@prisma/client": "6.19.0",
    "zod": "^3.25.0"
  }
}
EOF

cat > pnpm-workspace.yaml <<'EOF'
packages:
  - "apps/*"
  - "packages/*"
  - "services/*"
EOF

cat > tsconfig.base.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
EOF

cat > apps/api/package.json <<'EOF'
{
  "name": "@free-ai/api",
  "version": "0.1.0",
  "private": true,
  "main": "dist/main.js",
  "types": "dist/main.d.ts"
}
EOF

cat > apps/api/tsconfig.json <<'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "types": ["node"],
    "noEmit": true
  },
  "include": ["src/**/*.ts"]
}
EOF

echo "[3/12] Writing complete Prisma schema..."

cat > apps/api/prisma/schema.prisma <<'EOF'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Tenant {
  id        String   @id @default(uuid()) @db.Uuid
  name      String
  slug      String   @unique
  status    String   @default("ACTIVE")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  projects     Project[]
  users        User[]
  sessions     Session[]
  roles        Role[]
  permissions  Permission[]
  userRoles    UserRole[]
  rolePermissions RolePermission[]
  settings     Setting[]
  auditLogs    AuditLog[]
  outboxEvents OutboxEvent[]
  secrets      Secret[]
  storedObjects StoredObject[]

  @@map("tenants")
}

model Project {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @db.Uuid @map("tenant_id")
  name      String
  slug      String
  status    String   @default("ACTIVE")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  tenant       Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  settings     Setting[]
  auditLogs    AuditLog[]
  outboxEvents OutboxEvent[]
  secrets      Secret[]
  storedObjects StoredObject[]

  @@unique([tenantId, slug])
  @@index([tenantId])
  @@map("projects")
}

model User {
  id            String   @id @default(uuid()) @db.Uuid
  tenantId      String   @db.Uuid @map("tenant_id")
  email         String
  normalizedEmail String @map("normalized_email")
  username      String
  normalizedUsername String @map("normalized_username")
  passwordHash  String   @map("password_hash")
  status        String   @default("ACTIVE")
  emailVerifiedAt DateTime? @map("email_verified_at")
  mfaEnabled    Boolean  @default(false) @map("mfa_enabled")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  tenant    Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  sessions  Session[]
  userRoles UserRole[]

  @@unique([tenantId, normalizedEmail])
  @@unique([tenantId, normalizedUsername])
  @@index([tenantId, status])
  @@map("users")
}

model Session {
  id          String   @id @default(uuid()) @db.Uuid
  tenantId    String   @db.Uuid @map("tenant_id")
  userId      String   @db.Uuid @map("user_id")
  tokenHash   String   @unique @map("token_hash")
  expiresAt   DateTime @map("expires_at")
  revokedAt   DateTime? @map("revoked_at")
  ipAddress   String?  @map("ip_address")
  userAgent   String?  @map("user_agent")
  createdAt   DateTime @default(now()) @map("created_at")
  lastUsedAt  DateTime? @map("last_used_at")

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([tenantId, userId])
  @@index([expiresAt])
  @@map("sessions")
}

model Role {
  id          String   @id @default(uuid()) @db.Uuid
  tenantId    String   @db.Uuid @map("tenant_id")
  name        String
  description String?
  createdAt   DateTime @default(now()) @map("created_at")

  tenant      Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  userRoles   UserRole[]
  permissions RolePermission[]

  @@unique([tenantId, name])
  @@index([tenantId])
  @@map("roles")
}

model Permission {
  id          String   @id @default(uuid()) @db.Uuid
  tenantId    String   @db.Uuid @map("tenant_id")
  key         String
  description String?
  createdAt   DateTime @default(now()) @map("created_at")

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  roles  RolePermission[]

  @@unique([tenantId, key])
  @@index([tenantId])
  @@map("permissions")
}

model UserRole {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @db.Uuid @map("tenant_id")
  userId    String   @db.Uuid @map("user_id")
  roleId    String   @db.Uuid @map("role_id")
  createdAt DateTime @default(now()) @map("created_at")

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  role   Role   @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@unique([tenantId, userId, roleId])
  @@index([tenantId, userId])
  @@index([tenantId, roleId])
  @@map("user_roles")
}

model RolePermission {
  id           String   @id @default(uuid()) @db.Uuid
  tenantId     String   @db.Uuid @map("tenant_id")
  roleId       String   @db.Uuid @map("role_id")
  permissionId String   @db.Uuid @map("permission_id")
  effect       String   @default("ALLOW")
  createdAt    DateTime @default(now()) @map("created_at")

  tenant     Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@unique([tenantId, roleId, permissionId])
  @@index([tenantId, roleId])
  @@map("role_permissions")
}

model Setting {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @db.Uuid @map("tenant_id")
  projectId String?  @db.Uuid @map("project_id")
  key       String
  value     Json
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  tenant  Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  project Project? @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([tenantId, projectId])
  @@map("settings")
}

model AuditLog {
  id           String   @id @default(uuid()) @db.Uuid
  tenantId     String   @db.Uuid @map("tenant_id")
  projectId    String?  @db.Uuid @map("project_id")
  actorUserId  String?  @map("actor_user_id")
  action       String
  resourceType String   @map("resource_type")
  resourceId   String?  @map("resource_id")
  correlationId String  @map("correlation_id")
  metadata     Json?
  createdAt    DateTime @default(now()) @map("created_at")

  tenant  Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  project Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)

  @@index([tenantId, createdAt])
  @@index([tenantId, projectId, createdAt])
  @@index([correlationId])
  @@map("audit_logs")
}

model OutboxEvent {
  id          String   @id @default(uuid()) @db.Uuid
  tenantId    String   @db.Uuid @map("tenant_id")
  projectId   String?  @db.Uuid @map("project_id")
  eventType   String   @map("event_type")
  payload     Json
  status      String   @default("PENDING")
  attempts    Int      @default(0)
  availableAt DateTime @default(now()) @map("available_at")
  lockedAt    DateTime? @map("locked_at")
  processedAt DateTime? @map("processed_at")
  lastError   String?  @map("last_error")
  createdAt   DateTime @default(now()) @map("created_at")

  tenant  Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  project Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)

  @@index([status, availableAt])
  @@index([tenantId, createdAt])
  @@map("outbox_events")
}

model Secret {
  id             String   @id @default(uuid()) @db.Uuid
  tenantId       String   @db.Uuid @map("tenant_id")
  projectId      String?  @db.Uuid @map("project_id")
  name           String
  ciphertext     String
  iv             String
  authTag        String   @map("auth_tag")
  keyVersion     String   @map("key_version")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  tenant  Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  project Project? @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([tenantId, projectId, name])
  @@index([tenantId, projectId])
  @@map("secrets")
}

model StoredObject {
  id           String   @id @default(uuid()) @db.Uuid
  tenantId     String   @db.Uuid @map("tenant_id")
  projectId    String?  @db.Uuid @map("project_id")
  storageKey   String   @unique @map("storage_key")
  originalName String   @map("original_name")
  mimeType     String   @map("mime_type")
  sizeBytes    BigInt   @map("size_bytes")
  checksum     String?
  status       String   @default("QUARANTINED")
  createdAt    DateTime @default(now()) @map("created_at")

  tenant  Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  project Project? @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([tenantId, projectId])
  @@map("stored_objects")
}
EOF

echo "[4/12] Writing database infrastructure..."

cat > apps/api/src/infrastructure/database/prisma.ts <<'EOF'
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development"
      ? ["warn", "error"]
      : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
EOF

cat > apps/api/src/infrastructure/database/tenant-context.ts <<'EOF'
import type { Prisma } from "@prisma/client";

export interface RequestScope {
  tenantId: string;
  projectId?: string | null;
  userId?: string | null;
}

function validateUuid(value: string, field: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`Invalid ${field}`);
  }
}

export async function applyDatabaseScope(
  tx: Prisma.TransactionClient,
  scope: RequestScope,
): Promise<void> {
  validateUuid(scope.tenantId, "tenantId");

  if (scope.projectId) validateUuid(scope.projectId, "projectId");
  if (scope.userId) validateUuid(scope.userId, "userId");

  await tx.$executeRaw`
    SELECT
      set_config('app.tenant_id', ${scope.tenantId}, true),
      set_config('app.project_id', ${scope.projectId ?? ""}, true),
      set_config('app.user_id', ${scope.userId ?? ""}, true)
  `;
}
EOF

cat > apps/api/src/infrastructure/database/transaction.ts <<'EOF'
import { prisma } from "./prisma";
import {
  applyDatabaseScope,
  type RequestScope,
} from "./tenant-context";

export async function withTenantTransaction<T>(
  scope: RequestScope,
  operation: Parameters<typeof prisma.$transaction>[0] extends never
    ? never
    : (tx: any) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await applyDatabaseScope(tx, scope);
    return operation(tx);
  }, {
    maxWait: 5000,
    timeout: 15000,
    isolationLevel: "ReadCommitted",
  }) as Promise<T>;
}
EOF

echo "[5/12] Writing identity and authentication..."

cat > apps/api/src/modules/identity/identity.service.ts <<'EOF'
import { prisma } from "../../infrastructure/database/prisma";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export interface CreateIdentityInput {
  tenantId: string;
  email: string;
  username: string;
  password: string;
}

async function hashPassword(password: string): Promise<string> {
  if (password.length < 12) {
    throw new Error("Password must contain at least 12 characters");
  }

  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64) as Buffer;

  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export class IdentityService {
  async create(input: CreateIdentityInput) {
    const email = input.email.trim().toLowerCase();
    const username = input.username.trim();
    const normalizedUsername = username.toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Invalid email");
    }

    if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(username)) {
      throw new Error("Invalid username");
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: input.tenantId },
      select: { id: true, status: true },
    });

    if (!tenant || tenant.status !== "ACTIVE") {
      throw new Error("Tenant is unavailable");
    }

    const passwordHash = await hashPassword(input.password);

    return prisma.user.create({
      data: {
        tenantId: input.tenantId,
        email,
        normalizedEmail: email,
        username,
        normalizedUsername,
        passwordHash,
      },
      select: {
        id: true,
        tenantId: true,
        email: true,
        username: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async disable(tenantId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.updateMany({
        where: { id: userId, tenantId },
        data: { status: "DISABLED" },
      });

      await tx.session.updateMany({
        where: { tenantId, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      return { disabled: user.count === 1 };
    });
  }
}
EOF

cat > apps/api/src/modules/authentication/authentication.service.ts <<'EOF'
import { prisma } from "../../infrastructure/database/prisma";
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, salt, expectedHex] = encoded.split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;

  const expected = Buffer.from(expectedHex, "hex");
  const actual = await scrypt(password, salt, expected.length) as Buffer;

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export class AuthenticationService {
  async authenticate(
    identifier: string,
    password: string,
    tenantId: string,
    options: { ipAddress?: string; userAgent?: string } = {},
  ) {
    const normalized = identifier.trim().toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        tenantId,
        status: "ACTIVE",
        OR: [
          { normalizedEmail: normalized },
          { normalizedUsername: normalized },
        ],
      },
    });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new Error("Invalid credentials");
    }

    const rawToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12);

    const session = await prisma.session.create({
      data: {
        tenantId,
        userId: user.id,
        tokenHash: tokenHash(rawToken),
        expiresAt,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
      },
      select: { id: true, expiresAt: true },
    });

    return {
      token: rawToken,
      sessionId: session.id,
      expiresAt: session.expiresAt,
      user: {
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        username: user.username,
      },
    };
  }

  async validateSession(token: string) {
    if (!token || token.length < 20) return null;

    const session = await prisma.session.findUnique({
      where: { tokenHash: tokenHash(token) },
      include: { user: true },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.status !== "ACTIVE" ||
      session.tenantId !== session.user.tenantId
    ) {
      return null;
    }

    await prisma.session.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      sessionId: session.id,
      userId: session.userId,
      tenantId: session.tenantId,
    };
  }

  async revokeSession(sessionId: string, tenantId: string) {
    return prisma.session.updateMany({
      where: { id: sessionId, tenantId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
EOF

echo "[6/12] Writing authorization and settings..."

cat > apps/api/src/modules/authorization/authorization.service.ts <<'EOF'
import { prisma } from "../../infrastructure/database/prisma";

export class AuthorizationService {
  async hasPermission(
    tenantId: string,
    userId: string,
    permissionKey: string,
  ): Promise<boolean> {
    const assignments = await prisma.userRole.findMany({
      where: { tenantId, userId },
      select: {
        role: {
          select: {
            permissions: {
              where: { tenantId },
              select: {
                effect: true,
                permission: {
                  select: { key: true },
                },
              },
            },
          },
        },
      },
    });

    const matching = assignments.flatMap((assignment) =>
      assignment.role.permissions
        .filter((item) => item.permission.key === permissionKey)
        .map((item) => item.effect),
    );

    if (matching.includes("DENY")) return false;
    return matching.includes("ALLOW");
  }

  async assertPermission(
    tenantId: string,
    userId: string,
    permissionKey: string,
  ): Promise<void> {
    if (!(await this.hasPermission(tenantId, userId, permissionKey))) {
      throw new Error("FORBIDDEN");
    }
  }
}
EOF

cat > apps/api/src/modules/settings/settings.service.ts <<'EOF'
import { prisma } from "../../infrastructure/database/prisma";

export class SettingsService {
  async get(tenantId: string, projectId: string | null, key: string) {
    return prisma.setting.findFirst({
      where: { tenantId, projectId, key },
      select: { id: true, key: true, value: true, updatedAt: true },
    });
  }

  async upsert(
    tenantId: string,
    projectId: string | null,
    key: string,
    value: unknown,
  ) {
    if (!key || key.length > 150) throw new Error("Invalid setting key");

    if (projectId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, tenantId },
        select: { id: true },
      });
      if (!project) throw new Error("Project not found in tenant");
    }

    const existing = await prisma.setting.findFirst({
      where: { tenantId, projectId, key },
      select: { id: true },
    });

    if (existing) {
      return prisma.setting.updateMany({
        where: { id: existing.id, tenantId, projectId },
        data: { value: value as object },
      });
    }

    return prisma.setting.create({
      data: {
        tenantId,
        projectId,
        key,
        value: value as object,
      },
    });
  }
}
EOF

echo "[7/12] Writing audit and outbox..."

cat > apps/api/src/modules/audit/audit.service.ts <<'EOF'
import { randomUUID } from "node:crypto";
import { prisma } from "../../infrastructure/database/prisma";

export interface AuditInput {
  tenantId: string;
  projectId?: string | null;
  actorUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
  correlationId?: string;
}

export class AuditService {
  async record(input: AuditInput) {
    if (!input.tenantId || !input.action || !input.resourceType) {
      throw new Error("Invalid audit event");
    }

    return prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        projectId: input.projectId ?? null,
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        correlationId: input.correlationId ?? randomUUID(),
        metadata: input.metadata as object | undefined,
      },
    });
  }
}
EOF

cat > apps/api/src/modules/events/outbox.service.ts <<'EOF'
import { prisma } from "../../infrastructure/database/prisma";

export class OutboxService {
  async enqueue(
    tenantId: string,
    eventType: string,
    payload: Record<string, unknown>,
    projectId?: string | null,
  ) {
    return prisma.outboxEvent.create({
      data: {
        tenantId,
        projectId: projectId ?? null,
        eventType,
        payload,
      },
    });
  }

  async claimBatch(batchSize = 20) {
    const limit = Math.max(1, Math.min(batchSize, 100));

    return prisma.$transaction(async (tx) => {
      const events = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM outbox_events
        WHERE status = 'PENDING'
          AND available_at <= NOW()
          AND (locked_at IS NULL OR locked_at < NOW() - INTERVAL '5 minutes')
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      `;

      if (events.length === 0) return [];

      const ids = events.map((event) => event.id);

      await tx.outboxEvent.updateMany({
        where: { id: { in: ids } },
        data: { lockedAt: new Date(), attempts: { increment: 1 } },
      });

      return tx.outboxEvent.findMany({
        where: { id: { in: ids } },
      });
    });
  }

  async markProcessed(id: string) {
    return prisma.outboxEvent.update({
      where: { id },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
        lockedAt: null,
      },
    });
  }

  async markFailed(id: string, error: string, attempts: number) {
    const terminal = attempts >= 10;
    const delaySeconds = Math.min(3600, 2 ** Math.min(attempts, 10));

    return prisma.outboxEvent.update({
      where: { id },
      data: {
        status: terminal ? "DEAD" : "PENDING",
        lastError: error.slice(0, 2000),
        lockedAt: null,
        availableAt: new Date(Date.now() + delaySeconds * 1000),
      },
    });
  }
}
EOF

echo "[8/12] Writing secrets, storage and health..."

cat > apps/api/src/modules/secrets/encryption.ts <<'EOF'
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

function masterKey(): Buffer {
  const encoded = process.env.SECRETS_MASTER_KEY;
  if (!encoded) throw new Error("SECRETS_MASTER_KEY is not configured");

  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) {
    throw new Error("SECRETS_MASTER_KEY must decode to exactly 32 bytes");
  }

  return key;
}

export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: string;
}

export function encryptSecret(plaintext: string): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyVersion: process.env.SECRETS_KEY_VERSION ?? "v1",
  };
}

export function decryptSecret(secret: EncryptedSecret): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    masterKey(),
    Buffer.from(secret.iv, "base64"),
  );

  decipher.setAuthTag(Buffer.from(secret.authTag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
EOF

cat > apps/api/src/modules/storage/storage-policy.ts <<'EOF'
export interface StoragePolicy {
  maxBytes: number;
  allowedMimeTypes: string[];
  quarantineByDefault: boolean;
}

export const DEFAULT_STORAGE_POLICY: StoragePolicy = {
  maxBytes: 25 * 1024 * 1024,
  allowedMimeTypes: [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "text/plain",
    "application/json",
  ],
  quarantineByDefault: true,
};

export function validateStoredObject(
  mimeType: string,
  sizeBytes: number,
  policy = DEFAULT_STORAGE_POLICY,
): void {
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    throw new Error("Invalid file size");
  }

  if (sizeBytes > policy.maxBytes) {
    throw new Error("File exceeds configured size limit");
  }

  if (!policy.allowedMimeTypes.includes(mimeType)) {
    throw new Error("File type is not allowed");
  }
}
EOF

cat > apps/api/src/modules/observability/health.ts <<'EOF'
export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  checks: Record<string, boolean>;
}

export function buildHealthStatus(
  checks: Record<string, boolean>,
): HealthStatus {
  const values = Object.values(checks);
  const allHealthy = values.length > 0 && values.every(Boolean);
  const allFailed = values.length > 0 && values.every((value) => !value);

  return {
    status: allHealthy ? "healthy" : allFailed ? "unhealthy" : "degraded",
    timestamp: new Date().toISOString(),
    checks,
  };
}
EOF

echo "[9/12] Writing middleware primitives..."

cat > apps/api/src/middleware/tenant.middleware.ts <<'EOF'
import type { RequestScope } from "../infrastructure/database/tenant-context";

export function requireTenantScope(
  scope: Partial<RequestScope> | undefined,
): RequestScope {
  if (!scope?.tenantId) {
    throw new Error("TENANT_SCOPE_REQUIRED");
  }

  return {
    tenantId: scope.tenantId,
    projectId: scope.projectId ?? null,
    userId: scope.userId ?? null,
  };
}
EOF

cat > apps/api/src/middleware/authentication.middleware.ts <<'EOF'
import { AuthenticationService } from "../modules/authentication/authentication.service";

const authentication = new AuthenticationService();

export async function authenticateBearer(
  authorizationHeader: string | undefined,
) {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    throw new Error("UNAUTHENTICATED");
  }

  const token = authorizationHeader.slice(7).trim();
  const session = await authentication.validateSession(token);

  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}
EOF

echo "[10/12] Generating database migration from Prisma schema..."

pnpm install --no-frozen-lockfile

pnpm exec prisma validate --schema apps/api/prisma/schema.prisma
pnpm exec prisma generate --schema apps/api/prisma/schema.prisma

mkdir -p apps/api/prisma/migrations/0001_layer01_security

pnpm exec prisma migrate diff \
  --from-empty \
  --to-schema-datamodel apps/api/prisma/schema.prisma \
  --script \
  > "$BACKUP/initial-schema.sql"

cp "$BACKUP/initial-schema.sql" \
  apps/api/prisma/migrations/0001_layer01_security/migration.sql

cat >> apps/api/prisma/migrations/0001_layer01_security/migration.sql <<'SQL'

-- Tenant and project isolation.
-- The application must set app.tenant_id and app.project_id
-- inside every scoped database transaction.

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
  USING (id::text = current_setting('app.tenant_id', true))
  WITH CHECK (id::text = current_setting('app.tenant_id', true));

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
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY sessions_tenant_isolation ON sessions
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY roles_tenant_isolation ON roles
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY permissions_tenant_isolation ON permissions
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY user_roles_tenant_isolation ON user_roles
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY role_permissions_tenant_isolation ON role_permissions
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY settings_scope_isolation ON settings
  USING (
    tenant_id::text = current_setting('app.tenant_id', true)
    AND (
      project_id IS NULL
      OR current_setting('app.project_id', true) = ''
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
      OR current_setting('app.project_id', true) = ''
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
      OR current_setting('app.project_id', true) = ''
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
      OR current_setting('app.project_id', true) = ''
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
      OR current_setting('app.project_id', true) = ''
      OR project_id::text = current_setting('app.project_id', true)
    )
  )
  WITH CHECK (
    tenant_id::text = current_setting('app.tenant_id', true)
  );

-- Audit logs are append-only for the application role.
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

echo "[11/12] Writing automated tests..."

cat > tests/layer-01/security.test.ts <<'EOF'
import { describe, expect, it } from "vitest";
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

describe("Layer 01 security primitives", () => {
  it("encrypts and decrypts secrets", () => {
    process.env.SECRETS_MASTER_KEY = Buffer.alloc(32, 7).toString("base64");
    process.env.SECRETS_KEY_VERSION = "test-v1";

    const encrypted = encryptSecret("sensitive-value");

    expect(encrypted.ciphertext).not.toBe("sensitive-value");
    expect(decryptSecret(encrypted)).toBe("sensitive-value");
  });

  it("rejects a tampered authentication tag", () => {
    process.env.SECRETS_MASTER_KEY = Buffer.alloc(32, 7).toString("base64");

    const encrypted = encryptSecret("secret");
    const tampered = {
      ...encrypted,
      authTag: Buffer.alloc(16, 1).toString("base64"),
    };

    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("rejects disallowed file types", () => {
    expect(() =>
      validateStoredObject("application/x-executable", 100),
    ).toThrow();
  });

  it("rejects files exceeding the size limit", () => {
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

  it("requires a tenant scope", () => {
    expect(() => requireTenantScope(undefined)).toThrow();
    expect(() => requireTenantScope({})).toThrow();
  });

  it("normalizes missing optional scope values", () => {
    const scope = requireTenantScope({
      tenantId: "tenant-id",
    });

    expect(scope.projectId).toBeNull();
    expect(scope.userId).toBeNull();
  });

  it("reports healthy only when every check succeeds", () => {
    expect(
      buildHealthStatus({ database: true, storage: true }).status,
    ).toBe("healthy");
  });

  it("reports degraded when checks are mixed", () => {
    expect(
      buildHealthStatus({ database: true, storage: false }).status,
    ).toBe("degraded");
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

describe("Prisma schema structure", () => {
  const models = [
    "Tenant",
    "Project",
    "User",
    "Session",
    "Role",
    "Permission",
    "UserRole",
    "RolePermission",
    "Setting",
    "AuditLog",
    "OutboxEvent",
    "Secret",
    "StoredObject",
  ];

  for (const model of models) {
    it(`contains ${model}`, () => {
      expect(schema).toMatch(new RegExp(`model\\s+${model}\\s*\\{`));
    });
  }

  it("contains relation declarations", () => {
    expect(schema).toContain("@relation");
  });

  it("uses PostgreSQL", () => {
    expect(schema).toContain('provider = "postgresql"');
  });

  it("contains tenant and project identifiers", () => {
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

describe("Database isolation migration", () => {
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

  it("protects audit records from mutation", () => {
    expect(migration).toContain("audit_logs_immutable");
    expect(migration).toContain("prevent_audit_mutation");
  });
});
EOF

echo "[12/12] Running final validation..."

REPORT="$ROOT/docs/22-layer-01/FINALIZATION-REPORT-$STAMP.txt"
mkdir -p "$(dirname "$REPORT")"

{
  echo "FREE AI — LAYER 01 FINALIZATION"
  echo "Timestamp: $STAMP"
  echo "Backup: $BACKUP"
  echo
  echo "=== PRISMA VALIDATION ==="
  pnpm exec prisma validate --schema apps/api/prisma/schema.prisma
  echo
  echo "=== PRISMA GENERATION ==="
  pnpm exec prisma generate --schema apps/api/prisma/schema.prisma
  echo
  echo "=== TYPESCRIPT ==="
  pnpm exec tsc --noEmit -p apps/api/tsconfig.json
  echo
  echo "=== TESTS ==="
  pnpm exec vitest run tests/layer-01
  echo
  echo "=== GIT DIFF CHECK ==="
  git diff --check
} 2>&1 | tee "$REPORT"

echo
echo "=================================================="
echo " FINALIZATION COMMANDS COMPLETED"
echo "=================================================="
echo "Report: $REPORT"
echo "Backup: $BACKUP"
echo
echo "IMPORTANT:"
echo "- Database migration was generated, NOT applied."
echo "- No production database was modified."
echo "- Review the report before enabling database access."
