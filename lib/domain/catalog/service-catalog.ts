import type { CatalogPriceMode } from "@/lib/pricing";
import { usesLineTotalQuantityTiers } from "@/lib/pricing";

export type ServiceCatalogPricingModeInput = {
  format?: string | null;
  serviceCatalogCode?: string | null;
  serviceCatalogName?: string | null;
  explicitMode?: CatalogPriceMode;
};

const LABEL_CALCULATOR_FORMAT_PREFIX = normalizeCatalogIdentifier("Calcolatore etichette");

function normalizeCatalogIdentifier(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeServiceCode(code: string, options?: { allowEmpty?: boolean }) {
  const normalized = code
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!normalized) {
    if (options?.allowEmpty) {
      return "";
    }

    throw new Error("Il codice servizio e obbligatorio.");
  }

  return normalized;
}

export function buildUniqueServiceCode(base: string, usedCodes: Set<string>) {
  let candidate = base || "SERVIZIO";
  let index = 2;

  while (usedCodes.has(candidate)) {
    candidate = `${base || "SERVIZIO"}_${index}`;
    index += 1;
  }

  usedCodes.add(candidate);
  return candidate;
}

export function normalizeShopServiceSlug(value: string, options?: { allowEmpty?: boolean }) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalized) {
    if (options?.allowEmpty) {
      return "";
    }

    throw new Error("Lo slug shop e obbligatorio.");
  }

  return normalized;
}

export function buildDefaultShopServiceSlug(input: { name: string; code?: string | null }) {
  const nameSlug = normalizeShopServiceSlug(input.name, { allowEmpty: true });
  if (nameSlug) {
    return nameSlug;
  }

  const codeSlug = normalizeShopServiceSlug(input.code || "", { allowEmpty: true });
  return codeSlug || "servizio-shop";
}

export function buildUniqueShopServiceSlug(base: string, usedSlugs: Set<string>) {
  const normalizedBase = normalizeShopServiceSlug(base || "servizio-shop", { allowEmpty: true }) || "servizio-shop";
  let candidate = normalizedBase;
  let index = 2;

  while (usedSlugs.has(candidate)) {
    candidate = `${normalizedBase}-${index}`;
    index += 1;
  }

  usedSlugs.add(candidate);
  return candidate;
}

export function isLabelCalculatorFormat(value: string | null | undefined) {
  return normalizeCatalogIdentifier(value).startsWith(LABEL_CALCULATOR_FORMAT_PREFIX);
}

export function usesLineTotalServiceCatalogPricing(options: ServiceCatalogPricingModeInput) {
  if (options.explicitMode === "LINE_TOTAL") {
    return true;
  }

  if (usesLineTotalQuantityTiers({ name: options.serviceCatalogName, code: options.serviceCatalogCode })) {
    return true;
  }

  return isLabelCalculatorFormat(options.format);
}

export function resolveServiceCatalogPriceMode(options: ServiceCatalogPricingModeInput): CatalogPriceMode {
  return usesLineTotalServiceCatalogPricing(options) ? "LINE_TOTAL" : "UNIT";
}
