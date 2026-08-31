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
  const headerAction =
    session.role === "ADMIN" ? (
      <div className="button-row">
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
    <div className="stack">
      <PageHeader action={headerAction} title="Impostazioni" />

      {currentUser ? (
        <section className="card card-pad">
          <div className="list-header">
            <div>
              <h3>Profilo accesso</h3>
            </div>
            <span className="pill">Ruolo {session.role === "ADMIN" ? "Admin" : "Operatore"}</span>
          </div>
          <AccessProfileForm currentNickname={currentUser.nickname} email={currentUser.email} />
        </section>
      ) : null}

      <div className="grid grid-2">
        <section className="card card-pad">
          <div className="stack settings-catalog-stack">
            <div className="list-header">
              <div>
                <h3>Catalogo servizi</h3>
              </div>
            </div>
            {services.length === 0 ? (
              <div className="empty">Catalogo servizi vuoto.</div>
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
