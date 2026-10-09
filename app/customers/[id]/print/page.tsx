import Image from "next/image";
import { notFound } from "next/navigation";
import logoImage from "@/logo.png";
import { PrintOrderActions } from "@/components/print-order-actions";
import { requireAuth } from "@/lib/auth";
import { buildCustomerOrderSummary, getCustomerOrderPaymentState } from "@/lib/customer-order-summary";
import { formatCurrency, formatDate } from "@/lib/format";
import { getDisplayOrderLabel } from "@/lib/order-display";
import { getCustomerById } from "@/lib/orders";
import "./customer-orders-print.css";

export const dynamic = "force-dynamic";

export default async function CustomerOrdersPrintPage({ params }: { params: { id: string } }) {
  await requireAuth();
  const customer = await getCustomerById(params.id);
  if (!customer) notFound();
  const summary = buildCustomerOrderSummary(customer.orders);
  const printedAt = new Date();
  const firstOrder = summary.orders[0];
  const lastOrder = summary.orders[summary.orders.length - 1];

  return <div className="print-order-page-shell">
    <PrintOrderActions backHref={`/customers/${customer.id}#customer-orders-panel`} title="Riepilogo ordini cliente" subtitle={`${customer.name} · ${summary.orders.length} ordini`} />
    <article className="print-sheet customer-orders-print-sheet">
      <header className="customer-orders-print-brand"><Image src={logoImage} alt="28 Print" priority sizes="128px" /><div><strong>Riepilogo ordini</strong><span>Aggiornato al {formatDate(printedAt)}</span></div></header>
      <section className="customer-orders-print-customer"><span>Cliente</span><h1>{customer.name}</h1><p>{summary.orders.length} {summary.orders.length === 1 ? "ordine" : "ordini"} · {summary.paidCount} pagati · {summary.openCount} da saldare</p>
        {firstOrder && lastOrder ? <span>Ordini dal {formatDate(firstOrder.createdAt)} al {formatDate(lastOrder.createdAt)}</span> : null}</section>

      <section className="customer-orders-print-totals" aria-label="Totali del cliente">
        <div><span>Totale ordini</span><strong>{formatCurrency(summary.totalCents)}</strong></div>
        <div><span>Totale versato</span><strong>{formatCurrency(summary.paidCents)}</strong></div>
        <div className="customer-orders-print-due"><span>Da saldare</span><strong>{formatCurrency(summary.balanceDueCents)}</strong></div>
      </section>

      <table className="customer-orders-print-table" aria-label={`Tutti gli ordini di ${customer.name}`}>
        <colgroup><col className="customer-orders-col-date" /><col className="customer-orders-col-title" /><col className="customer-orders-col-money" /><col className="customer-orders-col-money" /><col className="customer-orders-col-money" /><col className="customer-orders-col-status" /></colgroup>
        <thead><tr><th>Data ordine</th><th>Ordine</th><th>Totale</th><th>Versato</th><th>Da saldare</th><th>Pagamento</th></tr></thead>
        <tbody>{summary.orders.length ? summary.orders.map((order) => {
          const payment = getCustomerOrderPaymentState(order);
          return <tr key={order.id}><td>{formatDate(order.createdAt)}</td><td>{order.title.trim() || getDisplayOrderLabel(order.orderCode, order.title)}</td>
            <td>{payment.key === "pending" ? "—" : formatCurrency(order.totalCents)}</td><td>{formatCurrency(order.paidCents)}</td>
            <td className={order.balanceDueCents > 0 ? "has-balance" : ""}>{payment.key === "pending" ? "—" : formatCurrency(order.balanceDueCents)}</td>
            <td><span className={`customer-orders-payment-label is-${payment.key}`}>{payment.label}</span></td></tr>;
        }) : <tr><td colSpan={6}>Nessun ordine registrato per questo cliente.</td></tr>}</tbody>
        <tfoot><tr><th colSpan={2}>Totali</th><td>{formatCurrency(summary.totalCents)}</td><td>{formatCurrency(summary.paidCents)}</td><td>{formatCurrency(summary.balanceDueCents)}</td><td /></tr></tfoot>
      </table>

      {summary.pendingCount ? <p className="customer-orders-print-pending">{summary.pendingCount} {summary.pendingCount === 1 ? "ordine ha" : "ordini hanno"} il prezzo ancora da definire e non {summary.pendingCount === 1 ? "concorre" : "concorrono"} al totale degli ordini.</p> : null}
      <footer className="customer-orders-print-footer"><strong>28 Print di Edoardo Polichetti</strong><span>Via Nomentana 114 · Mentana (RM) · P. IVA 15829801008</span><span>28print.it · info@28print.it · 06.86296919</span></footer>
    </article>
  </div>;
}
