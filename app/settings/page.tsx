import { createServiceAction, saveWhatsappTemplateAction } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { requireAuth } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { getServices } from "@/lib/orders";
import { getWhatsappTemplate } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAuth();
  const [services, whatsappTemplate] = await Promise.all([getServices(), getWhatsappTemplate()]);

  return (
    <div className="stack">
      <PageHeader
        title="Impostazioni"
        description="Catalogo servizi e template operativi della V1."
      />

      <div className="grid grid-2">
        <section className="card card-pad">
          <div className="list-header">
            <div>
              <h3>Catalogo servizi</h3>
              <p className="card-muted">Listino base da richiamare nelle righe ordine.</p>
            </div>
          </div>
          <form action={createServiceAction} className="form-grid">
            <div className="field wide">
              <label htmlFor="name">Nome servizio</label>
              <input id="name" name="name" required />
            </div>
            <div className="field">
              <label htmlFor="basePrice">Prezzo base</label>
              <input id="basePrice" name="basePrice" placeholder="0,00" />
            </div>
            <div className="field full">
              <label htmlFor="description">Descrizione</label>
              <textarea id="description" name="description" />
            </div>
            <div className="button-row">
              <button className="primary" type="submit">
                Salva servizio
              </button>
            </div>
          </form>

          <div className="mini-list">
            {services.map((service) => (
              <article className="mini-item" key={service.id}>
                <div className="list-header">
                  <strong>{service.name}</strong>
                  <span>{formatCurrency(service.basePriceCents)}</span>
                </div>
                <div className="subtle">{service.description || "Nessuna descrizione"}</div>
              </article>
            ))}
          </div>
        </section>

        <section className="card card-pad">
          <div className="list-header">
            <div>
              <h3>Template WhatsApp</h3>
              <p className="card-muted">Supporta i placeholder {"{nome_cliente}"}, {"{order_code}"} e {"{titolo_ordine}"}.</p>
            </div>
          </div>
          <form action={saveWhatsappTemplateAction} className="stack">
            <label htmlFor="template">Messaggio</label>
            <textarea defaultValue={whatsappTemplate} id="template" name="template" />
            <div className="button-row">
              <button className="primary" type="submit">
                Salva template
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
