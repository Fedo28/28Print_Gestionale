import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteCustomerAction, updateCustomerAction } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { StatusPills } from "@/components/status-pills";
import { requireAuth } from "@/lib/auth";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { getCustomerById } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  await requireAuth();
  const customer = await getCustomerById(params.id);

  if (!customer) {
    notFound();
  }

  return (
    <div className="stack">
      <PageHeader
        title={customer.name}
        description="Scheda cliente con contatti, dati fiscali e storico ordini."
      />

      <div className="grid grid-2">
        <section className="card card-pad">
          <h3>Aggiorna cliente</h3>
          <form action={updateCustomerAction} className="form-grid">
            <input name="id" type="hidden" value={customer.id} />
            <div className="field wide">
              <label htmlFor="name">Nome / Ragione sociale</label>
              <input defaultValue={customer.name} id="name" name="name" required />
            </div>
            <div className="field">
              <label htmlFor="phone">Telefono</label>
              <input defaultValue={customer.phone} id="phone" name="phone" required />
            </div>
            <div className="field">
              <label htmlFor="whatsapp">WhatsApp</label>
              <input defaultValue={customer.whatsapp || ""} id="whatsapp" name="whatsapp" />
            </div>
            <div className="field wide">
              <label htmlFor="email">Email</label>
              <input defaultValue={customer.email || ""} id="email" name="email" type="email" />
            </div>
            <div className="field">
              <label htmlFor="taxCode">Codice fiscale</label>
              <input defaultValue={customer.taxCode || ""} id="taxCode" name="taxCode" />
            </div>
            <div className="field">
              <label htmlFor="vatNumber">P. IVA</label>
              <input defaultValue={customer.vatNumber || ""} id="vatNumber" name="vatNumber" />
            </div>
            <div className="field full">
              <label htmlFor="notes">Note</label>
              <textarea defaultValue={customer.notes || ""} id="notes" name="notes" />
            </div>
            <div className="button-row">
              <button className="primary" type="submit">
                Salva modifiche
              </button>
            </div>
          </form>
        </section>

        <section className="card card-pad">
          <div className="stack">
            <div>
              <h3>Eliminazione cliente</h3>
              <p className="card-muted">Consentita solo se non esistono ordini collegati.</p>
            </div>
            <form action={deleteCustomerAction}>
              <input name="id" type="hidden" value={customer.id} />
              <button className="secondary" disabled={customer.orders.length > 0} type="submit">
                Elimina cliente
              </button>
            </form>
            {customer.orders.length > 0 ? (
              <p className="hint">Eliminazione bloccata: il cliente ha ordini collegati.</p>
            ) : null}
          </div>
        </section>
      </div>

      <section className="card card-pad">
        <div className="list-header">
          <div>
            <h3>Storico ordini</h3>
            <p className="card-muted">{customer.orders.length} ordini collegati.</p>
          </div>
        </div>
        <div className="mini-list">
          {customer.orders.length === 0 ? (
            <div className="empty">Nessun ordine collegato.</div>
          ) : (
            customer.orders.map((order) => (
              <article className="mini-item" key={order.id}>
                <div className="list-header">
                  <Link href={`/orders/${order.id}`} prefetch={false}>
                    <strong>{order.orderCode}</strong>
                  </Link>
                  <span>{formatCurrency(order.totalCents)}</span>
                </div>
                <div className="subtle">
                  {order.title}
                  {order.isQuote ? " • Preventivo" : ""}
                </div>
                <div className="subtle">{formatDateTime(order.deliveryAt)}</div>
                <StatusPills
                  isQuote={order.isQuote}
                  phase={order.mainPhase}
                  status={order.operationalStatus}
                  payment={order.paymentStatus}
                />
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
