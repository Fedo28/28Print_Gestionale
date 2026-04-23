function normalizeLabelCalculatorValue(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const LEGACY_LABEL_CALCULATOR_MATERIAL_NAMES = new Set([
  "etichette - polimerico laminato stampa e taglio",
  "etichette - polimerico stampa e taglio",
  "etichette - monomerico laminato stampa e taglio",
  "etichette - monomerico stampa e taglio"
]);

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
