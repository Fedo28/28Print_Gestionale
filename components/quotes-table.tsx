import Link from "next/link";
import { Priority } from "@prisma/client";
import { confirmQuoteAction } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
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

function QuotePrimaryAction({ quoteId, schedulePending }: { quoteId: string; schedulePending: boolean }) {
  if (schedulePending) {
    return (
      <Link className="button ghost quote-primary-action" href={`/orders/${quoteId}?needsScheduling=1&edit=1#order-edit-panel`}>
        Definisci data
      </Link>
    );
  }

  return (
    <form action={confirmQuoteAction}>
      <input name="orderId" type="hidden" value={quoteId} />
      <ConfirmSubmitButton className="button primary quote-primary-action" confirmMessage="Confermare questo preventivo come ordine?">
        Conferma
      </ConfirmSubmitButton>
    </form>
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
    { field: "customer", label: "Cliente e preventivo" },
    { field: "delivery", label: "Consegna stimata" },
    { field: "amount", label: "Totale" }
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
          <th>Adesso</th>
        </tr>
      </thead>
      <tbody>
        {quotes.length === 0 ? (
          <tr>
              <td colSpan={4}>
              <div className="empty">Nessun preventivo trovato.</div>
            </td>
          </tr>
        ) : (
          quotes.map((quote) => {
            const priorityToneClass = getPriorityToneClass(quote.priority);
            const displayLabel = getDisplayOrderLabel(quote.orderCode, quote.title);
            return (
            <tr className={`quote-row ${priorityToneClass}`} key={quote.id}>
              <td data-label="Cliente e preventivo">
                <Link className="quote-customer-link" href={`/orders/${quote.id}`}>
                  <strong>{quote.customer.name}</strong>
                  <span>{displayLabel}</span>
                  {quote.customer.phone ? <small>{quote.customer.phone}</small> : null}
                </Link>
              </td>
              <td className={`quotes-table-delivery-cell ${priorityToneClass}`} data-label="Consegna stimata">
                <div className={`order-deadline-chip ${priorityToneClass}${quote.schedulePending ? " delivered" : ""}`}>
                  <strong>{quote.schedulePending ? "Da definire" : formatDateTime(quote.deliveryAt)}</strong>
                  <span>{quote.schedulePending ? "Pianificazione" : priorityLabels[quote.priority]}</span>
                </div>
              </td>
              <td data-label="Totale">
                <div className="strong">{formatCurrency(quote.totalCents)}</div>
                <div className="subtle">Preventivo</div>
              </td>
              <td className="quotes-table-actions-cell" data-label="Adesso">
                <QuotePrimaryAction quoteId={quote.id} schedulePending={quote.schedulePending} />
              </td>
            </tr>
          )})
        )}
      </tbody>
    </table>
  );
}
