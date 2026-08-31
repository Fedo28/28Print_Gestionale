import { describe, expect, it } from "vitest";
import {
  isLabelCalculatorFormat,
  normalizeServiceCode,
  resolveServiceCatalogPriceMode
} from "../lib/domain/catalog/service-catalog";
import {
  DEFAULT_SHOP_PUBLIC_BASE_URL,
  resolveSalesOrderItemJobCreationReason,
  resolveSalesOrderStatusAfterPayment,
  resolveShopPublicBaseUrl,
  shouldCreateSalesOrderItemJob
} from "../lib/domain/commerce/shop-foundation";
import {
  buildShopFileAssetStorageKey,
  resolveShopFileExpiresAt,
  validateShopFileCandidate
} from "../lib/domain/files/shop-file-assets";
import {
  buildCatalogServicePricingSnapshot,
  quoteCatalogService
} from "../lib/domain/pricing/service-pricing";

describe("shop foundation", () => {
  it("normalizes service codes in the shared catalog module", () => {
    expect(normalizeServiceCode("Biglietti visita premium")).toBe("BIGLIETTI_VISITA_PREMIUM");
    expect(normalizeServiceCode("Installazione / Vetrina")).toBe("INSTALLAZIONE_VETRINA");
  });

  it("detects label calculator rows and line-total catalog pricing", () => {
    expect(isLabelCalculatorFormat("Calcolatore etichette • 10x12 cm")).toBe(true);
    expect(
      resolveServiceCatalogPriceMode({
        serviceCatalogName: "Biglietti da visita",
        serviceCatalogCode: "BIGLIETTI_VISITA"
      })
    ).toBe("LINE_TOTAL");
    expect(resolveServiceCatalogPriceMode({ serviceCatalogName: "Volantini A5" })).toBe("UNIT");
  });

  it("builds a reusable catalog quote and pricing snapshot", () => {
    const service = {
      id: "svc-docs",
      code: "STAMPA_DOCUMENTI",
      name: "Stampa documenti",
      basePriceCents: 120,
      quantityTiers: "1-9:1,20 | 10+:0,95"
    };

    const quote = quoteCatalogService({
      service,
      quantity: 12,
      discountMode: "PERCENT",
      discountValue: 10
    });

    expect(quote.catalogBasePriceCents).toBe(95);
    expect(quote.catalogPriceMode).toBe("UNIT");
    expect(quote.lineTotalCents).toBe(1026);
    expect(quote.pricingSource).toBe("quantity_tier");

    expect(
      buildCatalogServicePricingSnapshot({
        service,
        quantity: 12,
        discountMode: "PERCENT",
        discountValue: 10
      })
    ).toMatchObject({
      serviceCatalogId: "svc-docs",
      serviceCatalogCode: "STAMPA_DOCUMENTI",
      quantity: 12,
      lineTotalCents: 1026,
      pricingSource: "quantity_tier"
    });
  });

  it("keeps the job-creation rule aligned with invoice requirements", () => {
    expect(shouldCreateSalesOrderItemJob({ createJobAutomatically: false, invoiceRequested: false })).toBe(false);
    expect(shouldCreateSalesOrderItemJob({ createJobAutomatically: true, invoiceRequested: false })).toBe(true);
    expect(shouldCreateSalesOrderItemJob({ createJobAutomatically: false, invoiceRequested: true })).toBe(true);
    expect(
      resolveSalesOrderItemJobCreationReason({ createJobAutomatically: true, invoiceRequested: true })
    ).toBe("AUTO_PRODUCT_POLICY_AND_INVOICE_REQUESTED");
    expect(resolveSalesOrderStatusAfterPayment(true)).toBe("PAID");
    expect(resolveSalesOrderStatusAfterPayment(false)).toBe("PAYMENT_FAILED");
  });

  it("normalizes the public shop base url with the confirmed subdomain", () => {
    expect(resolveShopPublicBaseUrl("shop.28print.it")).toBe("https://shop.28print.it");
    expect(resolveShopPublicBaseUrl("")).toBe(DEFAULT_SHOP_PUBLIC_BASE_URL);
  });

  it("validates supported shop file candidates and builds private asset keys", () => {
    expect(
      validateShopFileCandidate({
        fileName: "tesi-finale.PDF",
        mimeType: "application/pdf",
        sizeBytes: 1024
      })
    ).toMatchObject({
      valid: true,
      normalizedFileName: "tesi-finale.PDF",
      normalizedMimeType: "application/pdf"
    });

    expect(
      validateShopFileCandidate({
        fileName: "anteprima.png",
        mimeType: "image/png",
        sizeBytes: 1024
      })
    ).toMatchObject({
      valid: false
    });

    expect(
      buildShopFileAssetStorageKey({
        customerId: "cust-1",
        salesOrderId: "order-9",
        salesOrderItemId: "item-2",
        fileName: "tesi.pdf",
        now: new Date("2026-08-27T10:30:00.000Z")
      })
    ).toBe("shop/customers/cust-1/orders/order-9/items/item-2/1787826600000_tesi.pdf");
  });

  it("computes the default shop file expiration window", () => {
    expect(resolveShopFileExpiresAt("2026-08-27T00:00:00.000Z").toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });
});
