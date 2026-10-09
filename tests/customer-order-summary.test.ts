import { describe, expect, it } from "vitest";
import { buildCustomerOrderSummary, getCustomerOrderPaymentState } from "../lib/customer-order-summary";

const base = { isQuote: false, createdAt: "2026-10-01T10:00:00Z", totalCents: 10000, depositCents: 0,
  paidCents: 0, balanceDueCents: 10000, paymentStatus: "NON_PAGATO" as const, invoiceStatus: "NON_RICHIESTO" as const };

describe("customer order print summary", () => {
  it("includes all orders chronologically, excludes quotes and preserves the original collection", () => {
    const records = [{ ...base, title: "Recente" }, { ...base, title: "Vecchio", createdAt: "2026-06-22T10:00:00Z" }, { ...base, title: "Preventivo", isQuote: true }];
    const summary = buildCustomerOrderSummary(records);
    expect(summary.orders.map((order) => order.title)).toEqual(["Vecchio", "Recente"]);
    expect(records[0].title).toBe("Recente");
    expect(summary.totalCents).toBe(20000);
  });
  it("matches Roberto Felici's complete order totals", () => {
    const amounts = [3800, 7200, 5250, 27000, 500, 10775, 10000, 8090, 2720, 1575];
    const settled = new Set([0, 5, 6, 8]);
    const records = amounts.map((totalCents, index) => ({ ...base, totalCents, paidCents: settled.has(index) ? totalCents : 0,
      balanceDueCents: settled.has(index) ? 0 : totalCents, paymentStatus: settled.has(index) ? "PAGATO" as const : "NON_PAGATO" as const }));
    expect(buildCustomerOrderSummary(records)).toMatchObject({ totalCents: 76910, paidCents: 27295, balanceDueCents: 49615, paidCount: 4, openCount: 6 });
  });
  it("distinguishes advances and partially paid orders from unpaid orders", () => {
    expect(getCustomerOrderPaymentState(base).label).toBe("Non pagato");
    expect(getCustomerOrderPaymentState({ ...base, paidCents: 3000, depositCents: 3000, balanceDueCents: 7000, paymentStatus: "ACCONTO" }).label).toBe("Acconto");
    expect(getCustomerOrderPaymentState({ ...base, paidCents: 7000, depositCents: 3000, balanceDueCents: 3000, paymentStatus: "PARZIALE" }).label).toBe("Parziale");
  });
  it("does not mark unpriced orders or zero totals as paid", () => {
    expect(getCustomerOrderPaymentState({ ...base, totalCents: 0, balanceDueCents: 0, invoiceStatus: "DA_FATTURARE" }).key).toBe("pending");
    expect(getCustomerOrderPaymentState({ ...base, totalCents: 0, balanceDueCents: 0 }).key).toBe("zero");
    expect(getCustomerOrderPaymentState({ ...base, paymentStatus: "PAGATO" }).key).toBe("unpaid");
  });
  it("returns an empty, zero-valued summary for customers with only quotes", () => {
    expect(buildCustomerOrderSummary([{ ...base, isQuote: true }])).toMatchObject({ orders: [], totalCents: 0, paidCents: 0, balanceDueCents: 0, paidCount: 0, openCount: 0 });
  });
});
