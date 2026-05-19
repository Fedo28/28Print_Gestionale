const DIACRITIC_REGEX = /[\u0300-\u036f]/g;
const SPACE_REGEX = /\s+/g;
const NON_SEARCH_CHAR_REGEX = /[^a-z0-9@+._-]+/g;
const NON_COMPACT_CHAR_REGEX = /[^a-z0-9]+/g;

export type SearchMatcher = {
  normalizedQuery: string;
  compactQuery: string;
  terms: string[];
  compactTerms: string[];
};

export type SearchIndexValue = {
  normalized: string;
  compact: string;
  tokens: string[];
};

export function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(DIACRITIC_REGEX, "")
    .toLowerCase()
    .replace(NON_SEARCH_CHAR_REGEX, " ")
    .replace(SPACE_REGEX, " ")
    .trim();
}

export function normalizeCompactSearchText(value: string) {
  return normalizeSearchText(value).replace(NON_COMPACT_CHAR_REGEX, "");
}

export function createSearchIndexValue(value: string): SearchIndexValue {
  const normalized = normalizeSearchText(value);

  return {
    normalized,
    compact: normalized.replace(NON_COMPACT_CHAR_REGEX, ""),
    tokens: normalized.split(/\s+/).filter(Boolean)
  };
}

export function createSearchMatcher(query: string): SearchMatcher {
  const normalizedQuery = normalizeSearchText(query);
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);

  return {
    normalizedQuery,
    compactQuery: normalizedQuery.replace(NON_COMPACT_CHAR_REGEX, ""),
    terms,
    compactTerms: terms.map((term) => term.replace(NON_COMPACT_CHAR_REGEX, ""))
  };
}

function isCompactSubsequence(needle: string, haystack: string) {
  if (!needle || needle.length > haystack.length) {
    return false;
  }

  let needleIndex = 0;

  for (const character of haystack) {
    if (character === needle[needleIndex]) {
      needleIndex += 1;

      if (needleIndex === needle.length) {
        return true;
      }
    }
  }

  return false;
}

export function matchesSearchIndexValue(indexValue: SearchIndexValue, matcher: SearchMatcher) {
  if (!matcher.normalizedQuery) {
    return false;
  }

  if (matcher.compactQuery && indexValue.compact.includes(matcher.compactQuery)) {
    return true;
  }

  return matcher.terms.every((term, index) => {
    const compactTerm = matcher.compactTerms[index] || "";

    return (
      indexValue.tokens.some((token) => token.startsWith(term)) ||
      indexValue.normalized.includes(term) ||
      (compactTerm.length >= 2 && indexValue.compact.includes(compactTerm))
    );
  });
}

export function getSearchFieldScore(value: string, matcher: SearchMatcher) {
  const indexValue = createSearchIndexValue(value);

  if (!indexValue.normalized || !matcher.normalizedQuery) {
    return null;
  }

  if (indexValue.normalized === matcher.normalizedQuery) {
    return 0;
  }

  if (matcher.compactQuery && indexValue.compact === matcher.compactQuery) {
    return 1;
  }

  if (indexValue.normalized.startsWith(matcher.normalizedQuery)) {
    return 2;
  }

  if (indexValue.tokens.some((token) => token.startsWith(matcher.normalizedQuery))) {
    return 3;
  }

  if (indexValue.normalized.includes(matcher.normalizedQuery)) {
    return 4;
  }

  if (matcher.compactQuery && indexValue.compact.includes(matcher.compactQuery)) {
    return 5;
  }

  if (
    matcher.terms.length > 1 &&
    matcher.terms.every((term, index) => {
      const compactTerm = matcher.compactTerms[index] || "";

      return (
        indexValue.tokens.some((token) => token.startsWith(term)) ||
        indexValue.normalized.includes(term) ||
        (compactTerm.length >= 2 && indexValue.compact.includes(compactTerm))
      );
    })
  ) {
    return 6;
  }

  if (matcher.compactQuery.length >= 3 && isCompactSubsequence(matcher.compactQuery, indexValue.compact)) {
    return 7;
  }

  return null;
}
