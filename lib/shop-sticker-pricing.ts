export type ShopStickerMaterial = "polimerico" | "polimerico-laminato";

export type ShopStickerSelectionInput = {
  heightCm?: number | string | null;
  material?: string | null;
  pricePerSqmCents?: number | string | null;
  widthCm?: number | string | null;
};

export type ShopStickerQuote = {
  areaSqm: number;
  billableSqm: number;
  heightCm: number;
  material: ShopStickerMaterial;
  pricePerSqmCents: number;
  totalCents: number;
  widthCm: number;
};

export const SHOP_STICKER_MIN_BILLABLE_SQM = 0.5;
export const SHOP_STICKER_STEP_SQM = 0.5;

const SHOP_STICKER_MIN_SIZE_CM = 1;

function parsePositiveMetric(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value || "").replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.round(parsed * 100) / 100;
}

function normalizePriceCents(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value || "").replace(",", "."));
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

export function normalizeShopStickerMaterial(value: unknown): ShopStickerMaterial {
  return String(value || "").trim().toLowerCase() === "polimerico-laminato"
    ? "polimerico-laminato"
    : "polimerico";
}

export function getShopStickerMaterialLabel(material: ShopStickerMaterial) {
  return material === "polimerico-laminato" ? "Polimerico laminato" : "Polimerico";
}

export function formatShopStickerMetric(value: number) {
  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1
  }).format(value);
}

export function normalizeShopStickerSelection(value: unknown): ShopStickerSelectionInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  return {
    heightCm: record.heightCm as ShopStickerSelectionInput["heightCm"],
    material: typeof record.material === "string" ? record.material : null,
    pricePerSqmCents: record.pricePerSqmCents as ShopStickerSelectionInput["pricePerSqmCents"],
    widthCm: record.widthCm as ShopStickerSelectionInput["widthCm"]
  };
}

export function computeShopStickerQuote(input: ShopStickerSelectionInput): ShopStickerQuote {
  const material = normalizeShopStickerMaterial(input.material);
  const widthCm = Math.max(SHOP_STICKER_MIN_SIZE_CM, parsePositiveMetric(input.widthCm, 100));
  const heightCm = Math.max(SHOP_STICKER_MIN_SIZE_CM, parsePositiveMetric(input.heightCm, 50));
  const pricePerSqmCents = normalizePriceCents(input.pricePerSqmCents);
  const areaSqm = Math.round((widthCm / 100) * (heightCm / 100) * 1000) / 1000;
  const steppedArea = Math.ceil(areaSqm / SHOP_STICKER_STEP_SQM) * SHOP_STICKER_STEP_SQM;
  const billableSqm = Math.max(SHOP_STICKER_MIN_BILLABLE_SQM, Math.round(steppedArea * 100) / 100);

  return {
    areaSqm,
    billableSqm,
    heightCm,
    material,
    pricePerSqmCents,
    totalCents: Math.round(pricePerSqmCents * billableSqm),
    widthCm
  };
}

export function buildShopStickerSummaryLines(quote: ShopStickerQuote) {
  return [
    `Materiale: ${getShopStickerMaterialLabel(quote.material)}`,
    `Misure: ${formatShopStickerMetric(quote.widthCm)}x${formatShopStickerMetric(quote.heightCm)} cm`,
    `Area: ${formatShopStickerMetric(quote.areaSqm)} mq`,
    `Area conteggiata: ${formatShopStickerMetric(quote.billableSqm)} mq`
  ];
}
