export function printEnabled() {
  return process.env.PRINT_BRIDGE_ENABLED === "true" && process.env.PRINT_BRIDGE_ENVIRONMENT === "test" && process.env.VERCEL_ENV !== "production";
}
export function assertPrintEnabled() {
  if (!printEnabled()) throw new Error("Bridge disattivato: Fase 2 disponibile solo nell'ambiente di test.");
}
export function isLocalPrintTest() {
  if (process.env.PRINT_BRIDGE_LOCAL_TEST !== "true" || process.env.VERCEL) return false;
  try {
    const url = new URL(process.env.DATABASE_URL || "");
    return url.hostname === "127.0.0.1" && url.port === "54339" && url.pathname === "/fede_print_bridge_test";
  } catch { return false; }
}
export function assertPrintTransport(request: Request) {
  assertPrintEnabled();
  const url = new URL(request.url);
  if (url.protocol === "https:") return;
  if (isLocalPrintTest() && ["127.0.0.1", "localhost"].includes(url.hostname)) return;
  throw new Error("Il Bridge richiede HTTPS.");
}
