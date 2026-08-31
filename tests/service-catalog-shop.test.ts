import { describe, expect, it } from "vitest";
import {
  buildDefaultShopServiceSlug,
  buildUniqueShopServiceSlug,
  normalizeShopServiceSlug
} from "../lib/domain/catalog/service-catalog";

describe("shop service catalog helpers", () => {
  it("normalizes frontend slugs for published services", () => {
    expect(normalizeShopServiceSlug(" Stampa documenti A4 ")).toBe("stampa-documenti-a4");
  });

  it("builds a fallback slug from service metadata", () => {
    expect(
      buildDefaultShopServiceSlug({
        name: "Stampa documenti",
        code: "STAMPA_DOCUMENTI"
      })
    ).toBe("stampa-documenti");
  });

  it("creates unique shop slugs when the base is already used", () => {
    const usedSlugs = new Set(["stampa-documenti"]);
    expect(buildUniqueShopServiceSlug("stampa-documenti", usedSlugs)).toBe("stampa-documenti-2");
  });
});
