import Link from "next/link";
import { Priority } from "@prisma/client";
import { priorityLabels } from "@/lib/constants";
import { formatCurrency, formatDateTime } from "@/lib/format";

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
    <table>
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
          quotes.map((quote) => (
            <tr key={quote.id}>
              <td>
                <div className="order-code">{quote.orderCode}</div>
                <div className="subtle">{quote.title}</div>
              </td>
              <td>
                <strong>{quote.customer.name}</strong>
                <div className="subtle">{quote.customer.phone || "Telefono non inserito"}</div>
              </td>
              <td>{quote.schedulePending ? "Da definire" : formatDateTime(quote.deliveryAt)}</td>
              <td>{priorityLabels[quote.priority]}</td>
              <td>
                <div className="strong">{formatCurrency(quote.totalCents)}</div>
                <div className="subtle">Residuo {formatCurrency(quote.balanceDueCents)}</div>
              </td>
              <td>
                <Link className="button ghost" href={`/orders/${quote.id}`}>
                  Apri scheda
                </Link>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
