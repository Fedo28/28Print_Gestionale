function normalizeLabelCalculatorValue(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export type ShopLabelMaterial = "polimerico" | "polimerico-laminato";

export type ShopLabelSelectionInput = {
  heightCm?: number | string | null;
  material?: string | null;
  pricePerSqmCents?: number | string | null;
  quantity?: number | string | null;
  widthCm?: number | string | null;
};

export type ShopLabelQuote = {
  billableSqm: number;
  calculationSqm: number;
  heightCm: number;
  labelAreaSqm: number;
  material: ShopLabelMaterial;
  minimumQuantity: number;
  pricePerSqmCents: number;
  quantity: number;
  setupCents: number;
  totalCents: number;
  widthCm: number;
};

export const SHOP_LABEL_MIN_BILLABLE_SQM = 1;
export const SHOP_LABEL_STEP_SQM = 0.5;
export const SHOP_LABEL_SETUP_CENTS = 2000;

const SHOP_LABEL_MIN_SIZE_CM = 1;

const LEGACY_LABEL_CALCULATOR_MATERIAL_NAMES = new Set([
  "etichette - polimerico laminato stampa e taglio",
  "etichette - polimerico stampa e taglio",
  "etichette - monomerico laminato stampa e taglio",
  "etichette - monomerico stampa e taglio"
]);

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

function normalizePriceCents(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value || "").replace(",", "."));
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function roundMetric(value: number, precision = 1000) {
  return Math.round(value * precision) / precision;
}

export function isLabelCalculatorMaterialService(service?: { name?: string | null; code?: string | null } | null) {
  if (!service) {
    return false;
  }

  const normalizedName = normalizeLabelCalculatorValue(service.name);
  const normalizedCode = normalizeLabelCalculatorValue(service.code);

  if (LEGACY_LABEL_CALCULATOR_MATERIAL_NAMES.has(normalizedName)) {
    return true;
  }

  const looksLikeEtichetteMaterial =
    normalizedName.startsWith("etichette") ||
    normalizedCode.startsWith("etichette") ||
    normalizedCode.startsWith("label");
  const mentionsStampaTaglio =
    normalizedName.includes("stampa e taglio") ||
    normalizedName.includes("stampa taglio") ||
    ((normalizedCode.includes("stampa") || normalizedCode.includes("print")) &&
      (normalizedCode.includes("taglio") || normalizedCode.includes("cut")));

  return looksLikeEtichetteMaterial && mentionsStampaTaglio;
}

export function normalizeShopLabelMaterial(value: unknown): ShopLabelMaterial {
  return String(value || "").trim().toLowerCase() === "polimerico-laminato"
    ? "polimerico-laminato"
    : "polimerico";
}

export function getShopLabelMaterialLabel(material: ShopLabelMaterial) {
  return material === "polimerico-laminato" ? "Polimerico laminato" : "Polimerico";
}

export function formatShopLabelMetric(value: number) {
  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1
  }).format(value);
}

function formatShopLabelPrice(cents: number) {
  return `${(cents / 100).toFixed(2).replace(".", ",")} EUR`;
}

export function normalizeShopLabelSelection(value: unknown): ShopLabelSelectionInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  return {
    heightCm: record.heightCm as ShopLabelSelectionInput["heightCm"],
    material: typeof record.material === "string" ? record.material : null,
    pricePerSqmCents: record.pricePerSqmCents as ShopLabelSelectionInput["pricePerSqmCents"],
    quantity: record.quantity as ShopLabelSelectionInput["quantity"],
    widthCm: record.widthCm as ShopLabelSelectionInput["widthCm"]
  };
}

export function computeShopLabelQuote(input: ShopLabelSelectionInput): ShopLabelQuote {
  const material = normalizeShopLabelMaterial(input.material);
  const widthCm = Math.max(SHOP_LABEL_MIN_SIZE_CM, parsePositiveMetric(input.widthCm, 5));
  const heightCm = Math.max(SHOP_LABEL_MIN_SIZE_CM, parsePositiveMetric(input.heightCm, 5));
  const unitCalculationSqm = ((widthCm + 1) / 100) * ((heightCm + 1) / 100);
  const minimumQuantity = Math.max(1, Math.ceil(SHOP_LABEL_MIN_BILLABLE_SQM / unitCalculationSqm));
  const quantity = Math.max(minimumQuantity, parsePositiveInteger(input.quantity, minimumQuantity));
  const pricePerSqmCents = normalizePriceCents(input.pricePerSqmCents);
  const labelAreaSqm = roundMetric((widthCm / 100) * (heightCm / 100) * quantity);
  const calculationSqm = roundMetric(unitCalculationSqm * quantity);
  const billableSqm =
    quantity <= minimumQuantity
      ? SHOP_LABEL_MIN_BILLABLE_SQM
      : Math.max(
          SHOP_LABEL_MIN_BILLABLE_SQM,
          Math.round(Math.ceil(calculationSqm / SHOP_LABEL_STEP_SQM) * SHOP_LABEL_STEP_SQM * 100) / 100
        );
  const materialCents = Math.round(pricePerSqmCents * billableSqm);

  return {
    billableSqm,
    calculationSqm,
    heightCm,
    labelAreaSqm,
    material,
    minimumQuantity,
    pricePerSqmCents,
    quantity,
    setupCents: SHOP_LABEL_SETUP_CENTS,
    totalCents: materialCents + SHOP_LABEL_SETUP_CENTS,
    widthCm
  };
}

export function buildShopLabelSummaryLines(quote: ShopLabelQuote) {
  return [
    `Materiale: ${getShopLabelMaterialLabel(quote.material)}`,
    `Formato etichetta: ${formatShopLabelMetric(quote.widthCm)}x${formatShopLabelMetric(quote.heightCm)} cm`,
    `Etichette: ${quote.quantity} pz`,
    `Area calcolo: ${formatShopLabelMetric(quote.calculationSqm)} mq`,
    `Area conteggiata: ${formatShopLabelMetric(quote.billableSqm)} mq`,
    `Impianto: ${formatShopLabelPrice(quote.setupCents)}`
  ];
}
