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
  if (!plaintext || Buffer.byteLength(plaintext, "utf8") > 16384) {
    throw new Error("SECRET_VALUE_INVALID");
  }
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
