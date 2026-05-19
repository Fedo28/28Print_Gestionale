import { createSearchIndexValue, createSearchMatcher, getSearchFieldScore, matchesSearchIndexValue } from "@/lib/search-text";

export type SearchableOrder = {
  id: string;
  orderCode: string;
  title: string;
  customer: {
    name: string;
    phone?: string | null;
    whatsapp?: string | null;
    email?: string | null;
    pec?: string | null;
    taxCode?: string | null;
    vatNumber?: string | null;
    uniqueCode?: string | null;
  };
};

function withWeight(score: number | null, weight: number) {
  return score === null ? Number.MAX_SAFE_INTEGER : score + weight;
}

function buildOrderSearchHaystack(order: SearchableOrder) {
  return createSearchIndexValue(
    [
      order.orderCode,
      order.title,
      order.customer.name,
      order.customer.phone || "",
      order.customer.whatsapp || "",
      order.customer.email || "",
      order.customer.pec || "",
      order.customer.taxCode || "",
      order.customer.vatNumber || "",
      order.customer.uniqueCode || ""
    ].join(" ")
  );
}

export function getOrderSearchScore(order: SearchableOrder, query: string) {
  const matcher = createSearchMatcher(query);

  if (!matchesSearchIndexValue(buildOrderSearchHaystack(order), matcher)) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Math.min(
    withWeight(getSearchFieldScore(order.orderCode, matcher), 0),
    withWeight(getSearchFieldScore(order.title, matcher), 8),
    withWeight(getSearchFieldScore(order.customer.name, matcher), 16),
    withWeight(getSearchFieldScore(order.customer.phone || "", matcher), 28),
    withWeight(getSearchFieldScore(order.customer.whatsapp || "", matcher), 29),
    withWeight(getSearchFieldScore(order.customer.email || "", matcher), 36),
    withWeight(getSearchFieldScore(order.customer.pec || "", matcher), 37),
    withWeight(getSearchFieldScore(order.customer.taxCode || "", matcher), 42),
    withWeight(getSearchFieldScore(order.customer.vatNumber || "", matcher), 43),
    withWeight(getSearchFieldScore(order.customer.uniqueCode || "", matcher), 44)
  );
}

export function rankSearchableOrders<T extends SearchableOrder>(orders: T[], query: string) {
  const matcher = createSearchMatcher(query);

  if (!matcher.normalizedQuery) {
    return orders;
  }

  return orders
    .map((order) => ({
      order,
      score: getOrderSearchScore(order, matcher.normalizedQuery)
    }))
    .filter((entry) => entry.score !== Number.MAX_SAFE_INTEGER)
    .sort(
      (left, right) =>
        left.score - right.score ||
        left.order.orderCode.localeCompare(right.order.orderCode, "it") ||
        left.order.customer.name.localeCompare(right.order.customer.name, "it")
    )
    .map((entry) => entry.order);
}
