import Link from "next/link";
import { Priority } from "@prisma/client";
import { priorityLabels } from "@/lib/constants";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { getDisplayOrderLabel } from "@/lib/order-display";
import { getPriorityToneClass } from "@/lib/priorities";

type QuoteRow = {
  id: string;
  orderCode: string;
  title: string;
  deliveryAt: Date | string;
  schedulePending: boolean;
  priority: Priority;
  totalCents: number;
  balanceDueCents: number;
  customer: {
    name: string;
    phone?: string | null;
  };
};

export function QuotesTable({ quotes }: { quotes: QuoteRow[] }) {
  return (
    <table className="quotes-table">
      <thead>
        <tr>
          <th>Preventivo</th>
          <th>Cliente</th>
          <th>Consegna stimata</th>
          <th>Priorita</th>
          <th>Importi</th>
          <th>Azioni</th>
        </tr>
      </thead>
      <tbody>
        {quotes.length === 0 ? (
          <tr>
            <td colSpan={6}>
              <div className="empty">Nessun preventivo trovato.</div>
            </td>
          </tr>
        ) : (
          quotes.map((quote) => {
            const priorityToneClass = getPriorityToneClass(quote.priority);
            const displayLabel = getDisplayOrderLabel(quote.orderCode, quote.title);
            return (
            <tr className={`quote-row ${priorityToneClass}`} key={quote.id}>
              <td data-label="Preventivo">
                <div className="order-code">{displayLabel}</div>
                {quote.title && quote.title !== displayLabel ? <div className="subtle">{quote.title}</div> : null}
              </td>
              <td data-label="Cliente">
                <strong>{quote.customer.name}</strong>
                <div className="subtle">{quote.customer.phone || "Telefono non inserito"}</div>
              </td>
              <td className={`quotes-table-delivery-cell ${priorityToneClass}`} data-label="Consegna stimata">
                <div className={`order-deadline-chip ${priorityToneClass}${quote.schedulePending ? " delivered" : ""}`}>
                  <strong>{quote.schedulePending ? "Da definire" : formatDateTime(quote.deliveryAt)}</strong>
                  <span>{quote.schedulePending ? "Pianificazione" : "Stimata"}</span>
                </div>
              </td>
              <td data-label="Priorita">
                <span className={`order-priority-chip ${priorityToneClass}`}>{priorityLabels[quote.priority]}</span>
              </td>
              <td data-label="Importi">
                <div className="strong">{formatCurrency(quote.totalCents)}</div>
                <div className="subtle">Residuo {formatCurrency(quote.balanceDueCents)}</div>
              </td>
              <td className="quotes-table-actions-cell" data-label="Azioni">
                <Link className="button ghost" href={`/orders/${quote.id}`}>
                  Apri scheda
                </Link>
              </td>
            </tr>
          )})
        )}
      </tbody>
    </table>
  );
}
