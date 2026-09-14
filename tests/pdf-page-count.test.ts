import { describe, expect, it } from "vitest";
import { estimatePdfPageCount } from "../lib/pdf-page-count";

describe("pdf page count", () => {
  it("prefers the pages tree count when available", () => {
    const source = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Count 12 /Kids [3 0 R 4 0 R] >>
endobj`;

    expect(estimatePdfPageCount(new TextEncoder().encode(source))).toBe(12);
  });

  it("falls back to direct page objects when count is missing", () => {
    const source = `%PDF-1.4
1 0 obj << /Type /Page /Parent 2 0 R >> endobj
2 0 obj << /Type /Page /Parent 2 0 R >> endobj
3 0 obj << /Type /Pages /Kids [1 0 R 2 0 R] >> endobj`;

    expect(estimatePdfPageCount(new TextEncoder().encode(source))).toBe(2);
  });

  it("returns 1 when no page markers are readable", () => {
    expect(estimatePdfPageCount(new TextEncoder().encode("%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj"))).toBe(1);
  });
});
