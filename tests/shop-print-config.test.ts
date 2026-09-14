import { describe, expect, it } from "vitest";
import {
  SHOP_DOCUMENT_PREVIEW_BASE_PRICE_CENTS,
  SHOP_DOCUMENT_PREVIEW_QUANTITY_TIERS,
  buildShopDocumentBundleDetailedSummary,
  buildShopDocumentBundleOverview,
  buildShopDocumentCardSummary,
  buildShopDocumentOptionsSummary,
  extractShopDocumentBundleFromConfiguration,
  getShopPrintOptionGroups,
  normalizeShopDocumentBundle,
  normalizeShopPrintConfiguration,
  resolveShopDocumentPreviewPricing
} from "../lib/shop-print-config";

describe("shop print configuration", () => {
  it("normalizes unknown values to safe defaults", () => {
    expect(
      normalizeShopPrintConfiguration({
        format: "A5" as never,
        colorMode: "???" as never,
        sidesMode: "DOUBLE_SIDED",
        paperType: "???" as never,
        paperStock: "",
        binding: "WIRE" as never
      })
    ).toEqual({
      format: "A5",
      colorMode: "BLACK_WHITE",
      sidesMode: "DOUBLE_SIDED",
      paperType: "USOMANO",
      paperStock: "USOMANO_80",
      binding: "NONE"
    });
  });

  it("normalizes a multi-document bundle and counts total copies", () => {
    expect(
      normalizeShopDocumentBundle({
        documents: [
          {
            name: "Contratto",
            copies: "2",
            pages: 12,
            format: "A4",
            colorMode: "BLACK_WHITE",
            sidesMode: "DOUBLE_SIDED",
            paperType: "USOMANO",
            paperStock: "USOMANO_80",
            binding: "NONE"
          },
          {
            name: "",
            copies: 3,
            pages: 2,
            format: "SA3",
            colorMode: "COLOR",
            sidesMode: "FRONT_ONLY",
            paperType: "PATINATA_LUCIDA",
            paperStock: "PATINATA_LUCIDA_170",
            binding: "SPIRAL"
          }
        ]
      })
    ).toMatchObject({
      totalCopies: 5,
      totalPages: 14,
      totalPrintUnits: 30,
      documents: [
        { name: "Contratto", copies: 2, pages: 12, binding: "NONE" },
        { name: "Documento 2", copies: 3, pages: 2, binding: "SPIRAL" }
      ]
    });
  });

  it("builds readable summaries for cards and saved orders", () => {
    const bundle = {
      documents: [
        {
          id: "document-1",
          name: "Tesi",
          copies: 1,
          pages: 120,
          format: "A4",
          colorMode: "BLACK_WHITE",
          sidesMode: "FRONT_ONLY",
          paperType: "USOMANO",
          paperStock: "USOMANO_80",
          binding: "SPIRAL"
        },
        {
          id: "document-2",
          name: "Slide",
          copies: 2,
          pages: 8,
          format: "SA3",
          colorMode: "COLOR",
          sidesMode: "DOUBLE_SIDED",
          paperType: "PATINATA_LUCIDA",
          paperStock: "PATINATA_LUCIDA_115",
          binding: "NONE"
        }
      ]
    } as const;

    expect(buildShopDocumentCardSummary(bundle.documents[0], { includeCopies: false })).toBe(
      "120 pagine • A4 • Bianco e nero • Solo fronte • Carta usomano • 80 grammi • Rilegatura a spirale"
    );
    expect(buildShopDocumentOptionsSummary(bundle.documents[1], { compact: true })).toBe(
      "SA3 • A colori • Fronte e retro • Lucida • 115 g • Libero"
    );
    expect(buildShopDocumentBundleOverview(bundle)).toBe("2 documenti • 136 pagine di stampa");
    expect(buildShopDocumentBundleDetailedSummary(bundle)).toBe(
      "Tesi: 1 copia • 120 pagine • A4 • Bianco e nero • Solo fronte • Carta usomano • 80 grammi • Rilegatura a spirale\n" +
        "Slide: 2 copie • 8 pagine • SA3 • A colori • Fronte e retro • Carta patinata lucida • 115 grammi • Senza rilegatura"
    );
  });

  it("keeps paper type and grammatura aligned", () => {
    expect(
      normalizeShopPrintConfiguration({
        paperType: "PATINATA_LUCIDA",
        paperStock: "USOMANO_300"
      })
    ).toMatchObject({
      paperType: "PATINATA_LUCIDA",
      paperStock: "PATINATA_LUCIDA_115"
    });

    expect(
      normalizeShopPrintConfiguration({
        paperStock: "PREMIUM_100"
      })
    ).toMatchObject({
      paperType: "USOMANO",
      paperStock: "USOMANO_100"
    });

    expect(
      getShopPrintOptionGroups({
        paperType: "PATINATA_LUCIDA"
      }).find((group) => group.key === "paperStock")?.options.map((option) => option.value)
    ).toEqual(["PATINATA_LUCIDA_115", "PATINATA_LUCIDA_170"]);
  });

  it("extracts a saved bundle from item configuration", () => {
    expect(
      extractShopDocumentBundleFromConfiguration({
        documentBundle: {
          documents: [
            {
              id: "doc-a",
              name: "Documento principale",
              copies: 4,
              pages: 7,
              format: "A4",
              colorMode: "BLACK_WHITE",
              sidesMode: "DOUBLE_SIDED",
              paperType: "USOMANO",
              paperStock: "USOMANO_80",
              binding: "STAPLED"
            }
          ]
        }
      })
    ).toMatchObject({
      totalCopies: 4,
      totalPages: 7,
      totalPrintUnits: 28,
      documents: [{ name: "Documento principale", pages: 7, binding: "STAPLED" }]
    });
  });

  it("applies preview pricing only to the local document flow", () => {
    expect(
      resolveShopDocumentPreviewPricing(
        {
          basePriceCents: 7000,
          onlineActive: false,
          quantityTiers: null
        },
        "/shop/stampa-documenti"
      )
    ).toMatchObject({
      basePriceCents: SHOP_DOCUMENT_PREVIEW_BASE_PRICE_CENTS,
      quantityTiers: SHOP_DOCUMENT_PREVIEW_QUANTITY_TIERS
    });

    expect(
      resolveShopDocumentPreviewPricing(
        {
          basePriceCents: 7000,
          onlineActive: true,
          quantityTiers: null
        },
        "/shop/stampa-documenti"
      )
    ).toMatchObject({
      basePriceCents: 7000,
      quantityTiers: null
    });
  });
});
