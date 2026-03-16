import { describe, expect, it } from "vitest";
import {
  assertPhaseTransition,
  buildOrderCode,
  computeBalanceDue,
  computePaymentStatus,
  normalizeOrderTitle,
  normalizeForUniqueness
} from "../lib/orders";

describe("order domain", () => {
  it("builds order code with date and normalized title", () => {
    const code = buildOrderCode(new Date("2026-03-14T10:00:00.000Z"), "  Biglietti   visita Rossi ");
    expect(code).toBe("2026-03-14_Biglietti visita Rossi");
  });

  it("normalizes title for uniqueness", () => {
    expect(normalizeOrderTitle("  Adesivi   vetrina  ")).toBe("Adesivi vetrina");
    expect(normalizeForUniqueness("  Adesivi   vetrina  ")).toBe("adesivi vetrina");
  });

  it("computes remaining balance", () => {
    expect(computeBalanceDue(5000, 2000)).toBe(3000);
    expect(computeBalanceDue(5000, 6000)).toBe(0);
  });

  it("distinguishes acconto and partial payments", () => {
    expect(computePaymentStatus(5000, 0, 0)).toBe("NON_PAGATO");
    expect(computePaymentStatus(5000, 2000, 1)).toBe("ACCONTO");
    expect(computePaymentStatus(5000, 3500, 2)).toBe("PARZIALE");
    expect(computePaymentStatus(5000, 5000, 2)).toBe("PAGATO");
  });

  it("blocks direct jumps across phases", () => {
    expect(() => assertPhaseTransition("ACCETTATO", "IN_LAVORAZIONE", 0)).toThrow(/una fase alla volta/i);
  });

  it("blocks delivery with open balance without note", () => {
    expect(() => assertPhaseTransition("SVILUPPO_COMPLETATO", "CONSEGNATO", 1200)).toThrow(/nota di override/i);
  });

  it("allows delivery with override note", () => {
    expect(() => assertPhaseTransition("SVILUPPO_COMPLETATO", "CONSEGNATO", 1200, "Cliente paga domani")).not.toThrow();
  });
});
