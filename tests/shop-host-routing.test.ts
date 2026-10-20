import { describe, expect, it } from "vitest";
import { getShopHostRoute, isShopPublicHostname } from "../lib/shop-host-routing";

describe("shop host separation", () => {
  it("routes only the exact public shop domain to the storefront", () => {
    expect(isShopPublicHostname("shop.28print.it")).toBe(true);
    expect(isShopPublicHostname("SHOP.28PRINT.IT:443")).toBe(true);
    expect(isShopPublicHostname("shop.28print.it.evil.example")).toBe(false);
    expect(getShopHostRoute("/", "shop.28print.it")).toBe("shop-home");
    expect(getShopHostRoute("/shop/servizi/stampa-foto", "shop.28print.it")).toBe("shop-route");
    expect(getShopHostRoute("/api/shop/orders", "shop.28print.it")).toBe("shop-route");
  });

  it("hides staff pages and APIs without altering the management or preview hosts", () => {
    for (const path of ["/login", "/orders", "/settings", "/api/orders/shop-online/pending", "/api/print-bridge"]) {
      expect(getShopHostRoute(path, "shop.28print.it")).toBe("not-found");
    }
    expect(getShopHostRoute("/", "28-print-gestionale.vercel.app")).toBe("other-host");
    expect(getShopHostRoute("/shop", "28print-bridge-v1-preview.vercel.app")).toBe("other-host");
  });
});
