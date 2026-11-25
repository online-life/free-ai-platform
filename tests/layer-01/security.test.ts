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
