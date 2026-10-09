import { describe, expect, it } from "vitest";
import { getOrderPrintPayments } from "../lib/order-print-payments";

describe("order print payments", () => {
  const unpaid = { totalCents: 10000, depositCents: 0, paidCents: 0, balanceDueCents: 10000, paymentStatus: "NON_PAGATO" as const };
  it("does not add payment information to an unpaid order", () => {
    expect(getOrderPrintPayments(unpaid)).toEqual({ isPaid: false, depositCents: 0, additionalPaymentsCents: 0, balanceDueCents: 0 });
  });
  it("does not print an old advance when there is no longer a corresponding payment", () => {
    expect(getOrderPrintPayments({ ...unpaid, depositCents: 3000 }).depositCents).toBe(0);
  });
  it("prints an advance and the actual remaining balance", () => {
    expect(getOrderPrintPayments({ ...unpaid, depositCents: 3000, paidCents: 3000, balanceDueCents: 7000, paymentStatus: "ACCONTO" })).toEqual({ isPaid: false, depositCents: 3000, additionalPaymentsCents: 0, balanceDueCents: 7000 });
  });
  it("accounts for later installments without calling them the initial advance", () => {
    expect(getOrderPrintPayments({ ...unpaid, depositCents: 3000, paidCents: 7000, balanceDueCents: 3000, paymentStatus: "PARZIALE" })).toMatchObject({ depositCents: 3000, additionalPaymentsCents: 4000, balanceDueCents: 3000, isPaid: false });
  });
  it("keeps the advance visible alongside the stamp after settlement", () => {
    expect(getOrderPrintPayments({ ...unpaid, depositCents: 3000, paidCents: 10000, balanceDueCents: 0, paymentStatus: "PAGATO" })).toMatchObject({ depositCents: 3000, isPaid: true, balanceDueCents: 0 });
  });
  it("does not call a single full payment an advance", () => {
    expect(getOrderPrintPayments({ ...unpaid, depositCents: 10000, paidCents: 10000, balanceDueCents: 0, paymentStatus: "PAGATO" })).toMatchObject({ depositCents: 0, isPaid: true });
  });
  it("does not stamp unpriced or inconsistently marked orders as paid", () => {
    expect(getOrderPrintPayments({ ...unpaid, totalCents: 0, balanceDueCents: 0 }).isPaid).toBe(false);
    expect(getOrderPrintPayments({ ...unpaid, paymentStatus: "PAGATO" }).isPaid).toBe(false);
  });
});
