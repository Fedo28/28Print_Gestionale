import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { PrintOrderActions } from "@/components/print-order-actions";
import { StatusPills } from "@/components/status-pills";
import { requireAuth } from "@/lib/auth";
import { invoiceStatusLabels, priorityLabels } from "@/lib/constants";
import { formatCurrency, formatDateTime, formatQuantity } from "@/lib/format";
import { getOrderById } from "@/lib/orders";

function buildItemSpecs(item: {
  format?: string | null;
  material?: string | null;
  finishing?: string | null;
  notes?: string | null;
}) {
  return [
    item.format?.trim() ? `Formato: ${item.format.trim()}` : null,
    item.material?.trim() ? `Materiale: ${item.material.trim()}` : null,
    item.finishing?.trim() ? `Finitura: ${item.finishing.trim()}` : null,
    item.notes?.trim() ? `Note riga: ${item.notes.trim()}` : null
  ].filter((value): value is string => Boolean(value));
}

export default async function OrderPrintPage({ params }: { params: { id: string } }) {
  await requireAuth();
  const order = await getOrderById(params.id);

  if (!order) {
    notFound();
  }

  const activePayments = order.payments.filter((payment) => payment.status === "ATTIVO");

  return (
    <div className="stack print-order-page-shell">
      <PageHeader
        title={`Stampa ${order.orderCode}`}
        description="Anteprima impaginata per foglio A4 dell'ordine."
        action={<PrintOrderActions backHref={`/orders/${order.id}`} />}
      />

      <article className="print-sheet">
        <header className="print-sheet-header">
          <div className="print-sheet-brand">
            <span className="compact-kicker">28 Print</span>
            <h1>{order.orderCode}</h1>
            <p>{order.title}</p>
          </div>
          <div className="print-sheet-summary">
            <div>
              <span>Creato</span>
              <strong>{formatDateTime(order.createdAt)}</strong>
            </div>
            <div>
              <span>Consegna</span>
              <strong>{formatDateTime(order.deliveryAt)}</strong>
            </div>
            <div>
              <span>Tipo</span>
              <strong>{order.isQuote ? "Preventivo" : "Ordine"}</strong>
            </div>
          </div>
        </header>

        <section className="print-sheet-top-grid">
          <section className="print-sheet-card">
            <span className="print-sheet-label">Cliente</span>
            <strong>{order.customer.name}</strong>
            <span>{order.customer.phone?.trim() || order.customer.whatsapp?.trim() || "Telefono non inserito"}</span>
            {order.customer.email?.trim() ? <span>{order.customer.email.trim()}</span> : null}
          </section>

          <section className="print-sheet-card">
            <span className="print-sheet-label">Riepilogo stato</span>
            <div className="print-sheet-pills">
              <StatusPills
                linked={false}
                isQuote={order.isQuote}
                payment={order.paymentStatus}
                phase={order.mainPhase}
                status={order.operationalStatus}
              />
            </div>
            <span>{priorityLabels[order.priority]}</span>
            <span>{invoiceStatusLabels[order.invoiceStatus]}</span>
          </section>
        </section>

        <section className="print-sheet-card print-sheet-lines-card">
          <div className="print-sheet-section-head">
            <h2>Righe ordine</h2>
            <span>{`${order.items.length} lavorazioni`}</span>
          </div>
          <table className="print-sheet-table">
            <thead>
              <tr>
                <th>Descrizione</th>
                <th>Qta</th>
                <th>Prezzo</th>
                <th>Totale</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => {
                const specs = buildItemSpecs(item);

                return (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.label}</strong>
                      {specs.length > 0 ? (
                        <div className="print-sheet-item-specs">
                          {specs.map((spec) => (
                            <span key={spec}>{spec}</span>
                          ))}
                        </div>
                      ) : null}
                    </td>
                    <td>{formatQuantity(item.quantity)}</td>
                    <td>{formatCurrency(item.unitPriceCents)}</td>
                    <td>{formatCurrency(item.lineTotalCents)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="print-sheet-bottom-grid">
          <section className="print-sheet-card">
            <div className="print-sheet-section-head">
              <h2>Note ordine</h2>
            </div>
            <p className="print-sheet-note">{order.notes?.trim() || "Nessuna nota interna."}</p>
          </section>

          <section className="print-sheet-card print-sheet-totals-card">
            <div className="print-sheet-totals">
              <div>
                <span>Totale</span>
                <strong>{formatCurrency(order.totalCents)}</strong>
              </div>
              <div>
                <span>Acconto</span>
                <strong>{formatCurrency(order.depositCents)}</strong>
              </div>
              <div>
                <span>Pagato</span>
                <strong>{formatCurrency(order.paidCents)}</strong>
              </div>
              <div>
                <span>Residuo</span>
                <strong>{formatCurrency(order.balanceDueCents)}</strong>
              </div>
            </div>
            <div className="print-sheet-payment-meta">
              <span>{activePayments.length === 0 ? "Nessun pagamento registrato" : `${activePayments.length} movimenti registrati`}</span>
              {order.appointmentAt ? <span>{`Appuntamento: ${formatDateTime(order.appointmentAt)}`}</span> : null}
            </div>
          </section>
        </section>
      </article>
    </div>
  );
}
