import type { InvoiceStatus, PaymentStatus } from "@prisma/client";
import { isOrderPricingPending } from "@/lib/order-finance";
import { getOrderPrintPayments } from "@/lib/order-print-payments";

type SummaryOrder = {
  isQuote: boolean; createdAt: Date | string; totalCents: number; paidCents: number;
  depositCents: number; balanceDueCents: number; paymentStatus: PaymentStatus; invoiceStatus: InvoiceStatus;
};

export function getCustomerOrderPaymentState(order: SummaryOrder) {
  if (isOrderPricingPending(order)) return { key: "pending", label: "Da preventivare" } as const;
  if (getOrderPrintPayments(order).isPaid) return { key: "paid", label: "Pagato" } as const;
  if (order.balanceDueCents > 0 && order.paidCents > 0) return {
    key: "partial", label: order.paymentStatus === "ACCONTO" ? "Acconto" : "Parziale"
  } as const;
  if (order.balanceDueCents > 0) return { key: "unpaid", label: "Non pagato" } as const;
  if (order.totalCents === 0) return { key: "zero", label: "Saldo zero" } as const;
  return { key: "check", label: "Da verificare" } as const;
}

export function buildCustomerOrderSummary<T extends SummaryOrder>(records: T[]) {
  const orders = records.filter((order) => !order.isQuote).sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  return {
    orders,
    totalCents: orders.reduce((sum, order) => sum + order.totalCents, 0),
    paidCents: orders.reduce((sum, order) => sum + order.paidCents, 0),
    balanceDueCents: orders.reduce((sum, order) => sum + order.balanceDueCents, 0),
    paidCount: orders.filter((order) => getCustomerOrderPaymentState(order).key === "paid").length,
    openCount: orders.filter((order) => order.balanceDueCents > 0).length,
    pendingCount: orders.filter(isOrderPricingPending).length
  };
}
