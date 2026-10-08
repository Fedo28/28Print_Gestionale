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
import {
  applyShopCatalogPriceMultiplier,
  resolveShopCatalogCustomization
} from "../lib/shop-catalog-customizations";
import { computeShopStickerQuote } from "../lib/shop-sticker-pricing";

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
    expect(
      resolveServiceCatalogPriceMode({
        serviceCatalogCode: "VOLANTINO_10X21_FRONTE_RETRO_CON_PIEGA",
        serviceCatalogName: "Volantino - 10x21 fronte/retro con piega"
      })
    ).toBe("LINE_TOTAL");
    expect(resolveServiceCatalogPriceMode({ serviceCatalogName: "Copie a colori" })).toBe("UNIT");
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

  it("quotes body-priced flyers without multiplying tier totals by quantity", () => {
    const service = {
      id: "svc-flyer-10x21",
      code: "VOLANTINO_10X21_FRONTE_RETRO_CON_PIEGA_APERTO_20X21_CARTA_PATINATA_115_GR",
      name: "Volantino - 10x21 fronte/retro con piega, aperto 20x21, carta patinata 115 gr",
      basePriceCents: 14000,
      quantityTiers: "100:140,00 | 250:150,00 | 500:160,00 | 1000:180,00"
    };

    const quote = quoteCatalogService({
      service,
      quantity: 100
    });

    expect(quote.catalogBasePriceCents).toBe(14000);
    expect(quote.catalogPriceMode).toBe("LINE_TOTAL");
    expect(quote.lineTotalCents).toBe(14000);
    expect(quote.unitPriceCents).toBe(140);

    const intermediateQuote = quoteCatalogService({
      service,
      quantity: 200
    });

    expect(intermediateQuote.catalogBasePriceCents).toBe(14000);
    expect(intermediateQuote.lineTotalCents).toBe(14000);
  });

  it("separates copies per subject from total quantity for catalog subjects", () => {
    const flyerCustomization = resolveShopCatalogCustomization({
      selection: {
        subjectQuantities: [100, 250, 100],
        subjectPricingMode: "per-subject"
      },
      sourcePath: "/shop/servizi/volantini"
    });

    expect(flyerCustomization.priceMultiplier).toBe(1);
    expect(flyerCustomization.subject).toMatchObject({
      copiesPerSubject: 100,
      pricingMode: "per-subject",
      subjectCount: 3,
      subjectQuantities: [100, 250, 100],
      totalQuantity: 450
    });
    expect(flyerCustomization.summaryLines).toEqual([
      "Soggetti: 3",
      "Copie per file: 100 + 250 + 100 pz",
      "Totale copie: 450 pz"
    ]);

    const posterCustomization = resolveShopCatalogCustomization({
      selection: {
        subjectQuantities: [10, 5, 15],
        subjectPricingMode: "total-quantity"
      },
      sourcePath: "/shop/servizi/locandine"
    });

    expect(posterCustomization.priceMultiplier).toBe(1);
    expect(posterCustomization.subject).toMatchObject({
      copiesPerSubject: 10,
      pricingMode: "total-quantity",
      subjectCount: 3,
      subjectQuantities: [10, 5, 15],
      totalQuantity: 30
    });
  });

  it("applies the business-card hammered paper surcharge only to shop business cards", () => {
    const customization = resolveShopCatalogCustomization({
      selection: {
        paperId: "hammered",
        paperVariantId: "cream"
      },
      sourcePath: "/shop/servizi/biglietti-da-visita"
    });

    expect(customization.priceMultiplier).toBe(1.2);
    expect(customization.summaryLines).toEqual([
      "Carta: Martellata 300 gr crema",
      "Supplemento carta: +20%"
    ]);
    expect(applyShopCatalogPriceMultiplier(10000, customization.priceMultiplier)).toBe(12000);

    expect(
      resolveShopCatalogCustomization({
        selection: {
          paperId: "hammered",
          paperVariantId: "cream"
        },
        sourcePath: "/shop/servizi/volantini-e-locandine"
      }).priceMultiplier
    ).toBe(1);
  });

  it("calculates custom shop banner pricing on the server", () => {
    const standardCustomization = resolveShopCatalogCustomization({
      selection: {
        banner: {
          heightM: 1,
          material: "pvc",
          priceProfile: "standard-3x1",
          quantity: 1,
          reinforced: true,
          widthM: 3
        }
      },
      sourcePath: "/shop/servizi/banner-e-striscioni"
    });

    expect(standardCustomization.lineTotalCents).toBe(6000);
    expect(standardCustomization.quantity).toBe(1);

    const pvcCustomization = resolveShopCatalogCustomization({
      selection: {
        banner: {
          heightM: 1,
          material: "pvc",
          quantity: 1,
          reinforced: true,
          widthM: 3
        }
      },
      sourcePath: "/shop/servizi/banner-e-striscioni"
    });

    expect(pvcCustomization.lineTotalCents).toBe(12000);
    expect(pvcCustomization.quantity).toBe(1);
    expect(pvcCustomization.summaryLines).toEqual([
      "Materiale: PVC",
      "Misure: 3x1 m",
      "Area: 3 mq",
      "Occhielli: 16",
      "Rinforzo: Si"
    ]);

    const meshCustomization = resolveShopCatalogCustomization({
      selection: {
        banner: {
          heightM: 1,
          material: "mesh",
          quantity: 2,
          reinforced: true,
          widthM: 2
        }
      },
      sourcePath: "/shop/servizi/banner-e-striscioni"
    });

    expect(meshCustomization.lineTotalCents).toBe(21400);
    expect(meshCustomization.quantity).toBe(2);
  });

  it("calculates shop stamp rubber lines on the server", () => {
    const customization = resolveShopCatalogCustomization({
      selection: {
        stamp: {
          lines: ["Studio Rossi", "Via Roma 12", "P.IVA 123"],
          model: "C30",
          quantity: 2
        }
      },
      sourcePath: "/shop/servizi/timbri"
    });

    expect(customization.extraLineTotalCents).toBe(1200);
    expect(customization.quantity).toBe(2);
    expect(customization.summaryLines).toEqual([
      "Modello: Timbro C30",
      "Misura: 18x47 mm",
      "Stile: Arial regular 8 pt",
      "Testo timbro: 3 righe",
      "Gommina: 3 x 2,00 EUR",
      "Riga 1: Studio Rossi",
      "Riga 2: Via Roma 12",
      "Riga 3: P.IVA 123"
    ]);
  });

  it("keeps per-line stamp font weights on the server", () => {
    const customization = resolveShopCatalogCustomization({
      selection: {
        stamp: {
          lineWeights: ["bold", "regular"],
          lines: ["Studio Rossi", "Via Roma 12"],
          model: "C30",
          quantity: 1
        }
      },
      sourcePath: "/shop/servizi/timbri"
    });

    expect(customization.extraLineTotalCents).toBe(400);
    expect(customization.summaryLines).toEqual([
      "Modello: Timbro C30",
      "Misura: 18x47 mm",
      "Stile: Arial 8 pt",
      "Testo timbro: 2 righe",
      "Gommina: 2 x 2,00 EUR",
      "Riga 1 (bold): Studio Rossi",
      "Riga 2 (regular): Via Roma 12"
    ]);
  });

  it("rounds large-format stickers to half-square-meter billing steps", () => {
    expect(
      computeShopStickerQuote({
        heightCm: 50,
        material: "polimerico",
        pricePerSqmCents: 4000,
        widthCm: 100
      })
    ).toMatchObject({
      areaSqm: 0.5,
      billableSqm: 0.5,
      totalCents: 2000
    });

    expect(
      computeShopStickerQuote({
        heightCm: 51,
        material: "polimerico",
        pricePerSqmCents: 4000,
        widthCm: 100
      })
    ).toMatchObject({
      areaSqm: 0.51,
      billableSqm: 1,
      totalCents: 4000
    });

    expect(
      computeShopStickerQuote({
        heightCm: 110,
        material: "polimerico-laminato",
        pricePerSqmCents: 5200,
        widthCm: 100
      })
    ).toMatchObject({
      areaSqm: 1.1,
      billableSqm: 1.5,
      totalCents: 7800
    });

    const customization = resolveShopCatalogCustomization({
      selection: {
        sticker: {
          heightCm: 51,
          material: "polimerico",
          widthCm: 100
        }
      },
      sourcePath: "/shop/servizi/adesivi-e-vetrofanie"
    });

    expect(customization.quantity).toBe(1);
    expect(customization.summaryLines).toEqual([
      "Materiale: Polimerico",
      "Misure: 100x51 cm",
      "Area: 0,51 mq",
      "Area conteggiata: 1 mq"
    ]);
  });

  it("calculates shop adhesive labels as pieces with a one-square-meter minimum", () => {
    const customization = resolveShopCatalogCustomization({
      selection: {
        label: {
          heightCm: 5,
          material: "polimerico",
          pricePerSqmCents: 4800,
          quantity: 100,
          widthCm: 5
        }
      },
      sourcePath: "/shop/servizi/etichette-adesive"
    });

    expect(customization.lineTotalCents).toBe(6800);
    expect(customization.quantity).toBe(278);
    expect(customization.summaryLines).toEqual([
      "Materiale: Polimerico",
      "Formato etichetta: 5x5 cm",
      "Etichette: 278 pz",
      "Area calcolo: 1,0 mq",
      "Area conteggiata: 1 mq",
      "Impianto: 20,00 EUR"
    ]);
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
      valid: true,
      normalizedFileName: "anteprima.png",
      normalizedMimeType: "image/png"
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
