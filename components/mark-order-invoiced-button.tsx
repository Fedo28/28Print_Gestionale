"use client";

import type { InvoiceStatus } from "@prisma/client";
import { useFormStatus } from "react-dom";
import { markOrderInvoicedAction } from "@/app/actions";

function MarkOrderInvoicedSubmitButton({
  compact,
  invoiceStatus
}: {
  compact: boolean;
  invoiceStatus: InvoiceStatus;
}) {
  const { pending } = useFormStatus();
  const isDone = invoiceStatus === "FATTURATO";
  const title = isDone ? "Riporta l'ordine a da fatturare" : "Segna ordine come fatturato";

  return (
    <button
      aria-label={isDone ? "Riporta da fatturare" : "Segna fatturato"}
      className={`button ghost invoice-status-button${isDone ? " done" : ""}`}
      disabled={pending}
      title={title}
      type="submit"
    >
      <svg aria-hidden="true" className="glyph" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3v18" />
        <path d="M16.5 7.25c0-1.8-1.86-3.25-4.5-3.25S7.5 5.45 7.5 7.25s1.56 2.75 4.5 3.4 4.5 1.6 4.5 3.35S14.64 17.5 12 17.5s-4.5-1.45-4.5-3.25" />
      </svg>
      {!compact ? <span>{pending ? "Aggiorno..." : isDone ? "Riporta da fatturare" : "Segna fatturato"}</span> : null}
    </button>
  );
}

export function MarkOrderInvoicedButton({
  orderId,
  invoiceStatus,
  compact = false
}: {
  orderId: string;
  invoiceStatus: InvoiceStatus;
  compact?: boolean;
}) {
  return (
    <form action={markOrderInvoicedAction} className={`invoice-status-control${compact ? " compact" : ""}`}>
      <input name="orderId" type="hidden" value={orderId} />
      <input name="nextInvoiceStatus" type="hidden" value={invoiceStatus === "FATTURATO" ? "DA_FATTURARE" : "FATTURATO"} />
      <MarkOrderInvoicedSubmitButton compact={compact} invoiceStatus={invoiceStatus} />
    </form>
  );
}
