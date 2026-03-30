import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.APP_ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    throw new Error(
      "APP_ENCRYPTION_KEY must be set and at least 32 characters. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  // Use first 32 bytes (hex-encoded key = 64 chars → 32 bytes)
  return Buffer.from(key.slice(0, 64), "hex");
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  // Format: iv:tag:ciphertext (all base64)
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decrypt(encoded: string): string {
  const key = getKey();
  const parts = encoded.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }
  const iv = Buffer.from(parts[0], "base64");
  const tag = Buffer.from(parts[1], "base64");
  const encrypted = Buffer.from(parts[2], "base64");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}
