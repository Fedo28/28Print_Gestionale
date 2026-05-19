import { CustomerType } from "@prisma/client";
import { createSearchIndexValue, createSearchMatcher, getSearchFieldScore, matchesSearchIndexValue, normalizeSearchText } from "@/lib/search-text";

export type SearchableCustomer = {
  id: string;
  name: string;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  pec?: string | null;
  taxCode?: string | null;
  vatNumber?: string | null;
  uniqueCode?: string | null;
  type: CustomerType;
};

export function normalizeCustomerSearchValue(value: string) {
  return normalizeSearchText(value);
}

function buildCustomerSearchHaystack(customer: SearchableCustomer) {
  return createSearchIndexValue(
    [
      customer.name,
      customer.phone || "",
      customer.whatsapp || "",
      customer.email || "",
      customer.pec || "",
      customer.taxCode || "",
      customer.vatNumber || "",
      customer.uniqueCode || ""
    ].join(" ")
  );
}

function withWeight(score: number | null, weight: number) {
  return score === null ? Number.MAX_SAFE_INTEGER : score + weight;
}

export function getCustomerSearchScore(customer: SearchableCustomer, normalizedQuery: string) {
  const matcher = createSearchMatcher(normalizedQuery);

  if (!matchesSearchIndexValue(buildCustomerSearchHaystack(customer), matcher)) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Math.min(
    withWeight(getSearchFieldScore(customer.name, matcher), 0),
    withWeight(getSearchFieldScore(customer.phone || "", matcher), 12),
    withWeight(getSearchFieldScore(customer.whatsapp || "", matcher), 13),
    withWeight(getSearchFieldScore(customer.email || "", matcher), 24),
    withWeight(getSearchFieldScore(customer.pec || "", matcher), 25),
    withWeight(getSearchFieldScore(customer.taxCode || "", matcher), 32),
    withWeight(getSearchFieldScore(customer.vatNumber || "", matcher), 33),
    withWeight(getSearchFieldScore(customer.uniqueCode || "", matcher), 34)
  );
}

export function rankCustomers<T extends SearchableCustomer>(customers: T[], query: string) {
  const normalizedQuery = normalizeCustomerSearchValue(query);

  if (!normalizedQuery) {
    return customers;
  }

  return customers
    .map((customer) => ({
      customer,
      score: getCustomerSearchScore(customer, normalizedQuery)
    }))
    .filter((entry) => entry.score !== Number.MAX_SAFE_INTEGER)
    .sort(
      (left, right) =>
        left.score - right.score ||
        left.customer.name.localeCompare(right.customer.name, "it") ||
        (left.customer.phone || "").localeCompare(right.customer.phone || "", "it")
    )
    .map((entry) => entry.customer);
}
