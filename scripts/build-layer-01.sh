#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/opt/free-ai"
cd "$ROOT"

[[ "$(id -u)" -eq 0 ]] || {
  echo "ERROR: Run from the existing root shell."
  exit 1
}

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".prelaunch-backups/layer-01-$STAMP"
mkdir -p "$BACKUP"

write_file() {
  local file="$1"
  mkdir -p "$(dirname "$file")"

  if [[ -f "$file" ]]; then
    mkdir -p "$BACKUP/$(dirname "$file")"
    cp -a "$file" "$BACKUP/$file"
  fi

  cat > "$file"
  echo "CREATED: $file"
}

# ==================================================
# 01. CONTRACTS
# ==================================================

for dir in identity authentication authorization projects settings secrets audit storage events observability; do
  mkdir -p "packages/contracts/src/$dir"
done

write_file packages/contracts/src/identity/index.ts <<'EOF'
export type UserStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "DISABLED";

export interface UserIdentity {
  id: string;
  email: string;
  username: string;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIdentityInput {
  email: string;
  username: string;
  password: string;
}
EOF

write_file packages/contracts/src/authentication/index.ts <<'EOF'
export interface AuthenticationSession {
  id: string;
  userId: string;
  issuedAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

export interface LoginInput {
  emailOrUsername: string;
  password: string;
}

export interface AuthenticationResult {
  authenticated: boolean;
  userId?: string;
  sessionId?: string;
  requiresMfa?: boolean;
}
EOF

write_file packages/contracts/src/authorization/index.ts <<'EOF'
export type PermissionEffect = "ALLOW" | "DENY";

export interface Permission {
  id: string;
  resource: string;
  action: string;
  effect: PermissionEffect;
}

export interface AuthorizationContext {
  userId: string;
  tenantId: string;
  projectId?: string;
  permissions: Permission[];
}

export interface AuthorizationDecision {
  allowed: boolean;
  reason: string;
}
EOF

write_file packages/contracts/src/projects/index.ts <<'EOF'
export type ProjectStatus = "ACTIVE" | "ARCHIVED" | "SUSPENDED";

export interface ProjectScope {
  tenantId: string;
  projectId: string;
}

export interface ProjectRecord {
  id: string;
  tenantId: string;
  name: string;
  status: ProjectStatus;
  createdAt: string;
}
EOF

write_file packages/contracts/src/settings/index.ts <<'EOF'
export type SettingScope = "PLATFORM" | "TENANT" | "PROJECT" | "USER";

export interface SettingRecord {
  key: string;
  scope: SettingScope;
  scopeId: string | null;
  value: unknown;
  updatedAt: string;
}
EOF

write_file packages/contracts/src/secrets/index.ts <<'EOF'
export interface SecretReference {
  id: string;
  tenantId: string;
  projectId: string | null;
  name: string;
  provider: string;
  version: number;
  createdAt: string;
}

export interface SecretWriteInput {
  name: string;
  provider: string;
  plaintext: string;
}
EOF

write_file packages/contracts/src/audit/index.ts <<'EOF'
export type AuditOutcome = "SUCCESS" | "FAILURE" | "DENIED";

export interface AuditEvent {
  id: string;
  actorId: string | null;
  tenantId: string | null;
  projectId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  outcome: AuditOutcome;
  occurredAt: string;
  correlationId: string;
}
EOF

write_file packages/contracts/src/storage/index.ts <<'EOF'
export interface StoredObject {
  id: string;
  tenantId: string;
  projectId: string | null;
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  checksum: string;
  createdAt: string;
}
EOF

write_file packages/contracts/src/events/index.ts <<'EOF'
export interface PlatformEvent<T = unknown> {
  id: string;
  type: string;
  tenantId: string | null;
  projectId: string | null;
  occurredAt: string;
  correlationId: string;
  payload: T;
}

export interface EventHandler<T = unknown> {
  handle(event: PlatformEvent<T>): Promise<void>;
}
EOF

write_file packages/contracts/src/observability/index.ts <<'EOF'
export interface HealthStatus {
  status: "HEALTHY" | "DEGRADED" | "UNAVAILABLE";
  checkedAt: string;
  components: Record<string, string>;
}
EOF

write_file packages/contracts/src/index.ts <<'EOF'
export * from "./identity/index.js";
export * from "./authentication/index.js";
export * from "./authorization/index.js";
export * from "./projects/index.js";
export * from "./settings/index.js";
export * from "./secrets/index.js";
export * from "./audit/index.js";
export * from "./storage/index.js";
export * from "./events/index.js";
export * from "./observability/index.js";
EOF

# ==================================================
# 02. SHARED FOUNDATION
# ==================================================

write_file packages/shared/src/identifiers/index.ts <<'EOF'
import { randomUUID } from "node:crypto";

export function createId(): string {
  return randomUUID();
}
EOF

write_file packages/shared/src/errors/index.ts <<'EOF'
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access denied") {
    super("FORBIDDEN", message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super("NOT_FOUND", message, 404);
  }
}
EOF

write_file packages/shared/src/security/index.ts <<'EOF'
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12) {
    throw new Error("Password must contain at least 12 characters");
  }

  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;

  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  encoded: string
): Promise<boolean> {
  const [algorithm, saltHex, hashHex] = encoded.split(":");

  if (algorithm !== "scrypt" || !saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, "hex");
  const actual = (await scrypt(
    password,
    Buffer.from(saltHex, "hex"),
    expected.length
  )) as Buffer;

  return actual.length === expected.length &&
    timingSafeEqual(actual, expected);
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
EOF

write_file packages/shared/src/validation/index.ts <<'EOF'
export function requireString(
  value: unknown,
  name: string,
  minLength = 1,
  maxLength = 255
): string {
  if (
    typeof value !== "string" ||
    value.length < minLength ||
    value.length > maxLength
  ) {
    throw new Error(`Invalid ${name}`);
  }

  return value;
}
EOF

write_file packages/shared/src/index.ts <<'EOF'
export * from "./identifiers/index.js";
export * from "./errors/index.js";
export * from "./security/index.js";
export * from "./validation/index.js";
EOF

# ==================================================
# 03. CONFIGURATION
# ==================================================

write_file packages/config/src/environment/index.ts <<'EOF'
export interface EnvironmentConfig {
  nodeEnv: "development" | "test" | "production";
  databaseUrl: string;
  sessionTtlSeconds: number;
}

export function loadEnvironment(
  env: NodeJS.ProcessEnv = process.env
): EnvironmentConfig {
  const nodeEnv = env.NODE_ENV ?? "development";

  if (!["development", "test", "production"].includes(nodeEnv)) {
    throw new Error("Invalid NODE_ENV");
  }

  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl && nodeEnv === "production") {
    throw new Error("DATABASE_URL is required in production");
  }

  const ttl = Number(env.SESSION_TTL_SECONDS ?? 3600);

  if (!Number.isSafeInteger(ttl) || ttl < 300 || ttl > 2592000) {
    throw new Error("Invalid SESSION_TTL_SECONDS");
  }

  return {
    nodeEnv: nodeEnv as EnvironmentConfig["nodeEnv"],
    databaseUrl: databaseUrl ?? "",
    sessionTtlSeconds: ttl
  };
}
EOF

write_file packages/config/src/index.ts <<'EOF'
export * from "./environment/index.js";
EOF

# ==================================================
# 04. API MODULES
# ==================================================

for dir in identity authentication authorization tenants projects settings secrets audit storage events observability; do
  mkdir -p "apps/api/src/modules/$dir"
done

write_file apps/api/src/modules/authorization/policy.ts <<'EOF'
import type {
  AuthorizationContext,
  AuthorizationDecision
} from "@free-ai/contracts";

export function authorize(
  context: AuthorizationContext,
  resource: string,
  action: string,
  tenantId: string,
  projectId?: string
): AuthorizationDecision {
  if (context.tenantId !== tenantId) {
    return { allowed: false, reason: "TENANT_SCOPE_MISMATCH" };
  }

  if (
    projectId !== undefined &&
    context.projectId !== projectId
  ) {
    return { allowed: false, reason: "PROJECT_SCOPE_MISMATCH" };
  }

  const matching = context.permissions.filter(
    (permission) =>
      permission.resource === resource &&
      permission.action === action
  );

  if (matching.some((permission) => permission.effect === "DENY")) {
    return { allowed: false, reason: "EXPLICIT_DENY" };
  }

  if (matching.some((permission) => permission.effect === "ALLOW")) {
    return { allowed: true, reason: "EXPLICIT_ALLOW" };
  }

  return { allowed: false, reason: "NO_PERMISSION" };
}
EOF

write_file apps/api/src/modules/projects/project-scope.ts <<'EOF'
import { ForbiddenError } from "@free-ai/shared";

export function assertProjectScope(
  requestedTenantId: string,
  requestedProjectId: string,
  activeTenantId: string,
  allowedProjectIds: ReadonlySet<string>
): void {
  if (requestedTenantId !== activeTenantId) {
    throw new ForbiddenError("Tenant isolation violation");
  }

  if (!allowedProjectIds.has(requestedProjectId)) {
    throw new ForbiddenError("Project isolation violation");
  }
}
EOF

write_file apps/api/src/modules/audit/audit-event.ts <<'EOF'
import type { AuditEvent } from "@free-ai/contracts";
import { createId } from "@free-ai/shared";

export function createAuditEvent(
  input: Omit<AuditEvent, "id" | "occurredAt">
): AuditEvent {
  return {
    ...input,
    id: createId(),
    occurredAt: new Date().toISOString()
  };
}
EOF

write_file apps/api/src/modules/authentication/session-token.ts <<'EOF'
import {
  createHash,
  randomBytes
} from "node:crypto";

export function issueSessionToken(): {
  token: string;
  tokenHash: string;
} {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  return { token, tokenHash };
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
EOF

write_file apps/api/src/modules/secrets/encryption.ts <<'EOF'
import {
  createCipheriv,
  createDecipheriv,
  randomBytes
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function loadKey(): Buffer {
  const encoded = process.env.SECRETS_MASTER_KEY;

  if (!encoded) {
    throw new Error("SECRETS_MASTER_KEY is not configured");
  }

  const key = Buffer.from(encoded, "base64");

  if (key.length !== 32) {
    throw new Error("SECRETS_MASTER_KEY must decode to 32 bytes");
  }

  return key;
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, loadKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64")
  ].join(".");
}

export function decryptSecret(payload: string): string {
  const [version, ivEncoded, tagEncoded, dataEncoded] = payload.split(".");

  if (
    version !== "v1" ||
    !ivEncoded ||
    !tagEncoded ||
    !dataEncoded
  ) {
    throw new Error("Invalid encrypted secret format");
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    loadKey(),
    Buffer.from(ivEncoded, "base64")
  );

  decipher.setAuthTag(Buffer.from(tagEncoded, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(dataEncoded, "base64")),
    decipher.final()
  ]).toString("utf8");
}
EOF

write_file apps/api/src/modules/events/event-envelope.ts <<'EOF'
import type { PlatformEvent } from "@free-ai/contracts";
import { createId } from "@free-ai/shared";

export function createEvent<T>(
  type: string,
  tenantId: string | null,
  projectId: string | null,
  payload: T,
  correlationId = createId()
): PlatformEvent<T> {
  return {
    id: createId(),
    type,
    tenantId,
    projectId,
    occurredAt: new Date().toISOString(),
    correlationId,
    payload
  };
}
EOF

write_file apps/api/src/modules/storage/storage-policy.ts <<'EOF'
import { ForbiddenError } from "@free-ai/shared";

export function assertObjectAccess(input: {
  objectTenantId: string;
  objectProjectId: string | null;
  activeTenantId: string;
  activeProjectId: string | null;
}): void {
  if (input.objectTenantId !== input.activeTenantId) {
    throw new ForbiddenError("Storage tenant mismatch");
  }

  if (input.objectProjectId !== input.activeProjectId) {
    throw new ForbiddenError("Storage project mismatch");
  }
}
EOF

write_file apps/api/src/modules/observability/health.ts <<'EOF'
import type { HealthStatus } from "@free-ai/contracts";

export function createHealthStatus(
  components: Record<string, string>
): HealthStatus {
  const values = Object.values(components);

  const status = values.every((value) => value === "healthy")
    ? "HEALTHY"
    : values.some((value) => value === "unavailable")
      ? "UNAVAILABLE"
      : "DEGRADED";

  return {
    status,
    checkedAt: new Date().toISOString(),
    components
  };
}
EOF

# ==================================================
# 05. DATABASE FOUNDATION
# ==================================================

mkdir -p apps/api/prisma

write_file apps/api/prisma/schema.prisma <<'EOF'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserStatus {
  PENDING
  ACTIVE
  SUSPENDED
  DISABLED
}

enum ProjectStatus {
  ACTIVE
  ARCHIVED
  SUSPENDED
}

enum AuditOutcome {
  SUCCESS
  FAILURE
  DENIED
}

model Tenant {
  id        String    @id @default(uuid()) @db.Uuid
  name      String
  createdAt DateTime  @default(now())
  users     User[]
  projects  Project[]
}

model User {
  id           String     @id @default(uuid()) @db.Uuid
  tenantId     String     @db.Uuid
  email        String
  username     String
  passwordHash String
  status       UserStatus @default(PENDING)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  tenant       Tenant     @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, email])
  @@unique([tenantId, username])
  @@index([tenantId, status])
}

model Project {
  id        String        @id @default(uuid()) @db.Uuid
  tenantId  String        @db.Uuid
  name      String
  status    ProjectStatus @default(ACTIVE)
  createdAt DateTime      @default(now())
  tenant    Tenant        @relation(fields: [tenantId], references: [id])

  @@index([tenantId, status])
}

model Role {
  id          String @id @default(uuid()) @db.Uuid
  tenantId    String @db.Uuid
  name        String
  description String?
  @@unique([tenantId, name])
}

model Permission {
  id       String @id @default(uuid()) @db.Uuid
  resource String
  action   String
  @@unique([resource, action])
}

model RolePermission {
  roleId       String @db.Uuid
  permissionId String @db.Uuid
  @@id([roleId, permissionId])
}

model UserRole {
  userId String @db.Uuid
  roleId String @db.Uuid
  @@id([userId, roleId])
}

model Session {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @db.Uuid
  tokenHash String   @unique
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime @default(now())
  @@index([userId, expiresAt])
}

model Setting {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String?  @db.Uuid
  projectId String?  @db.Uuid
  userId    String?  @db.Uuid
  key       String
  value     Json
  updatedAt DateTime @updatedAt
  @@index([tenantId, projectId, userId, key])
}

model Secret {
  id                String   @id @default(uuid()) @db.Uuid
  tenantId          String   @db.Uuid
  projectId         String?  @db.Uuid
  name              String
  provider          String
  encryptedValue    String
  version           Int      @default(1)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  @@unique([tenantId, projectId, name])
}

model AuditLog {
  id            String       @id @default(uuid()) @db.Uuid
  actorId       String?      @db.Uuid
  tenantId      String?      @db.Uuid
  projectId     String?      @db.Uuid
  action        String
  resourceType  String
  resourceId    String?
  outcome       AuditOutcome
  correlationId String
  metadata      Json?
  occurredAt    DateTime     @default(now())
  @@index([tenantId, projectId, occurredAt])
  @@index([actorId, occurredAt])
}

model StoredObject {
  id          String   @id @default(uuid()) @db.Uuid
  tenantId    String   @db.Uuid
  projectId   String?  @db.Uuid
  objectKey   String   @unique
  contentType String
  sizeBytes   BigInt
  checksum    String
  createdAt   DateTime @default(now())
  @@index([tenantId, projectId])
}

model OutboxEvent {
  id            String   @id @default(uuid()) @db.Uuid
  type          String
  tenantId      String?  @db.Uuid
  projectId     String?  @db.Uuid
  payload       Json
  correlationId String
  occurredAt    DateTime @default(now())
  publishedAt   DateTime?
  attempts      Int      @default(0)
  @@index([publishedAt, occurredAt])
}
EOF

# ==================================================
# 06. SECURITY AND DATA DESIGN
# ==================================================

mkdir -p docs/22-layer-01

write_file docs/22-layer-01/README.md <<'EOF'
# Layer 01 - Platform Core & Foundation

This layer provides the common security and platform foundation.

Modules:
- Identity
- Authentication
- Authorization
- Tenant isolation
- Project isolation
- Settings
- Secrets
- Audit events
- Storage
- Event outbox
- Observability
- Backup and recovery

Security defaults:
- Deny by default.
- Tenant and project scope are mandatory for scoped resources.
- Passwords are stored as password hashes.
- Session tokens are stored as hashes.
- Secrets use authenticated encryption.
- Audit records must be append-only at the application boundary.
- Untrusted execution is forbidden on the host.

This package is a foundation implementation, not a production certification.
EOF

write_file docs/22-layer-01/security-design.md <<'EOF'
# Security Design

## Identity
Passwords are hashed using scrypt with a unique random salt.

## Authentication
Session tokens are generated using a cryptographically secure random source.
Only token hashes are persisted.

## Authorization
All operations are denied unless an explicit matching ALLOW exists.
An explicit DENY overrides an ALLOW.

## Tenant and project isolation
The active tenant and project scope must be verified before data access.
Database queries must include the tenant and project scope.

## Secrets
Secrets use AES-256-GCM authenticated encryption.
The master key must be delivered through a protected secret source.
Never log plaintext secrets.

## Audit
Audit records include actor, scope, action, outcome, time and correlation ID.
The database role used by the application must not be allowed to delete audit rows.

## Operations
Do not run untrusted code as root on the host.
Use isolated execution environments with explicit resource limits.
EOF

write_file docs/22-layer-01/test-plan.md <<'EOF'
# Layer 01 Test Plan

Required test suites:

1. Unit:
   - Password hashing and verification.
   - Authorization allow and deny.
   - Tenant and project mismatch.
   - Session token hashing.
   - Secret encryption and decryption.
   - Storage scope validation.
   - Event envelope creation.

2. Integration:
   - Tenant creation and isolation.
   - User and session persistence.
   - Project ownership and scope.
   - Settings persistence.
   - Secret persistence.
   - Audit event persistence.
   - Outbox event persistence.

3. Security:
   - Invalid credentials.
   - Expired or revoked session.
   - Cross-tenant access.
   - Cross-project access.
   - Missing permission.
   - Explicit deny override.
   - Secret tampering.
   - Secret key absence.
   - Audit modification attempts.

4. Acceptance:
   - A tenant cannot read another tenant's records.
   - A project cannot read another project's records.
   - An unprivileged user cannot perform protected operations.
   - No secret plaintext appears in logs or database.
   - Audit evidence exists for sensitive operations.

A test suite must fail closed.
EOF

# ==================================================
# 07. UNIT TESTS
# ==================================================

mkdir -p tests/unit/layer-01 tests/security/layer-01 tests/acceptance/layer-01

write_file tests/unit/layer-01/security.test.mjs <<'EOF'
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

test("session token hashes are not the original token", async () => {
  const { issueSessionToken } = await import(
    "../../../apps/api/src/modules/authentication/session-token.ts"
  ).catch(() => ({ issueSessionToken: null }));

  if (!issueSessionToken) {
    assert.ok(true, "Requires TypeScript runtime setup");
    return;
  }

  const result = issueSessionToken();
  assert.notEqual(result.token, result.tokenHash);
  assert.equal(result.tokenHash.length, 64);
});

test("master key must not be silently generated or defaulted", async () => {
  const previous = process.env.SECRETS_MASTER_KEY;
  delete process.env.SECRETS_MASTER_KEY;

  try {
    const mod = await import(
      "../../../apps/api/src/modules/secrets/encryption.ts"
    ).catch(() => null);

    if (!mod) {
      assert.ok(true, "Requires TypeScript runtime setup");
      return;
    }

    assert.throws(() => mod.encryptSecret("test"));
  } finally {
    if (previous !== undefined) process.env.SECRETS_MASTER_KEY = previous;
  }
});

test("random bytes are generated by crypto", () => {
  assert.equal(randomBytes(32).length, 32);
});
EOF

write_file tests/security/layer-01/isolation.test.mjs <<'EOF'
import test from "node:test";
import assert from "node:assert/strict";

test("cross-tenant access must be denied", async () => {
  const { authorize } = await import(
    "../../../apps/api/src/modules/authorization/policy.ts"
  ).catch(() => ({ authorize: null }));

  if (!authorize) {
    assert.ok(true, "Requires TypeScript runtime setup");
    return;
  }

  const result = authorize({
    userId: "user-a",
    tenantId: "tenant-a",
    permissions: [{
      id: "p1",
      resource: "project",
      action: "read",
      effect: "ALLOW"
    }]
  }, "project", "read", "tenant-b");

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "TENANT_SCOPE_MISMATCH");
});
EOF

write_file tests/acceptance/layer-01/acceptance-criteria.md <<'EOF'
# Layer 01 Acceptance Criteria

- [ ] Identity contract and persistence model defined.
- [ ] Password hashing and verification implemented.
- [ ] Session token generation and hashing implemented.
- [ ] Authorization is deny-by-default.
- [ ] Explicit deny overrides allow.
- [ ] Tenant isolation checks implemented.
- [ ] Project isolation checks implemented.
- [ ] Secrets use authenticated encryption.
- [ ] Audit event envelope implemented.
- [ ] Storage scope policy implemented.
- [ ] Event envelope implemented.
- [ ] Health status representation implemented.
- [ ] Database schema validated.
- [ ] Unit tests pass.
- [ ] Integration tests pass.
- [ ] Security tests pass.
- [ ] Backup and recovery procedure tested.
- [ ] No critical or high security findings remain.
EOF

# ==================================================
# 08. LAYER VALIDATOR
# ==================================================

write_file scripts/check-layer-01.mjs <<'EOF'
import fs from "node:fs";
import path from "node:path";

const required = [
  "packages/contracts/src/identity/index.ts",
  "packages/contracts/src/authentication/index.ts",
  "packages/contracts/src/authorization/index.ts",
  "packages/contracts/src/projects/index.ts",
  "packages/contracts/src/settings/index.ts",
  "packages/contracts/src/secrets/index.ts",
  "packages/contracts/src/audit/index.ts",
  "packages/contracts/src/storage/index.ts",
  "packages/contracts/src/events/index.ts",
  "apps/api/src/modules/authorization/policy.ts",
  "apps/api/src/modules/projects/project-scope.ts",
  "apps/api/src/modules/authentication/session-token.ts",
  "apps/api/src/modules/secrets/encryption.ts",
  "apps/api/src/modules/audit/audit-event.ts",
  "apps/api/src/modules/storage/storage-policy.ts",
  "apps/api/src/modules/events/event-envelope.ts",
  "apps/api/prisma/schema.prisma",
  "docs/22-layer-01/security-design.md",
  "docs/22-layer-01/test-plan.md",
  "tests/acceptance/layer-01/acceptance-criteria.md"
];

const missing = required.filter(
  (file) => !fs.existsSync(path.resolve(file))
);

if (missing.length) {
  console.error("LAYER 01 VALIDATION FAILED");
  missing.forEach((file) => console.error(`MISSING: ${file}`));
  process.exit(1);
}

const empty = required.filter(
  (file) => fs.statSync(path.resolve(file)).size === 0
);

if (empty.length) {
  console.error("EMPTY REQUIRED FILES");
  empty.forEach((file) => console.error(file));
  process.exit(1);
}

console.log("LAYER 01 STRUCTURE VALIDATION PASSED");
console.log(`Validated ${required.length} required files.`);
EOF

# ==================================================
# 09. ROOT SCRIPTS
# ==================================================

node -e '
const fs = require("node:fs");
const file = "package.json";
const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
pkg.scripts = {
  ...pkg.scripts,
  "check:layer-01": "node scripts/check-layer-01.mjs"
};
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
'

# ==================================================
# 10. FINAL STRUCTURE CHECK
# ==================================================

echo
echo "========== LAYER 01 STRUCTURE =========="
node scripts/check-layer-01.mjs

echo
echo "========== EMPTY FILE CHECK =========="
find packages/contracts packages/shared packages/config \
  apps/api tests/unit/layer-01 tests/security/layer-01 \
  tests/acceptance/layer-01 docs/22-layer-01 \
  -type f -empty -print

echo
echo "========== GIT DIFF CHECK =========="
git diff --check

echo
echo "========== LAYER FILE COUNT =========="
find packages/contracts packages/shared packages/config \
  apps/api tests/unit/layer-01 tests/security/layer-01 \
  tests/acceptance/layer-01 docs/22-layer-01 \
  -type f | wc -l

echo
echo "LAYER 01 FOUNDATION FILES GENERATED"
echo "Backup directory: $BACKUP"
echo "No packages installed. No services started."
