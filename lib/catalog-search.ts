import { createSearchIndexValue, createSearchMatcher, getSearchFieldScore, matchesSearchIndexValue, normalizeSearchText } from "@/lib/search-text";
import { formatServiceUnitPriceLabel, type ServiceUnitValue } from "@/lib/service-units";

export type SearchableCatalogService = {
  id: string;
  code?: string | null;
  name: string;
  description?: string | null;
  basePriceCents: number;
  unit: ServiceUnitValue;
  quantityTiers?: string | null;
  active?: boolean;
};

export function normalizeCatalogServiceSearchValue(value: string) {
  return normalizeSearchText(value);
}

function buildCatalogServiceHaystack(service: SearchableCatalogService) {
  return createSearchIndexValue(
    [
      service.code || "",
      service.name,
      service.description || "",
      formatServiceUnitPriceLabel(service.unit),
      service.unit,
      service.quantityTiers || "",
      service.active === false ? "disattivato" : "attivo"
    ].join(" ")
  );
}

function withWeight(score: number | null, weight: number) {
  return score === null ? Number.MAX_SAFE_INTEGER : score + weight;
}

export function getCatalogServiceSearchScore(service: SearchableCatalogService, query: string) {
  const matcher = createSearchMatcher(query);

  if (!matchesSearchIndexValue(buildCatalogServiceHaystack(service), matcher)) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Math.min(
    withWeight(getSearchFieldScore(service.code || "", matcher), 0),
    withWeight(getSearchFieldScore(service.name, matcher), 8),
    withWeight(getSearchFieldScore(service.description || "", matcher), 16),
    withWeight(getSearchFieldScore(formatServiceUnitPriceLabel(service.unit), matcher), 28),
    withWeight(getSearchFieldScore(service.unit, matcher), 32),
    withWeight(getSearchFieldScore(service.quantityTiers || "", matcher), 40),
    withWeight(getSearchFieldScore(service.active === false ? "disattivato" : "attivo", matcher), 44)
  );
}

export function rankCatalogServices<T extends SearchableCatalogService>(services: T[], query: string) {
  const normalizedQuery = normalizeCatalogServiceSearchValue(query);

  if (!normalizedQuery) {
    return services;
  }

  return services
    .map((service) => ({
      service,
      score: getCatalogServiceSearchScore(service, normalizedQuery)
    }))
    .filter((entry) => entry.score !== Number.MAX_SAFE_INTEGER)
    .sort(
      (left, right) =>
        left.score - right.score ||
        left.service.name.localeCompare(right.service.name, "it") ||
        (left.service.code || "").localeCompare(right.service.code || "", "it")
    )
    .map((entry) => entry.service);
}
