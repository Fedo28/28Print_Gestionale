const PDF_PAGE_COUNT_FALLBACK = 1;
const MAX_PDF_PAGE_COUNT = 10_000;

function clampPdfPageCount(value: number) {
  if (!Number.isFinite(value)) {
    return PDF_PAGE_COUNT_FALLBACK;
  }

  return Math.max(PDF_PAGE_COUNT_FALLBACK, Math.min(MAX_PDF_PAGE_COUNT, Math.round(value)));
}

function extractPagesTreeCounts(source: string) {
  const matches = source.matchAll(/\/Type\s*\/Pages\b[\s\S]{0,240}?\/Count\s+(\d+)/g);
  const counts: number[] = [];

  for (const match of matches) {
    const value = Number(match[1] || 0);
    if (Number.isFinite(value) && value > 0) {
      counts.push(value);
    }
  }

  return counts;
}

export function estimatePdfPageCount(input: ArrayBuffer | Uint8Array) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (!bytes.length) {
    return PDF_PAGE_COUNT_FALLBACK;
  }

  const source = new TextDecoder("iso-8859-1").decode(bytes);
  const pagesTreeCounts = extractPagesTreeCounts(source);

  if (pagesTreeCounts.length) {
    return clampPdfPageCount(Math.max(...pagesTreeCounts));
  }

  const directPageMatches = source.match(/\/Type\s*\/Page\b/g);
  if (directPageMatches?.length) {
    return clampPdfPageCount(directPageMatches.length);
  }

  return PDF_PAGE_COUNT_FALLBACK;
}
