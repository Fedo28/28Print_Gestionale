export type DiscountModeValue = "NONE" | "AMOUNT" | "PERCENT";

export const discountModeLabels: Record<DiscountModeValue, string> = {
  NONE: "Nessuno",
  AMOUNT: "Euro",
  PERCENT: "Percentuale"
};

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
