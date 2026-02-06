import { createHash, createDecipheriv, createCipheriv, randomBytes } from "crypto";

type EncryptedPayload = {
  iv: string;
  tag: string;
  data: string;
};

function getKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("Missing env NEXTAUTH_SECRET");
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptToken(value: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  const payload: EncryptedPayload = {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  };

  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

export function decryptToken(payloadB64: string): string {
  const key = getKey();
  const decoded = Buffer.from(payloadB64, "base64").toString("utf8");
  const payload = JSON.parse(decoded) as EncryptedPayload;
  const iv = Buffer.from(payload.iv, "base64");
  const tag = Buffer.from(payload.tag, "base64");
  const data = Buffer.from(payload.data, "base64");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}