export type DiscountModeValue = "NONE" | "AMOUNT" | "PERCENT";
export type CatalogPriceMode = "UNIT" | "LINE_TOTAL";

export type QuantityTier = {
  minQuantity: number;
  maxQuantity: number | null;
  unitPriceCents: number;
};

export const discountModeLabels: Record<DiscountModeValue, string> = {
  NONE: "Nessuno",
  AMOUNT: "Euro",
  PERCENT: "Percentuale"
};

const QUANTITY_PRECISION = 1000;

export function normalizeQuantityValue(value: number, fallback = 1) {
  const normalized = Number.isFinite(value) && value > 0 ? value : fallback;
  return Math.round(normalized * QUANTITY_PRECISION) / QUANTITY_PRECISION;
}

export function parseQuantityValue(value: string | number | null | undefined, fallback = 1) {
  if (typeof value === "number") {
    return normalizeQuantityValue(value, fallback);
  }

  const normalized = String(value ?? "").trim().replace(",", ".");
  if (!normalized) {
    return fallback;
  }

  const parsed = Number.parseFloat(normalized);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return normalizeQuantityValue(parsed, fallback);
}

export function clampDiscountValue(mode: DiscountModeValue, value: number) {
  const normalized = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;

  if (mode === "PERCENT") {
    return Math.min(normalized, 100);
  }

  return normalized;
}

export function computeDiscountedUnitPrice(basePriceCents: number, mode: DiscountModeValue, value: number) {
  const safeBase = Number.isFinite(basePriceCents) ? Math.max(0, Math.round(basePriceCents)) : 0;
  const safeValue = clampDiscountValue(mode, value);

  if (mode === "AMOUNT") {
    return Math.max(safeBase - safeValue, 0);
  }

  if (mode === "PERCENT") {
    return Math.max(Math.round(safeBase * (100 - safeValue) / 100), 0);
  }

  return safeBase;
}

export function computeLineBaseTotalCents(baseUnitPriceCents: number, quantity: number, priceMode: CatalogPriceMode = "UNIT") {
  const safeBase = Number.isFinite(baseUnitPriceCents) ? Math.max(0, Math.round(baseUnitPriceCents)) : 0;
  if (priceMode === "LINE_TOTAL") {
    return safeBase;
  }

  const safeQuantity = normalizeQuantityValue(quantity);
  return Math.max(0, Math.round(safeBase * safeQuantity));
}

export function computeDiscountedLineTotalCents(
  baseUnitPriceCents: number,
  quantity: number,
  mode: DiscountModeValue,
  value: number,
  priceMode: CatalogPriceMode = "UNIT"
) {
  const safeBaseLine = computeLineBaseTotalCents(baseUnitPriceCents, quantity, priceMode);
  const safeValue = clampDiscountValue(mode, value);

  if (mode === "AMOUNT") {
    return Math.max(safeBaseLine - safeValue, 0);
  }

  if (mode === "PERCENT") {
    return Math.max(Math.round(safeBaseLine * (100 - safeValue) / 100), 0);
  }

  return safeBaseLine;
}

export function computeExtraLineTotalCents(lineTotalCents: number, mode: DiscountModeValue, value: number) {
  const safeBase = Number.isFinite(lineTotalCents) ? Math.max(0, Math.round(lineTotalCents)) : 0;
  const safeValue = clampDiscountValue(mode, value);

  if (mode === "AMOUNT") {
    return safeBase + safeValue;
  }

  if (mode === "PERCENT") {
    return Math.max(Math.round(safeBase * (100 + safeValue) / 100), 0);
  }

  return safeBase;
}

export function computeLineTotalWithAdjustmentsCents(
  baseUnitPriceCents: number,
  quantity: number,
  discountMode: DiscountModeValue,
  discountValue: number,
  extraMode: DiscountModeValue,
  extraValue: number,
  priceMode: CatalogPriceMode = "UNIT"
) {
  const discounted = computeDiscountedLineTotalCents(baseUnitPriceCents, quantity, discountMode, discountValue, priceMode);
  return computeExtraLineTotalCents(discounted, extraMode, extraValue);
}

export function computeEffectiveUnitPriceCents(lineTotalCents: number, quantity: number) {
  const safeQuantity = normalizeQuantityValue(quantity);
  return safeQuantity > 0 ? Math.max(0, Math.round(lineTotalCents / safeQuantity)) : 0;
}

export function formatDiscountSummary(mode: DiscountModeValue, value: number) {
  const safeValue = clampDiscountValue(mode, value);

  if (mode === "AMOUNT") {
    return `Sconto ${new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(safeValue / 100)}`;
  }

  if (mode === "PERCENT") {
    return `Sconto ${safeValue}%`;
  }

  return "Nessuno sconto";
}

export function formatExtraSummary(mode: DiscountModeValue, value: number) {
  const safeValue = clampDiscountValue(mode, value);

  if (mode === "AMOUNT") {
    return `Extra ${new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(safeValue / 100)}`;
  }

  if (mode === "PERCENT") {
    return `Extra ${safeValue}%`;
  }

  return "Nessun extra";
}

function normalizePricingServiceIdentifier(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function usesLineTotalQuantityTiers(service?: { name?: string | null; code?: string | null } | null) {
  const normalizedName = normalizePricingServiceIdentifier(service?.name);
  const normalizedCode = normalizePricingServiceIdentifier(service?.code);

  return normalizedName.includes("biglietti da visita") || normalizedCode.includes("biglietti visita");
}

function parseTierPriceToCents(value: string) {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  if (!normalized) {
    throw new Error("Prezzo scaglione mancante.");
  }

  const parsed = Number.parseFloat(normalized);
  if (Number.isNaN(parsed)) {
    throw new Error("Prezzo scaglione non valido.");
  }

  return Math.max(0, Math.round(parsed * 100));
}

function formatTierPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function parseQuantityTiers(raw: string | null | undefined): QuantityTier[] {
  const value = String(raw || "").trim();
  if (!value) {
    return [];
  }

  const parts = value
    .split(/\r?\n|[|;]/)
    .map((part) => part.trim())
    .filter(Boolean);

  const tiers = parts.map((part) => {
    const match = part.match(/^(\d+)(?:\s*-\s*(\d+)|\s*(\+))?\s*[:=]\s*(.+)$/);
    if (!match) {
      throw new Error(`Formato scaglione non valido: "${part}". Usa ad esempio 1-9:0,50 | 10+:0,20`);
    }

    const minQuantity = Number.parseInt(match[1], 10);
    const explicitMax = match[2] ? Number.parseInt(match[2], 10) : null;
    const openEnded = Boolean(match[3]);
    const unitPriceCents = parseTierPriceToCents(match[4]);
    const maxQuantity = openEnded ? null : explicitMax ?? minQuantity;

    if (!Number.isFinite(minQuantity) || minQuantity < 1) {
      throw new Error(`Quantita minima non valida nello scaglione "${part}".`);
    }

    if (maxQuantity !== null && maxQuantity < minQuantity) {
      throw new Error(`Quantita massima non valida nello scaglione "${part}".`);
    }

    return {
      minQuantity,
      maxQuantity,
      unitPriceCents
    };
  });

  const sorted = [...tiers].sort((left, right) => left.minQuantity - right.minQuantity);
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];

    if (previous.maxQuantity === null || current.minQuantity <= previous.maxQuantity) {
      throw new Error("Gli scaglioni quantita si sovrappongono.");
    }
  }

  return sorted;
}

export function normalizeQuantityTiers(raw: string | null | undefined) {
  const tiers = parseQuantityTiers(raw);
  if (!tiers.length) {
    return undefined;
  }

  return tiers
    .map((tier) =>
      `${tier.minQuantity}${tier.maxQuantity === null ? "+" : tier.maxQuantity === tier.minQuantity ? "" : `-${tier.maxQuantity}`}:${formatTierPrice(tier.unitPriceCents)}`
    )
    .join(" | ");
}

export function getTieredUnitPrice(basePriceCents: number, quantity: number, quantityTiers: string | null | undefined) {
  const tiers = parseQuantityTiers(quantityTiers);
  if (!tiers.length) {
    return Math.max(0, Math.round(basePriceCents || 0));
  }

  const safeQuantity = normalizeQuantityValue(quantity);
  const matchedTier = tiers.find((tier) => safeQuantity >= tier.minQuantity && (tier.maxQuantity === null || safeQuantity <= tier.maxQuantity));

  return matchedTier ? matchedTier.unitPriceCents : Math.max(0, Math.round(basePriceCents || 0));
}
