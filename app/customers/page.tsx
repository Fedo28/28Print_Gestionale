import Link from "next/link";
import { createCustomerAction } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { requireAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getCustomers } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  await requireAuth();
  const customers = await getCustomers();

  return (
    <div className="stack">
      <PageHeader
        title="Clienti"
        description="Anagrafica, contatti, dati fiscali e storico ordini per ogni cliente."
      />

      <div className="grid grid-2">
        <section className="card card-pad">
          <div className="list-header">
            <div>
              <h3>Nuovo cliente</h3>
              <p className="card-muted">Inserimento rapido dal banco.</p>
            </div>
          </div>
          <form action={createCustomerAction} className="form-grid">
            <div className="field wide">
              <label htmlFor="name">Nome / Ragione sociale</label>
              <input id="name" name="name" required />
            </div>
            <div className="field">
              <label htmlFor="phone">Telefono</label>
              <input id="phone" name="phone" required />
            </div>
            <div className="field">
              <label htmlFor="whatsapp">WhatsApp</label>
              <input id="whatsapp" name="whatsapp" />
            </div>
            <div className="field wide">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" />
            </div>
            <div className="field">
              <label htmlFor="taxCode">Codice fiscale</label>
              <input id="taxCode" name="taxCode" />
            </div>
            <div className="field">
              <label htmlFor="vatNumber">P. IVA</label>
              <input id="vatNumber" name="vatNumber" />
            </div>
            <div className="field full">
              <label htmlFor="notes">Note</label>
              <textarea id="notes" name="notes" />
            </div>
            <div className="button-row">
              <button className="primary" type="submit">
                Salva cliente
              </button>
            </div>
          </form>
        </section>

        <section className="card card-pad">
          <div className="list-header">
            <div>
              <h3>Archivio clienti</h3>
              <p className="card-muted">{customers.length} clienti registrati.</p>
            </div>
          </div>

          <div className="mini-list">
            {customers.length === 0 ? (
              <div className="empty">Nessun cliente inserito.</div>
            ) : (
              customers.map((customer) => (
                <article className="mini-item" key={customer.id}>
                  <div className="list-header">
                    <Link href={`/customers/${customer.id}`}>
                      <strong>{customer.name}</strong>
                    </Link>
                    <span className="subtle">{customer.orders.length} ordini</span>
                  </div>
                  <div className="subtle">{customer.phone}</div>
                  <div className="subtle">{customer.email || customer.whatsapp || "Nessun contatto secondario"}</div>
                  <div className="subtle">Ultimo ordine: {customer.orders[0] ? formatDate(customer.orders[0].createdAt) : "Nessuno"}</div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
