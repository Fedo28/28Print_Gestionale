import type { PaymentStatus } from "@prisma/client";

export function getOrderPrintPayments(order: {
  totalCents: number;
  depositCents: number;
  paidCents: number;
  balanceDueCents: number;
  paymentStatus: PaymentStatus;
}) {
  const isPaid = order.totalCents > 0 && order.paymentStatus === "PAGATO" &&
    order.balanceDueCents === 0 && order.paidCents >= order.totalCents;
  // A single payment covering the whole price is a settlement, not an advance.
  const depositCents = order.depositCents > 0 && order.depositCents < order.totalCents &&
    order.depositCents <= order.paidCents ? order.depositCents : 0;
  return {
    isPaid,
    depositCents,
    additionalPaymentsCents: depositCents > 0 && !isPaid ? Math.max(0, order.paidCents - depositCents) : 0,
    balanceDueCents: order.paidCents > 0 && !isPaid ? Math.max(0, order.balanceDueCents) : 0
  };
}
