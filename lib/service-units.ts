export type ServiceUnitValue = "PZ" | "MQ" | "ML";

export const serviceUnitOptions: Array<{ value: ServiceUnitValue; label: string; priceLabel: string }> = [
  { value: "PZ", label: "pz", priceLabel: "a pz" },
  { value: "MQ", label: "mq", priceLabel: "al mq" },
  { value: "ML", label: "ml", priceLabel: "al ml" }
];

const serviceUnitLabelMap: Record<ServiceUnitValue, string> = Object.fromEntries(
  serviceUnitOptions.map((option) => [option.value, option.label])
) as Record<ServiceUnitValue, string>;

const serviceUnitPriceLabelMap: Record<ServiceUnitValue, string> = Object.fromEntries(
  serviceUnitOptions.map((option) => [option.value, option.priceLabel])
) as Record<ServiceUnitValue, string>;

function normalizeUnitText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchesMq(value: string) {
  return (
    /\bprezzo al mq\b/.test(value) ||
    /\bal mq\b/.test(value) ||
    /\bmq\b/.test(value) ||
    /\bm2\b/.test(value) ||
    /\bmetro quadro\b/.test(value) ||
    /\bmetri quadri\b/.test(value)
  );
}

function matchesMl(value: string) {
  return (
    /\bprezzo al ml\b/.test(value) ||
    /\bal ml\b/.test(value) ||
    /\bml\b/.test(value) ||
    /\bm l\b/.test(value) ||
    /\bmetro lineare\b/.test(value) ||
    /\bmetri lineari\b/.test(value)
  );
}

export function parseServiceUnit(value: unknown): ServiceUnitValue {
  const normalized = normalizeUnitText(value);

  if (!normalized) {
    return "PZ";
  }

  if (matchesMq(normalized)) {
    return "MQ";
  }

  if (matchesMl(normalized)) {
    return "ML";
  }

  if (["pz", "pezzo", "pezzi", "cad", "cadauno", "caduno", "unita", "unita di misura"].includes(normalized)) {
    return "PZ";
  }

  return "PZ";
}

export function inferServiceUnitFromCatalogText(...values: Array<string | null | undefined>): ServiceUnitValue {
  const haystacks = values.map(normalizeUnitText);

  for (const value of haystacks) {
    if (matchesMq(value)) {
      return "MQ";
    }

    if (matchesMl(value)) {
      return "ML";
    }
  }

  return "PZ";
}

export function formatServiceUnitShortLabel(unit: ServiceUnitValue | null | undefined) {
  return serviceUnitLabelMap[unit || "PZ"];
}

export function formatServiceUnitPriceLabel(unit: ServiceUnitValue | null | undefined) {
  return serviceUnitPriceLabelMap[unit || "PZ"];
}
