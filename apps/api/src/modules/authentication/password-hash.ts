import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

function derive(password: string, salt: string, N: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, 64, { N, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 1024) throw new Error("PASSWORD_POLICY_REJECTED");
  const N = 32_768;
  const salt = randomBytes(16).toString("hex");
  const derived = await derive(password, salt, N);
  return `scrypt$${N}$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split("$");
  const legacy = parts.length === 3 && parts[0] === "scrypt";
  const N = legacy ? 16_384 : Number(parts[1]);
  const salt = legacy ? parts[1] : parts[2];
  const expectedHex = legacy ? parts[2] : parts[3];
  if (parts[0] !== "scrypt" || ![16_384, 32_768].includes(N) || !salt || !/^[0-9a-f]{32}$/i.test(salt) || !expectedHex || !/^[0-9a-f]{128}$/i.test(expectedHex)) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = await derive(password, salt, N);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
