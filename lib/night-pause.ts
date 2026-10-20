export { isNightPause, nextOpening, romeMinutes } from "@/bridge/src/service-hours";

export function nightPauseEnabled() {
  // Explicit local opt-in allows deterministic tests without blocking development.
  return process.env.NIGHT_PAUSE_ENABLED === "true" ||
    (process.env.NODE_ENV === "production" && process.env.NIGHT_PAUSE_ENABLED !== "false");
}

export function isNightExemptPath(path: string) {
  return path === "/sospensione" || path === "/shop" || path.startsWith("/shop/") ||
    path === "/api/shop" || path.startsWith("/api/shop/") ||
    path.startsWith("/api/webhooks/") || path.startsWith("/api/cron/") ||
    path === "/api/print-bridge" || path.startsWith("/api/print-bridge/") ||
    path.startsWith("/_next/") || path.startsWith("/patterns/") ||
    ["/favicon.ico", "/manifest.webmanifest", "/shop-push-worker.js", "/robots.txt"].includes(path);
}
