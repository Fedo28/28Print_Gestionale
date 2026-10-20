import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import { isNightExemptPath, nightPauseEnabled } from "../lib/night-pause";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-20T18:00:00Z"));
  vi.stubEnv("NIGHT_PAUSE_ENABLED", "true");
  vi.stubEnv("SHOP_BETA_LOCKED", "false");
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

const request = (path: string, method = "GET", host = "gestionale.invalid") =>
  new NextRequest(`https://${host}${path}`, { method, headers: { host } });

describe("pausa notturna prima del database", () => {
  it("blocca pagine, API, Server Actions e login con risposta non memorizzabile", async () => {
    for (const path of ["/", "/orders", "/login", "/settings"]) {
      const response = await middleware(request(path));
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("https://gestionale.invalid/sospensione");
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(response.headers.get("retry-after")).toBe("43200");
    }
    for (const [path, method] of [["/api/search", "GET"], ["/orders", "POST"], ["/login", "POST"]]) {
      const response = await middleware(request(path, method));
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ code: "NIGHT_PAUSE" });
    }
  });
  it("riapre esattamente alle 8 senza interventi manuali", async () => {
    vi.setSystemTime(new Date("2026-10-21T06:00:00Z"));
    expect((await middleware(request("/orders"))).headers.get("x-middleware-next")).toBe("1");
  });
  it("lascia shop, webhook, cron e completamenti Bridge alle rispettive autenticazioni", async () => {
    for (const path of ["/sospensione", "/shop", "/api/shop/orders", "/api/shop/payments/stripe/webhook",
      "/api/webhooks/whatsapp", "/api/cron/site-renewal-reminders", "/api/print-bridge",
      "/api/print-bridge/jobs/synthetic/file", "/manifest.webmanifest"]) {
      expect(isNightExemptPath(path)).toBe(true);
      expect((await middleware(request(path))).headers.get("x-middleware-next")).toBe("1");
    }
    expect(isNightExemptPath("/orders/file.png")).toBe(false);
    expect(isNightExemptPath("/shopping")).toBe(false);
    expect((await middleware(request("/login", "GET", "shop.28print.it"))).status).toBe(404);
    expect((await middleware(request("/", "GET", "shop.28print.it"))).headers.get("location"))
      .toBe("https://shop.28print.it/shop");
  });
  it("mantiene una disattivazione server esplicita per emergenze e sviluppo", () => {
    vi.stubEnv("NIGHT_PAUSE_ENABLED", "false");
    expect(nightPauseEnabled()).toBe(false);
  });
});
