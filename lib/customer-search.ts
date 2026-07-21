import { CustomerType } from "@prisma/client";
import {
  createSearchIndexValue,
  createSearchMatcher,
  getSearchFieldScore,
  matchesSearchIndexValue,
  normalizeCompactSearchText,
  normalizeSearchText,
  type SearchMatcher
} from "@/lib/search-text";

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

function getAllowedEditDistance(length: number) {
  if (length < 3) return 0;
  if (length <= 5) return 1;
  if (length <= 9) return 2;
  return 3;
}

function getDamerauLevenshteinDistance(left: string, right: string) {
  if (left === right) return 0;
  if (!left) return right.length;
  if (!right) return left.length;

  const previousPrevious = new Array(right.length + 1).fill(0);
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      let distance = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost
      );

      if (
        leftIndex > 1
        && rightIndex > 1
        && left[leftIndex - 1] === right[rightIndex - 2]
        && left[leftIndex - 2] === right[rightIndex - 1]
      ) {
        distance = Math.min(distance, previousPrevious[rightIndex - 2] + 1);
      }

      current[rightIndex] = distance;
    }

    for (let index = 0; index < previous.length; index += 1) {
      previousPrevious[index] = previous[index];
    }
    previous = current;
  }

  return previous[right.length];
}

function getFuzzyTokenPenalty(queryTerm: string, nameToken: string) {
  if (queryTerm === nameToken) return 0;
  if (nameToken.startsWith(queryTerm)) return 1;
  if (queryTerm.length >= 3 && queryTerm.startsWith(nameToken)) return 2;
  if (queryTerm.length >= 3 && nameToken.includes(queryTerm)) return 2;

  const allowedDistance = getAllowedEditDistance(queryTerm.length);
  if (!allowedDistance || Math.abs(queryTerm.length - nameToken.length) > allowedDistance) {
    return null;
  }

  const distance = getDamerauLevenshteinDistance(queryTerm, nameToken);
  return distance <= allowedDistance ? 3 + distance : null;
}

function getFuzzyCustomerNameScore(name: string, matcher: SearchMatcher) {
  const nameIndex = createSearchIndexValue(name);
  const nameTokens = nameIndex.tokens.map(normalizeCompactSearchText).filter(Boolean);
  const queryTerms = matcher.compactTerms.filter(Boolean);

  if (!nameTokens.length || !queryTerms.length) {
    return null;
  }

  let totalPenalty = 0;

  for (const queryTerm of queryTerms) {
    let bestPenalty = Number.MAX_SAFE_INTEGER;

    for (const nameToken of nameTokens) {
      const penalty = getFuzzyTokenPenalty(queryTerm, nameToken);
      if (penalty !== null) bestPenalty = Math.min(bestPenalty, penalty);
    }

    if (bestPenalty === Number.MAX_SAFE_INTEGER) {
      return null;
    }

    totalPenalty += bestPenalty;
  }

  const extraNameTokensPenalty = Math.min(Math.max(nameTokens.length - queryTerms.length, 0), 4);
  return 8 + totalPenalty + extraNameTokensPenalty;
}

export function getCustomerSearchScore(customer: SearchableCustomer, normalizedQuery: string) {
  const matcher = createSearchMatcher(normalizedQuery);
  const fuzzyNameScore = getFuzzyCustomerNameScore(customer.name, matcher);

  if (!matchesSearchIndexValue(buildCustomerSearchHaystack(customer), matcher) && fuzzyNameScore === null) {
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
    withWeight(getSearchFieldScore(customer.uniqueCode || "", matcher), 34),
    fuzzyNameScore ?? Number.MAX_SAFE_INTEGER
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
