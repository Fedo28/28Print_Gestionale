import type { InvoiceStatus, PaymentStatus } from "@prisma/client";
import { formatCurrency } from "@/lib/format";

export type OrderFinanceDisplayInput = {
  totalCents: number;
  balanceDueCents: number;
  paymentStatus: PaymentStatus;
  invoiceStatus: InvoiceStatus;
};

export type OrderBalanceDisplay = {
  state: "pricing-pending" | "due" | "settled";
  primaryLabel: string;
  secondaryLabel: string;
};

export function isOrderPricingPending(order: OrderFinanceDisplayInput) {
  return (
    order.totalCents === 0 &&
    order.balanceDueCents === 0 &&
    order.paymentStatus === "NON_PAGATO" &&
    order.invoiceStatus === "DA_FATTURARE"
  );
}

export function getOrderBalanceDisplay(order: OrderFinanceDisplayInput): OrderBalanceDisplay {
  if (isOrderPricingPending(order)) {
    return {
      state: "pricing-pending",
      primaryLabel: "Da preventivare",
      secondaryLabel: "Prezzo da definire"
    };
  }

  if (order.balanceDueCents > 0) {
    return {
      state: "due",
      primaryLabel: formatCurrency(order.balanceDueCents),
      secondaryLabel: "Da incassare"
    };
  }

  return {
    state: "settled",
    primaryLabel: "Pagato",
    secondaryLabel: "Saldo chiuso"
  };
}
