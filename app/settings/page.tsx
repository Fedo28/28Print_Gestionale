import Link from "next/link";
import { createServiceAction, saveWhatsappTemplateAction } from "@/app/actions";
import { CatalogImportForm } from "@/components/catalog-import-form";
import { CatalogServiceSearch } from "@/components/catalog-service-search";
import { PageHeader } from "@/components/page-header";
import { requireAuth } from "@/lib/auth";
import { getServiceCatalogAdmin } from "@/lib/orders";
import { getWhatsappTemplate } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireAuth();
  const [services, whatsappTemplate] = await Promise.all([getServiceCatalogAdmin(), getWhatsappTemplate()]);

  return (
    <div className="stack">
      <PageHeader
        title="Impostazioni"
        description="Catalogo servizi e template operativi della V1."
      />

      {session.role === "ADMIN" ? (
        <section className="card card-pad">
          <div className="list-header">
            <div>
              <h3>Profili staff</h3>
              <p className="card-muted">Nickname, password iniziale ed email dei colleghi in un punto unico.</p>
            </div>
            <Link className="button secondary" href="/settings/staff">
              Apri profili staff
            </Link>
          </div>
          <p className="hint">
            La mail di accesso e gia predisposta ma il link finale verra configurato quando decideremo dove mettere online la versione stabile.
          </p>
        </section>
      ) : null}

      <div className="grid grid-2">
        <section className="card card-pad">
          <div className="stack settings-catalog-stack">
            <div className="list-header">
              <div>
                <h3>Catalogo servizi</h3>
                <p className="card-muted">Listino base modificabile, sincronizzabile da Excel e richiamabile nelle righe ordine.</p>
              </div>
            </div>
            <p className="hint">
              Il primo deploy produzione carica automaticamente il template Excel incluso nel progetto se il catalogo e
              vuoto. Da questa schermata puoi comunque reimportare il file in qualsiasi momento.
            </p>
            {services.length === 0 ? (
              <div className="empty">
                Il catalogo servizi e ancora vuoto in questo ambiente. Se il deploy e appena stato creato, rifai il
                bootstrap oppure importa manualmente il file Excel da qui.
              </div>
            ) : null}
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
              <div className="field full">
                <label htmlFor="quantityTiers">Scaglioni quantita</label>
                <input id="quantityTiers" name="quantityTiers" placeholder="1-9:0,50 | 10-49:0,30 | 50+:0,20" />
                <p className="hint">Facoltativo. Se la quantita rientra in uno scaglione, il prezzo unitario viene preso da qui invece che dal listino base.</p>
              </div>
              <div className="button-row settings-form-actions">
                <button className="primary" type="submit">
                  Salva servizio
                </button>
              </div>
            </form>

            <CatalogImportForm />

            <CatalogServiceSearch services={services} />
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
