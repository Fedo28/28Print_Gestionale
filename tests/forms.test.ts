import { describe, expect, it } from "vitest";
import { parseInvoiceRequestStatus, parseInvoiceStatus } from "../lib/forms";

describe("invoice status parsing", () => {
  it("requires an explicit invoice status selection", () => {
    expect(() => parseInvoiceStatus(null)).toThrow("Stato fatturazione non valido.");
  });

  it("accepts only request yes/no values for new orders", () => {
    expect(parseInvoiceRequestStatus("DA_FATTURARE")).toBe("DA_FATTURARE");
    expect(parseInvoiceRequestStatus("NON_RICHIESTO")).toBe("NON_RICHIESTO");
    expect(() => parseInvoiceRequestStatus("FATTURATO")).toThrow(
      "Per i nuovi ordini scegli solo se la fattura e richiesta oppure no."
    );
  });
});
