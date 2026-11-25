import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../../apps/api/src/modules/authentication/password-hash";

const scrypt = promisify(scryptCallback);

describe("credential password hashing", () => {
  it("uses scrypt with an explicit work factor and verifies the correct password", async () => {
    const encoded = await hashPassword("A long generated credential 2026!");
    expect(encoded).toMatch(/^scrypt\$32768\$/);
    await expect(verifyPassword("A long generated credential 2026!", encoded)).resolves.toBe(true);
    await expect(verifyPassword("incorrect password", encoded)).resolves.toBe(false);
  });

  it("verifies existing legacy scrypt hashes after the auth migration", async () => {
    const password = "Existing account password 2025!";
    const salt = randomBytes(16).toString("hex");
    const digest = await scrypt(password, salt, 64, { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }) as Buffer;
    await expect(verifyPassword(password, `scrypt$${salt}$${digest.toString("hex")}`)).resolves.toBe(true);
  });

  it("rejects short passwords and malformed hashes", async () => {
    await expect(hashPassword("short")).rejects.toThrow("PASSWORD_POLICY_REJECTED");
    await expect(verifyPassword("anything long enough", "not-a-valid-hash")).resolves.toBe(false);
  });
});
