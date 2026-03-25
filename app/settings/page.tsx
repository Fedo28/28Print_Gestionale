import { createServiceAction, saveWhatsappTemplateAction, updateServiceAction } from "@/app/actions";
import { CatalogImportForm } from "@/components/catalog-import-form";
import { PageHeader } from "@/components/page-header";
import { requireAuth } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { getServiceCatalogAdmin } from "@/lib/orders";
import { getWhatsappTemplate } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAuth();
  const [services, whatsappTemplate] = await Promise.all([getServiceCatalogAdmin(), getWhatsappTemplate()]);

  return (
    <div className="stack">
      <PageHeader
        title="Impostazioni"
        description="Catalogo servizi e template operativi della V1."
      />

      <div className="grid grid-2">
        <section className="card card-pad">
          <div className="stack settings-catalog-stack">
            <div className="list-header">
              <div>
                <h3>Catalogo servizi</h3>
                <p className="card-muted">Listino base modificabile, sincronizzabile da Excel e richiamabile nelle righe ordine.</p>
              </div>
            </div>
            <form action={createServiceAction} className="form-grid settings-service-form">
              <div className="field">
                <label htmlFor="code">Codice</label>
                <input id="code" name="code" placeholder="BIGLIETTI_VISITA" required />
              </div>
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
              <div className="button-row settings-form-actions">
                <button className="primary" type="submit">
                  Salva servizio
                </button>
              </div>
            </form>

            <CatalogImportForm />

            <div className="stack settings-existing-services">
              <div className="list-header">
                <div>
                  <h4>Servizi presenti</h4>
                  <p className="card-muted">Puoi aggiornare codice, nome, prezzo base, descrizione e stato senza toccare gli ordini gia creati.</p>
                </div>
              </div>
              <div className="mini-list">
                {services.map((service) => (
                  <article className={`mini-item service-admin-item${service.active ? "" : " service-admin-item-muted"}`} key={service.id}>
                    <form action={updateServiceAction} className="form-grid">
                      <input name="id" type="hidden" value={service.id} />
                      <div className="field service-admin-code">
                        <label htmlFor={`service-code-${service.id}`}>Codice</label>
                        <input defaultValue={service.code || ""} id={`service-code-${service.id}`} name="code" required />
                      </div>
                      <div className="field wide service-admin-name">
                        <label htmlFor={`service-name-${service.id}`}>Nome</label>
                        <input defaultValue={service.name} id={`service-name-${service.id}`} name="name" required />
                      </div>
                      <div className="field service-admin-price">
                        <label htmlFor={`service-price-${service.id}`}>Prezzo base</label>
                        <input
                          defaultValue={(service.basePriceCents / 100).toFixed(2).replace(".", ",")}
                          id={`service-price-${service.id}`}
                          name="basePrice"
                          required
                        />
                      </div>
                      <div className="field full service-admin-description">
                        <label htmlFor={`service-description-${service.id}`}>Descrizione</label>
                        <textarea defaultValue={service.description || ""} id={`service-description-${service.id}`} name="description" />
                      </div>
                      <div className="field service-admin-toggle">
                        <label className="toggle-field" htmlFor={`service-active-${service.id}`}>
                          <input defaultChecked={service.active} id={`service-active-${service.id}`} name="active" type="checkbox" />
                          <span>{service.active ? "Attivo" : "Disattivato"}</span>
                        </label>
                      </div>
                      <div className="button-row service-admin-actions">
                        <span className="subtle">{formatCurrency(service.basePriceCents)}</span>
                        <button className="secondary" type="submit">
                          Salva servizio
                        </button>
                      </div>
                    </form>
                  </article>
                ))}
              </div>
            </div>
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
