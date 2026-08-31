import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import {
  shopFoundationDatabaseBlocks,
  shopFoundationModuleCards,
  shopFoundationNextSteps,
  shopFoundationPlannedRoutes,
  shopFoundationProgressCards,
  shopFoundationStatusSummary
} from "@/lib/domain/commerce/shop-foundation-progress";
import { resolveShopPublicBaseUrl } from "@/lib/domain/commerce/shop-foundation";
import { requireAuth } from "@/lib/auth";
import { resolveAttachmentStorageMode } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function ShopFoundationPage() {
  await requireAuth();

  const resolvedShopBaseUrl = resolveShopPublicBaseUrl(process.env.SHOP_PUBLIC_BASE_URL);
  const attachmentMode = resolveAttachmentStorageMode();

  return (
    <div className="stack">
      <PageHeader
        action={
          <div className="button-row">
            <Link className="button ghost" href="/shop">
              Apri preview shop
            </Link>
            <Link className="button ghost" href="/shop/stampa-documenti">
              Preview stampa documenti
            </Link>
            <Link className="button ghost" href="/settings">
              Torna alle impostazioni
            </Link>
          </div>
        }
        title="Shop Foundation"
      />

      <section className="card card-pad">
        <div className="list-header">
          <div>
            <h3>Stato attuale</h3>
          </div>
          <span className="pill">Solo struttura, non ancora shop pubblico</span>
        </div>
        <div className="grid grid-2">
          {shopFoundationProgressCards.map((card) => (
            <article className="mini-item" key={card.title}>
              <strong>{card.title}</strong>
              <div className="subtle">{card.value}</div>
              <div className="hint">{card.detail}</div>
            </article>
          ))}
          <article className="mini-item">
            <strong>Base URL risolta</strong>
            <div className="subtle">{resolvedShopBaseUrl}</div>
            <div className="hint">Legge `SHOP_PUBLIC_BASE_URL` e cade su `shop.28print.it` come default.</div>
          </article>
          <article className="mini-item">
            <strong>Storage operativo attuale</strong>
            <div className="subtle">{attachmentMode === "blob" ? "Vercel Blob" : "Filesystem locale"}</div>
            <div className="hint">La foundation shop e pronta per file privati, ma il flusso pubblico non e ancora aperto.</div>
          </article>
        </div>
      </section>

      <div className="grid grid-2">
        <section className="card card-pad">
          <div className="list-header">
            <div>
              <h3>Moduli gia estratti</h3>
            </div>
          </div>
          <div className="stack">
            {shopFoundationModuleCards.map((module) => (
              <article className="mini-item" key={module.path}>
                <strong>{module.title}</strong>
                <div className="subtle">
                  <code>{module.path}</code>
                </div>
                <div className="hint">{module.detail}</div>
              </article>
            ))}
          </div>
        </section>

        <section className="card card-pad">
          <div className="list-header">
            <div>
              <h3>Dominio shop preparato</h3>
            </div>
          </div>
          <div className="stack">
            <article className="mini-item">
              <strong>Stati ordine shop</strong>
              <div className="subtle">{shopFoundationStatusSummary.salesOrderStatuses.join(" • ")}</div>
            </article>
            <article className="mini-item">
              <strong>Origini supportate</strong>
              <div className="subtle">{shopFoundationStatusSummary.salesOrderOrigins.join(" • ")}</div>
            </article>
            <article className="mini-item">
              <strong>Rotte target</strong>
              <div className="stack">
                {shopFoundationPlannedRoutes.map((route) => (
                  <code key={route}>{route}</code>
                ))}
              </div>
            </article>
          </div>
        </section>
      </div>

      <section className="card card-pad">
        <div className="list-header">
          <div>
            <h3>Blocchi database aggiunti</h3>
          </div>
          <span className="pill">Migrazione additiva pronta</span>
        </div>
        <div className="grid grid-2">
          {shopFoundationDatabaseBlocks.map((block) => (
            <article className="mini-item" key={block.title}>
              <strong>{block.title}</strong>
              <div className="stack">
                {block.items.map((item) => (
                  <code key={item}>{item}</code>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="card card-pad">
        <div className="list-header">
          <div>
            <h3>Prossimi step tecnici</h3>
          </div>
        </div>
        <div className="stack">
          {shopFoundationNextSteps.map((step, index) => (
            <article className="mini-item" key={step}>
              <strong>Step {index + 1}</strong>
              <div className="subtle">{step}</div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
