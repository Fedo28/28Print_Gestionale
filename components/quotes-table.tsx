import Link from "next/link";
import { Priority } from "@prisma/client";
import { priorityLabels } from "@/lib/constants";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { getDisplayOrderLabel } from "@/lib/order-display";
import type { OrderSortDirection, OrderSortField } from "@/lib/order-filters";
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

function SortGlyph({ active, direction }: { active: boolean; direction: OrderSortDirection }) {
  return (
    <span className={`orders-table-sort-icon${active ? " active" : ""}`} aria-hidden="true">
      {active ? (direction === "asc" ? "↑" : "↓") : "↕"}
    </span>
  );
}

export function QuotesTable({
  quotes,
  sortField,
  sortDirection,
  buildSortHref
}: {
  quotes: QuoteRow[];
  sortField: OrderSortField;
  sortDirection: OrderSortDirection;
  buildSortHref: (field: OrderSortField) => string;
}) {
  const sortableHeaders: Array<{ field: OrderSortField; label: string }> = [
    { field: "customer", label: "Cliente" },
    { field: "order", label: "Preventivo" },
    { field: "delivery", label: "Consegna stimata" },
    { field: "priority", label: "Priorita" },
    { field: "amount", label: "Importi" }
  ];

  return (
    <table className="quotes-table">
      <thead>
        <tr>
          {sortableHeaders.map((header) => {
            const isActive = sortField === header.field;

            return (
              <th key={header.field}>
                <Link className={`orders-table-sort-link${isActive ? " active" : ""}`} href={buildSortHref(header.field)} prefetch={false}>
                  <span>{header.label}</span>
                  <SortGlyph active={isActive} direction={sortDirection} />
                </Link>
              </th>
            );
          })}
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
            const secondaryLabel = quote.title?.trim() && quote.title.trim() !== displayLabel ? quote.title.trim() : null;
            return (
            <tr className={`quote-row ${priorityToneClass}`} key={quote.id}>
              <td data-label="Cliente">
                <strong>{quote.customer.name}</strong>
                <div className="subtle">{quote.customer.phone || "Telefono non inserito"}</div>
              </td>
              <td data-label="Preventivo">
                <div className="order-code">{displayLabel}</div>
                {secondaryLabel ? <div className="subtle">{secondaryLabel}</div> : null}
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
