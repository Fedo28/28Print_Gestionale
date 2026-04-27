import Link from "next/link";
import { createServiceAction, saveWhatsappTemplateAction } from "@/app/actions";
import { AccessProfileForm } from "@/components/access-profile-form";
import { CatalogImportForm } from "@/components/catalog-import-form";
import { CatalogServiceSearch } from "@/components/catalog-service-search";
import { PageHeader } from "@/components/page-header";
import { ServiceCreateForm } from "@/components/service-create-form";
import { requireAuth } from "@/lib/auth";
import { getServiceCatalogAdmin } from "@/lib/orders";
import { getStaffUserProfile } from "@/lib/staff-users";
import { getWhatsappTemplate } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireAuth();
  const [services, whatsappTemplate, currentUser] = await Promise.all([
    getServiceCatalogAdmin(),
    getWhatsappTemplate(),
    getStaffUserProfile(session.userId)
  ]);

  return (
    <div className="stack">
      <PageHeader
        title="Impostazioni"
        description="Catalogo servizi e template operativi della V1."
      />

      {currentUser ? (
        <section className="card card-pad">
          <div className="list-header">
            <div>
              <h3>Profilo accesso</h3>
              <p className="card-muted">Dopo il primo accesso puoi personalizzare il nickname con cui entri nel gestionale.</p>
            </div>
            <span className="pill">Ruolo {session.role === "ADMIN" ? "Admin" : "Operatore"}</span>
          </div>
          <AccessProfileForm currentNickname={currentUser.nickname} email={currentUser.email} />
        </section>
      ) : null}

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
            Da qui gestisci profilazione colleghi, bozza invito e stato dell'invio mail.
          </p>
        </section>
      ) : null}

      {session.role === "ADMIN" ? (
        <section className="card card-pad">
          <div className="list-header">
            <div>
              <h3>Controllo deploy</h3>
              <p className="card-muted">Confronta locale e Vercel per capire subito se stanno leggendo lo stesso database.</p>
            </div>
            <Link className="button secondary" href="/settings/deploy-check">
              Apri controllo
            </Link>
          </div>
          <p className="hint">
            Mostra ambiente attivo, impronta del database, archivio allegati e conteggi principali di ordini, preventivi e clienti.
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
            <ServiceCreateForm action={createServiceAction} />

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
