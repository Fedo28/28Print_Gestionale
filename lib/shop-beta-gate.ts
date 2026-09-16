import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import {
  readExpiringSignedPayload,
  readSession,
  serializeExpiringSignedPayload
} from "@/lib/auth-core";

export const SHOP_BETA_ACCESS_COOKIE = "fede_shop_beta_access";
const STAFF_SESSION_COOKIE = "fede_session";

const SHOP_BETA_ACCESS_DURATION_SECONDS = 60 * 60 * 24 * 30;
const SHOP_BETA_SCOPE = "shop-beta";
const STAFF_PREVIEW_ROLES = new Set(["ADMIN", "OPERATOR"]);

type ShopBetaAccessPayload = {
  codeHash: string;
  exp: number;
  scope: typeof SHOP_BETA_SCOPE;
};

export type ShopBetaGateState = {
  allowed: boolean;
  configured: boolean;
  enabled: boolean;
  staffPreview: boolean;
};

function isTruthyEnv(value?: string | null) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function readShopBetaCode() {
  return process.env.SHOP_BETA_ACCESS_CODE?.trim() || "";
}

function createCodeHash(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

function safeStringEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

function getCookieValue(cookieValue?: string | null) {
  if (typeof cookieValue !== "undefined") {
    return cookieValue;
  }

  return cookies().get(SHOP_BETA_ACCESS_COOKIE)?.value;
}

function getStaffSessionCookieValue(cookieValue?: string | null) {
  if (typeof cookieValue !== "undefined") {
    return cookieValue;
  }

  return cookies().get(STAFF_SESSION_COOKIE)?.value;
}

function hasStaffPreviewAccess(cookieValue?: string | null) {
  const session = readSession(getStaffSessionCookieValue(cookieValue));
  return Boolean(session?.userId && STAFF_PREVIEW_ROLES.has(session.role));
}

export function isShopBetaGateEnabled() {
  return isTruthyEnv(process.env.SHOP_BETA_LOCKED);
}

export function getShopBetaGateState(cookieValue?: string | null): ShopBetaGateState {
  const enabled = isShopBetaGateEnabled();
  const betaCode = readShopBetaCode();
  const configured = Boolean(betaCode);
  const staffPreview = hasStaffPreviewAccess();

  if (!enabled) {
    return {
      allowed: true,
      configured,
      enabled,
      staffPreview
    };
  }

  if (staffPreview) {
    return {
      allowed: true,
      configured,
      enabled,
      staffPreview
    };
  }

  if (!configured) {
    return {
      allowed: false,
      configured,
      enabled,
      staffPreview
    };
  }

  const payload = readExpiringSignedPayload<ShopBetaAccessPayload>(getCookieValue(cookieValue));
  const allowed = payload?.scope === SHOP_BETA_SCOPE && payload.codeHash === createCodeHash(betaCode);

  return {
    allowed,
    configured,
    enabled,
    staffPreview
  };
}

export function getShopBetaBlockedMessage(state = getShopBetaGateState()) {
  if (!state.enabled) {
    return "";
  }

  if (!state.configured) {
    return "Shop in beta privata: codice di accesso non configurato.";
  }

  return "Shop in beta privata. Inserisci il codice beta per continuare.";
}

export function requireShopBetaAccess(cookieValue?: string | null) {
  const state = getShopBetaGateState(cookieValue);

  if (!state.allowed) {
    throw new Error(getShopBetaBlockedMessage(state));
  }

  return state;
}

export function grantShopBetaAccess(inputCode: string) {
  const state = getShopBetaGateState(null);
  const betaCode = readShopBetaCode();
  const accessCode = inputCode.trim();

  if (!state.enabled) {
    return;
  }

  if (!state.configured) {
    throw new Error(getShopBetaBlockedMessage(state));
  }

  if (!accessCode || !safeStringEqual(accessCode, betaCode)) {
    throw new Error("Codice beta non valido.");
  }

  const payload: ShopBetaAccessPayload = {
    codeHash: createCodeHash(betaCode),
    exp: Date.now() + SHOP_BETA_ACCESS_DURATION_SECONDS * 1000,
    scope: SHOP_BETA_SCOPE
  };

  cookies().set(SHOP_BETA_ACCESS_COOKIE, serializeExpiringSignedPayload(payload), {
    httpOnly: true,
    maxAge: SHOP_BETA_ACCESS_DURATION_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
}

export function clearShopBetaAccess() {
  cookies().set(SHOP_BETA_ACCESS_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
}
