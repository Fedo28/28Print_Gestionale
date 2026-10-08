export type ShopBannerMaterial = "pvc" | "mesh";

export type ShopBannerSelectionInput = {
  heightM?: number | string | null;
  material?: string | null;
  priceProfile?: string | null;
  quantity?: number | string | null;
  reinforced?: boolean | string | null;
  widthM?: number | string | null;
};

export type ShopBannerPriceProfile = "custom" | "standard-3x1";

export type ShopBannerQuote = {
  areaSqm: number;
  baseCents: number;
  eyeletCents: number;
  eyeletCount: number;
  heightM: number;
  material: ShopBannerMaterial;
  perimeterM: number;
  priceProfile: ShopBannerPriceProfile;
  quantity: number;
  reinforced: boolean;
  reinforcementCents: number;
  totalCents: number;
  unitTotalCents: number;
  widthM: number;
};

export const SHOP_BANNER_MAX_HEIGHT_M = 1.5;
export const SHOP_BANNER_EYELET_SPACING_M = 0.5;
export const SHOP_BANNER_STANDARD_3X1_PRICE_CENTS = 6000;

const SHOP_BANNER_MIN_SIZE_M = 0.1;
const SHOP_BANNER_PVC_PRICE_PER_SQM_CENTS = 2800;
const SHOP_BANNER_MESH_PRICE_PER_SQM_CENTS = 4000;
const SHOP_BANNER_EYELET_PRICE_CENTS = 150;
const SHOP_BANNER_REINFORCEMENT_PRICE_PER_METER_CENTS = 150;

function parsePositiveMetric(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value || "").replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.round(parsed * 100) / 100;
}

function parsePositiveInteger(value: unknown, fallback = 1) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value || "").replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.max(1, Math.round(parsed));
}

function parseBoolean(value: unknown, fallback = true) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "si", "sì", "yes"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no"].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

export function normalizeShopBannerMaterial(value: unknown): ShopBannerMaterial {
  return String(value || "").trim().toLowerCase() === "mesh" ? "mesh" : "pvc";
}

export function normalizeShopBannerPriceProfile(value: unknown): ShopBannerPriceProfile {
  return String(value || "").trim().toLowerCase() === "standard-3x1" ? "standard-3x1" : "custom";
}

export function formatShopBannerMetric(value: number) {
  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1
  }).format(value);
}

export function getShopBannerMaterialLabel(material: ShopBannerMaterial) {
  return material === "mesh" ? "Mesh" : "PVC";
}

export function normalizeShopBannerSelection(value: unknown): ShopBannerSelectionInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  return {
    heightM: record.heightM as ShopBannerSelectionInput["heightM"],
    material: typeof record.material === "string" ? record.material : null,
    priceProfile: typeof record.priceProfile === "string" ? record.priceProfile : null,
    quantity: record.quantity as ShopBannerSelectionInput["quantity"],
    reinforced: record.reinforced as ShopBannerSelectionInput["reinforced"],
    widthM: record.widthM as ShopBannerSelectionInput["widthM"]
  };
}

export function computeShopBannerQuote(input: ShopBannerSelectionInput): ShopBannerQuote {
  const priceProfile = normalizeShopBannerPriceProfile(input.priceProfile);
  const isStandard3x1 = priceProfile === "standard-3x1";
  const material = isStandard3x1 ? "pvc" : normalizeShopBannerMaterial(input.material);
  const widthM = isStandard3x1 ? 3 : Math.max(SHOP_BANNER_MIN_SIZE_M, parsePositiveMetric(input.widthM, 1));
  const heightM = isStandard3x1
    ? 1
    : Math.min(
        SHOP_BANNER_MAX_HEIGHT_M,
        Math.max(SHOP_BANNER_MIN_SIZE_M, parsePositiveMetric(input.heightM, 1))
      );
  const quantity = parsePositiveInteger(input.quantity, 1);
  const reinforced = isStandard3x1 ? true : parseBoolean(input.reinforced, true);
  const pricePerSqmCents =
    material === "mesh" ? SHOP_BANNER_MESH_PRICE_PER_SQM_CENTS : SHOP_BANNER_PVC_PRICE_PER_SQM_CENTS;
  const areaSqm = Math.round(widthM * heightM * 100) / 100;
  const perimeterM = Math.round((widthM + heightM) * 2 * 100) / 100;
  const eyeletCount = Math.max(4, Math.ceil(perimeterM / SHOP_BANNER_EYELET_SPACING_M));
  const baseCents = isStandard3x1 ? SHOP_BANNER_STANDARD_3X1_PRICE_CENTS : Math.round(areaSqm * pricePerSqmCents);
  const eyeletCents = isStandard3x1 ? 0 : eyeletCount * SHOP_BANNER_EYELET_PRICE_CENTS;
  const reinforcementCents = isStandard3x1
    ? 0
    : reinforced
      ? Math.round(perimeterM * SHOP_BANNER_REINFORCEMENT_PRICE_PER_METER_CENTS)
      : 0;
  const unitTotalCents = isStandard3x1 ? SHOP_BANNER_STANDARD_3X1_PRICE_CENTS : baseCents + eyeletCents + reinforcementCents;

  return {
    areaSqm,
    baseCents,
    eyeletCents,
    eyeletCount,
    heightM,
    material,
    perimeterM,
    priceProfile,
    quantity,
    reinforced,
    reinforcementCents,
    totalCents: unitTotalCents * quantity,
    unitTotalCents,
    widthM
  };
}

export function buildShopBannerSummaryLines(quote: ShopBannerQuote) {
  return [
    `Materiale: ${getShopBannerMaterialLabel(quote.material)}`,
    `Misure: ${formatShopBannerMetric(quote.widthM)}x${formatShopBannerMetric(quote.heightM)} m`,
    `Area: ${formatShopBannerMetric(quote.areaSqm)} mq`,
    `Occhielli: ${quote.eyeletCount}`,
    `Rinforzo: ${quote.reinforced ? "Si" : "No"}`
  ];
}
