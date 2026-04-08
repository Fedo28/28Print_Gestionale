function normalizeBaseUrl(raw: string) {
  const value = raw.trim();
  if (!value) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  try {
    return new URL(withProtocol).origin;
  } catch {
    return null;
  }
}

export function getRequestBaseUrl(headerStore: Headers) {
  const forwardedProto = headerStore.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = headerStore.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || headerStore.get("host")?.trim();

  if (!host) {
    return null;
  }

  return normalizeBaseUrl(`${forwardedProto || "https"}://${host}`);
}
