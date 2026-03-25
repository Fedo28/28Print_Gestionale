import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import type { UserRole } from "@prisma/client";

export type SessionPayload = {
  userId: string;
  role: UserRole;
  exp: number;
};

function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}

function getAuthSecret(options?: { optional?: boolean }) {
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret) {
    return secret;
  }

  if (isProductionRuntime()) {
    if (options?.optional) {
      return null;
    }

    throw new Error("AUTH_SECRET mancante in produzione.");
  }

  return "change-me-in-production";
}

function signPayload(payload: string) {
  const secret = getAuthSecret() as string;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function serializeSession(payload: SessionPayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signPayload(encoded);
  return `${encoded}.${signature}`;
}

export function readSession(cookieValue?: string | null): SessionPayload | null {
  if (!cookieValue) {
    return null;
  }

  const secret = getAuthSecret({ optional: true });
  if (!secret) {
    return null;
  }

  const [encoded, signature] = cookieValue.split(".");
  if (!encoded || !signature) {
    return null;
  }

  const expectedSignature = createHmac("sha256", secret).update(encoded).digest("hex");
  const signatureBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
  if (payload.exp < Date.now()) {
    return null;
  }

  return payload;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function isAuthSecretConfigured() {
  return Boolean(process.env.AUTH_SECRET?.trim());
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, expectedHash] = storedHash.split(":");
  if (!salt || !expectedHash) {
    return false;
  }

  const passwordHash = scryptSync(password, salt, 64).toString("hex");
  const expectedBuffer = Buffer.from(expectedHash, "hex");
  const actualBuffer = Buffer.from(passwordHash, "hex");

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}
