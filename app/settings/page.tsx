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
  const activeServices = services.filter((service) => service.active).length;
  const inactiveServices = services.length - activeServices;
  const headerAction =
    session.role === "ADMIN" ? (
      <div className="button-row settings-header-actions">
        <Link className="button ghost" href="/shop">
          Preview shop
        </Link>
        <Link className="button ghost" href="/settings/shop-foundation">
          Shop foundation
        </Link>
        <Link className="button ghost" href="/settings/shop-payments">
          Pagamenti shop
        </Link>
        <Link className="button ghost" href="/settings/staff">
          Profili staff
        </Link>
        <Link className="button ghost" href="/settings/deploy-check">
          Controllo deploy
        </Link>
      </div>
    ) : null;

  return (
    <div className="stack settings-page-shell settings-hub-page-shell">
      <PageHeader action={headerAction} title="Impostazioni" />

      <section className="settings-overview-grid">
        {currentUser ? (
          <section className="card card-pad settings-card settings-profile-card">
            <div className="list-header settings-section-head">
              <div>
                <span className="compact-kicker">Accesso</span>
                <h3>Profilo</h3>
              </div>
              <span className="pill">Ruolo {session.role === "ADMIN" ? "Admin" : "Operatore"}</span>
            </div>
            <AccessProfileForm currentNickname={currentUser.nickname} email={currentUser.email} />
          </section>
        ) : null}

        <section className="settings-signal-grid" aria-label="Sintesi impostazioni">
          <article className="settings-signal settings-signal-blue">
            <span>Servizi</span>
            <strong>{services.length}</strong>
          </article>
          <article className="settings-signal settings-signal-lime">
            <span>Attivi</span>
            <strong>{activeServices}</strong>
          </article>
          <article className="settings-signal settings-signal-cyan">
            <span>Disattivati</span>
            <strong>{inactiveServices}</strong>
          </article>
          <article className="settings-signal settings-signal-neutral">
            <span>WhatsApp</span>
            <strong>{whatsappTemplate.trim() ? "Ok" : "Vuoto"}</strong>
          </article>
        </section>
      </section>

      <div className="grid settings-workbench-grid">
        <section className="card card-pad settings-card settings-catalog-card">
          <div className="list-header">
            <div>
              <span className="compact-kicker">Catalogo</span>
              <h3>Servizi</h3>
            </div>
          </div>
          <div className="stack settings-catalog-stack">
            {services.length === 0 ? (
              <div className="empty">Catalogo servizi vuoto.</div>
            ) : null}

            <CatalogServiceSearch services={services} />

            <details className="settings-secondary-disclosure">
              <summary>Nuovo servizio</summary>
              <ServiceCreateForm action={createServiceAction} />
            </details>

            <details className="settings-secondary-disclosure">
              <summary>Import Excel</summary>
              <CatalogImportForm />
            </details>
          </div>
        </section>

        <section className="card card-pad settings-card settings-whatsapp-card">
          <div className="list-header settings-section-head">
            <div>
              <span className="compact-kicker">Messaggi</span>
              <h3>Template WhatsApp</h3>
            </div>
          </div>
          <form action={saveWhatsappTemplateAction} className="stack settings-whatsapp-form">
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
