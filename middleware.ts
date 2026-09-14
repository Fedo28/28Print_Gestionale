import { NextRequest, NextResponse } from "next/server";

const SHOP_BETA_ACCESS_COOKIE = "fede_shop_beta_access";
const SHOP_BETA_ACCESS_PATH = "/shop/accesso-beta";
const SHOP_BETA_SCOPE = "shop-beta";
const SHOP_PUBLIC_ASSET_EXTENSION_PATTERN =
  /\.(?:avif|gif|ico|jpg|jpeg|png|svg|webp|css|js|map|txt|xml|webmanifest|woff|woff2)$/i;

function isTruthyEnv(value?: string | null) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function safeStringEqual(a: string, b: string) {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return result === 0;
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return atob(padded);
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function signPayload(encodedPayload: string) {
  const authSecret =
    process.env.AUTH_SECRET?.trim() || (process.env.NODE_ENV === "production" ? "" : "change-me-in-production");

  if (!authSecret) {
    return "";
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authSecret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encodedPayload));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readVerifiedBetaPayload(cookieValue?: string | null) {
  if (!cookieValue) {
    return null;
  }

  const [encodedPayload, signature] = cookieValue.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = await signPayload(encodedPayload);
  if (!expectedSignature || !safeStringEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as {
      codeHash?: unknown;
      exp?: unknown;
      scope?: unknown;
    };

    if (typeof payload.exp !== "number" || payload.exp < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

async function hasShopBetaAccess(request: NextRequest) {
  if (!isTruthyEnv(process.env.SHOP_BETA_LOCKED)) {
    return true;
  }

  const betaCode = process.env.SHOP_BETA_ACCESS_CODE?.trim();
  if (!betaCode) {
    return false;
  }

  const payload = await readVerifiedBetaPayload(request.cookies.get(SHOP_BETA_ACCESS_COOKIE)?.value);
  return payload?.scope === SHOP_BETA_SCOPE && payload.codeHash === (await sha256Hex(betaCode));
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isBetaAccessPage = pathname === SHOP_BETA_ACCESS_PATH || pathname.startsWith(`${SHOP_BETA_ACCESS_PATH}/`);

  if (SHOP_PUBLIC_ASSET_EXTENSION_PATTERN.test(pathname)) {
    return NextResponse.next();
  }

  if (isBetaAccessPage || (await hasShopBetaAccess(request))) {
    return NextResponse.next();
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.json(
      { error: "Shop in beta privata. Inserisci il codice beta per continuare." },
      { status: 403 }
    );
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = SHOP_BETA_ACCESS_PATH;
  redirectUrl.search = "";
  redirectUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/shop/:path*"]
};
