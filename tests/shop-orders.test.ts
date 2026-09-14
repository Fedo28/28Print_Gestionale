import { describe, expect, it } from "vitest";
import {
  buildShopOperationalOrderTitle,
  buildShopSalesOrderCode,
  describeShopSalesOrderFailure,
  normalizeShopSalesOrderBillingInput,
  validateShopSalesOrderBillingInput
} from "../lib/shop-orders";

describe("shop orders helpers", () => {
  it("builds readable shop sales order codes", () => {
    expect(buildShopSalesOrderCode(new Date("2026-08-27T10:00:00.000Z"), "A1B2C3")).toBe("SHOP-20260827-A1B2C3");
  });

  it("builds readable internal order titles for shop jobs", () => {
    expect(
      buildShopOperationalOrderTitle({
        orderCode: "SHOP-20260828-1F0FCC",
        primaryLabel: "Stampa documenti"
      })
    ).toBe("Shop online - Stampa documenti - SHOP-20260828-1F0FCC");
  });

  it("maps expected shop order failures to readable messages", () => {
    expect(describeShopSalesOrderFailure(new Error("Servizio shop non disponibile."))).toBe("Servizio shop non disponibile.");
  });

  it("normalizes billing details before saving them", () => {
    expect(
      normalizeShopSalesOrderBillingInput({
        kind: "BUSINESS",
        companyName: "  28 Print Srl  ",
        vatNumber: " it12345678901 ",
        pec: " INFO@28PRINT.IT ",
        postalCode: " 00100 ",
        province: " rm ",
        country: " "
      })
    ).toMatchObject({
      kind: "BUSINESS",
      companyName: "28 Print Srl",
      fullName: "28 Print Srl",
      vatNumber: "IT12345678901",
      pec: "info@28print.it",
      postalCode: "00100",
      province: "RM",
      country: "Italia"
    });
  });

  it("requires essential billing data when invoice is requested", () => {
    expect(
      validateShopSalesOrderBillingInput({
        kind: "PRIVATE",
        fullName: "Mario Rossi",
        city: "Roma"
      })
    ).toBe("Per richiedere la fattura completa: codice fiscale, indirizzo, CAP, provincia.");
  });
});
