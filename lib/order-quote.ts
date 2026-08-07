import type { InvoiceStatus, MainPhase } from "@prisma/client";

type QuoteConversionInput = {
  isQuote: boolean;
  invoiceStatus: InvoiceStatus;
  mainPhase: MainPhase;
};

export function getOrderToQuoteDisabledReason(order: QuoteConversionInput) {
  if (order.isQuote) {
    return null;
  }

  if (order.mainPhase === "CONSEGNATO" && order.invoiceStatus === "FATTURATO") {
    return "Ordine consegnato e gia fatturato: non puo tornare preventivo.";
  }

  if (order.mainPhase === "CONSEGNATO") {
    return "Ordine consegnato: non puo tornare preventivo.";
  }

  if (order.invoiceStatus === "FATTURATO") {
    return "Ordine gia fatturato: non puo tornare preventivo.";
  }

  return null;
}

export function canConvertOrderToQuote(order: QuoteConversionInput) {
  return !order.isQuote && !getOrderToQuoteDisabledReason(order);
}
