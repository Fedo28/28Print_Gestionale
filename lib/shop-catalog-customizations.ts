import type { Prisma } from "@prisma/client";
import {
  buildShopLabelSummaryLines,
  computeShopLabelQuote,
  normalizeShopLabelSelection,
  type ShopLabelQuote,
  type ShopLabelSelectionInput
} from "@/lib/label-calculator";
import {
  buildShopBannerSummaryLines,
  computeShopBannerQuote,
  normalizeShopBannerSelection,
  type ShopBannerQuote,
  type ShopBannerSelectionInput
} from "@/lib/shop-banner-pricing";
import type { ShopCatalogProductPaperChoice } from "@/lib/shop-product-pages";
import {
  buildShopStampSummaryLines,
  computeShopStampCustomization,
  normalizeShopStampSelection,
  type ShopStampCustomization,
  type ShopStampSelectionInput
} from "@/lib/shop-stamp-pricing";
import {
  buildShopStickerSummaryLines,
  computeShopStickerQuote,
  normalizeShopStickerSelection,
  type ShopStickerQuote,
  type ShopStickerSelectionInput
} from "@/lib/shop-sticker-pricing";

export type ShopCatalogSelectionInput = {
  banner?: ShopBannerSelectionInput | null;
  copiesPerSubject?: number | null;
  label?: ShopLabelSelectionInput | null;
  paperId?: string | null;
  paperVariantId?: string | null;
  stamp?: ShopStampSelectionInput | null;
  sticker?: ShopStickerSelectionInput | null;
  subjectCount?: number | null;
  subjectPricingMode?: "per-subject" | "total-quantity" | null;
  subjectQuantities?: number[] | null;
};

export type ShopCatalogSubjectCustomization = {
  copiesPerSubject: number;
  pricingMode: "per-subject" | "total-quantity";
  subjectCount: number;
  subjectQuantities: number[];
  totalQuantity: number;
};

export type ShopCatalogCustomization = {
  banner: ShopBannerQuote | null;
  configuration: Prisma.InputJsonObject | null;
  extraLineTotalCents: number;
  label: ShopLabelQuote | null;
  lineTotalCents: number | null;
  priceMultiplier: number;
  quantity: number | null;
  stamp: ShopStampCustomization | null;
  sticker: ShopStickerQuote | null;
  subject: ShopCatalogSubjectCustomization | null;
  summaryLines: string[];
};

export const BUSINESS_CARD_PAPER_CHOICES: ShopCatalogProductPaperChoice[] = [
  {
    id: "smooth",
    label: "Liscia",
    note: "300 gr"
  },
  {
    id: "hammered",
    label: "Martellata",
    note: "300 gr",
    priceMultiplier: 1.2,
    variants: [
      {
        id: "white",
        label: "Bianca"
      },
      {
        id: "cream",
        label: "Crema"
      }
    ]
  }
];

function isBusinessCardSource(sourcePath: string | null | undefined) {
  return String(sourcePath || "").includes("/shop/servizi/biglietti-da-visita");
}

function isBannerSource(sourcePath: string | null | undefined) {
  return String(sourcePath || "").includes("/shop/servizi/banner-e-striscioni");
}

function isStampSource(sourcePath: string | null | undefined) {
  return String(sourcePath || "").includes("/shop/servizi/timbri");
}

function isStickerSource(sourcePath: string | null | undefined) {
  return String(sourcePath || "").includes("/shop/servizi/adesivi-e-vetrofanie");
}

function isLabelSource(sourcePath: string | null | undefined) {
  return String(sourcePath || "").includes("/shop/servizi/etichette-adesive");
}

function normalizePercentFromMultiplier(multiplier: number) {
  return Math.max(0, Math.round((multiplier - 1) * 100));
}

function normalizePositiveInteger(value: unknown, fallback = 1) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value || ""));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.max(1, Math.round(parsed));
}

function normalizeSubjectPricingMode(value: unknown): ShopCatalogSelectionInput["subjectPricingMode"] {
  return value === "per-subject" || value === "total-quantity" ? value : null;
}

function normalizeSubjectQuantities(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const quantities = value.map((entry) => normalizePositiveInteger(entry)).filter((entry) => entry > 0);
  return quantities.length ? quantities : null;
}

export function normalizeShopCatalogSelection(value: unknown): ShopCatalogSelectionInput | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  return {
    banner: normalizeShopBannerSelection(record.banner),
    copiesPerSubject: record.copiesPerSubject ? normalizePositiveInteger(record.copiesPerSubject) : null,
    label: normalizeShopLabelSelection(record.label),
    paperId: typeof record.paperId === "string" ? record.paperId : null,
    paperVariantId: typeof record.paperVariantId === "string" ? record.paperVariantId : null,
    stamp: normalizeShopStampSelection(record.stamp),
    sticker: normalizeShopStickerSelection(record.sticker),
    subjectCount: record.subjectCount ? normalizePositiveInteger(record.subjectCount) : null,
    subjectPricingMode: normalizeSubjectPricingMode(record.subjectPricingMode),
    subjectQuantities: normalizeSubjectQuantities(record.subjectQuantities)
  };
}

function resolveSubjectCustomization(selection: ShopCatalogSelectionInput | null | undefined) {
  const fallbackCopiesPerSubject = normalizePositiveInteger(selection?.copiesPerSubject, 1);
  const subjectQuantities =
    selection?.subjectQuantities?.length
      ? selection.subjectQuantities.map((quantity) => normalizePositiveInteger(quantity))
      : Array.from({ length: normalizePositiveInteger(selection?.subjectCount, 1) }, () => fallbackCopiesPerSubject);
  const copiesPerSubject = subjectQuantities[0] || fallbackCopiesPerSubject;
  const subjectCount = subjectQuantities.length;
  const pricingMode = selection?.subjectPricingMode || "total-quantity";

  if (subjectCount <= 1) {
    return null;
  }

  return {
    copiesPerSubject,
    pricingMode,
    subjectCount,
    subjectQuantities,
    totalQuantity: subjectQuantities.reduce((total, quantity) => total + quantity, 0)
  } satisfies ShopCatalogSubjectCustomization;
}

export function resolveShopCatalogCustomization(input: {
  selection?: ShopCatalogSelectionInput | null;
  sourcePath?: string | null;
}): ShopCatalogCustomization {
  const subject = resolveSubjectCustomization(input.selection);
  const banner =
    isBannerSource(input.sourcePath) && input.selection?.banner
      ? computeShopBannerQuote(input.selection.banner)
      : null;
  const stamp =
    isStampSource(input.sourcePath) && input.selection?.stamp
      ? computeShopStampCustomization(input.selection.stamp)
      : null;
  const sticker =
    isStickerSource(input.sourcePath) && input.selection?.sticker
      ? computeShopStickerQuote(input.selection.sticker)
      : null;
  const label =
    isLabelSource(input.sourcePath) && input.selection?.label
      ? computeShopLabelQuote(input.selection.label)
      : null;

  if (stamp?.overMaxLines) {
    throw new Error("Configurazione shop non valida.");
  }
  const subjectSummaryLines = subject
    ? [
        `Soggetti: ${subject.subjectCount}`,
        `Copie per file: ${subject.subjectQuantities.join(" + ")} pz`,
        `Totale copie: ${subject.totalQuantity} pz`
      ]
    : [];
  const bannerSummaryLines = banner ? buildShopBannerSummaryLines(banner) : [];
  const stickerSummaryLines = sticker ? buildShopStickerSummaryLines(sticker) : [];
  const labelSummaryLines = label ? buildShopLabelSummaryLines(label) : [];
  const stampSummaryLines = stamp
    ? [
        ...buildShopStampSummaryLines(stamp),
        ...stamp.lines.map((line, index) => {
          const hasBoldLine = stamp.lineStyles.some((style) => style.fontWeight === "bold");
          const lineWeight = stamp.lineStyles[index]?.fontWeight || stamp.fontWeight;
          return hasBoldLine ? `Riga ${index + 1} (${lineWeight}): ${line}` : `Riga ${index + 1}: ${line}`;
        })
      ]
    : [];
  const subjectMultiplier = 1;

  if (!isBusinessCardSource(input.sourcePath)) {
    const configuration =
      subject || banner || stamp || sticker || label
        ? ({
            banner,
            label,
            stamp,
            sticker,
            subjects: subject
          } satisfies Prisma.InputJsonObject)
        : null;

    return {
      banner,
      configuration,
      extraLineTotalCents: stamp?.rubberLineTotalCents ?? 0,
      label,
      lineTotalCents: banner?.totalCents ?? label?.totalCents ?? null,
      priceMultiplier: subjectMultiplier,
      quantity: banner?.quantity ?? stamp?.quantity ?? label?.quantity ?? sticker?.billableSqm ?? null,
      stamp,
      sticker,
      subject,
      summaryLines: [
        ...bannerSummaryLines,
        ...stickerSummaryLines,
        ...labelSummaryLines,
        ...stampSummaryLines,
        ...subjectSummaryLines
      ]
    };
  }

  const paperId = input.selection?.paperId || BUSINESS_CARD_PAPER_CHOICES[0]?.id;
  const paperChoice = BUSINESS_CARD_PAPER_CHOICES.find((choice) => choice.id === paperId);
  if (!paperChoice) {
    throw new Error("Configurazione shop non valida.");
  }

  const paperVariantId = paperChoice.variants?.length
    ? input.selection?.paperVariantId || paperChoice.variants[0]?.id
    : null;
  const paperVariant = paperChoice.variants?.length
    ? paperChoice.variants.find((variant) => variant.id === paperVariantId)
    : null;

  if (paperChoice.variants?.length && !paperVariant) {
    throw new Error("Configurazione shop non valida.");
  }

  const paperPriceMultiplier = paperChoice.priceMultiplier || 1;
  const priceMultiplier = paperPriceMultiplier * subjectMultiplier;
  const surchargePercent = normalizePercentFromMultiplier(paperPriceMultiplier);
  const paperSummary = [
    "Carta:",
    paperChoice.label,
    paperChoice.note,
    paperVariant ? paperVariant.label.toLowerCase() : null
  ]
    .filter(Boolean)
    .join(" ");

  return {
    banner: null,
    configuration: {
      paper: {
        id: paperChoice.id,
        label: paperChoice.label,
        note: paperChoice.note,
        priceMultiplier: paperPriceMultiplier,
        surchargePercent,
        variant: paperVariant
          ? {
              id: paperVariant.id,
              label: paperVariant.label
            }
          : null
      },
      subjects: subject
    } satisfies Prisma.InputJsonObject,
    extraLineTotalCents: 0,
    label: null,
    lineTotalCents: null,
    priceMultiplier,
    quantity: null,
    stamp: null,
    sticker: null,
    subject,
    summaryLines: [
      paperSummary,
      surchargePercent > 0 ? `Supplemento carta: +${surchargePercent}%` : null,
      ...subjectSummaryLines
    ].filter((line): line is string => Boolean(line))
  };
}

export function applyShopCatalogPriceMultiplier(basePriceCents: number, multiplier: number) {
  const safeBasePriceCents = Number.isFinite(basePriceCents) ? Math.max(0, Math.round(basePriceCents)) : 0;
  const safeMultiplier = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
  return Math.max(0, Math.round(safeBasePriceCents * safeMultiplier));
}
