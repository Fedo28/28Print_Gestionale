import { describe, expect, it } from "vitest";
import { createSearchIndexValue, createSearchMatcher, getSearchFieldScore, matchesSearchIndexValue, normalizeSearchText } from "../lib/search-text";

describe("search text helpers", () => {
  it("normalizes accents, casing and punctuation", () => {
    expect(normalizeSearchText("  Àziènda-Rossi  ")).toBe("azienda-rossi");
  });

  it("matches compact queries against spaced values", () => {
    const matcher = createSearchMatcher("mariorossi");
    const indexValue = createSearchIndexValue("Mario Rossi");

    expect(matchesSearchIndexValue(indexValue, matcher)).toBe(true);
    expect(getSearchFieldScore("Mario Rossi", matcher)).not.toBeNull();
  });

  it("matches phone-like values even without separators", () => {
    const matcher = createSearchMatcher("393331111111");
    const indexValue = createSearchIndexValue("+39 333 1111111");

    expect(matchesSearchIndexValue(indexValue, matcher)).toBe(true);
  });
});
