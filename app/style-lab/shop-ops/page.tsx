import Image from "next/image";
import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import brandLogo from "@/logo.png";

export const dynamic = "force-dynamic";

const shopOrders = [
  {
    code: "SHOP-20260829-018",
    customer: "Maria Rossi",
    meta: "4 documenti • 18 pagine • ritiro oggi",
    total: "12,80 €",
    tone: "lime"
  },
  {
    code: "SHOP-20260829-017",
    customer: "Studio Neri",
    meta: "2 documenti • SA3 colori • fattura",
    total: "34,20 €",
    tone: "cyan"
  },
  {
    code: "SHOP-20260829-016",
    customer: "Paolo Bianchi",
    meta: "1 PDF • 96 pagine • rilegatura",
    total: "22,40 €",
    tone: "red"
  }
];

const documentRows = [
  {
    name: "Contratto_affitto.pdf",
    options: "2 copie • A4 • B/N • fronte/retro • usomano 80 g",
    pages: "12 pagine"
  },
  {
    name: "Tavola_tecnica_sa3.pdf",
    options: "1 copia • SA3 • colori • solo fronte • lucida 170 g",
    pages: "3 pagine"
  },
  {
    name: "Relazione_finale.pdf",
    options: "1 copia • A4 • B/N • spillati • usomano 100 g",
    pages: "28 pagine"
  }
];

function PreviewGlyph({ kind }: { kind: "shop" | "orders" | "money" | "bell" | "file" | "arrow" }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.9,
    viewBox: "0 0 24 24"
  };

  if (kind === "shop") {
    return (
      <svg aria-hidden="true" {...common}>
        <path d="M5 10h14l-1 10H6L5 10Z" />
        <path d="M8 10V8a4 4 0 0 1 8 0v2" />
      </svg>
    );
  }

  if (kind === "orders") {
    return (
      <svg aria-hidden="true" {...common}>
        <path d="M7 4h10l2 3v13H5V4h2Z" />
        <path d="M8 11h8" />
        <path d="M8 15h6" />
      </svg>
    );
  }

  if (kind === "money") {
    return (
      <svg aria-hidden="true" {...common}>
        <path d="M12 3v18" />
        <path d="M17 7.5c-1.2-1-3-1.4-4.8-1.1-2 .3-3.2 1.4-3.2 2.8 0 3.7 8.4 1.8 8.4 5.7 0 1.7-1.6 2.9-4 3.1-2 .2-4-.4-5.4-1.6" />
      </svg>
    );
  }

  if (kind === "bell") {
    return (
      <svg aria-hidden="true" {...common}>
        <path d="M18 9a6 6 0 0 0-12 0c0 6-2 7-2 7h16s-2-1-2-7Z" />
        <path d="M10 20h4" />
      </svg>
    );
  }

  if (kind === "file") {
    return (
      <svg aria-hidden="true" {...common}>
        <path d="M7 3h7l4 4v14H7V3Z" />
        <path d="M14 3v5h5" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" {...common}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

export default async function ShopOpsStyleLabPage() {
  await requireAuth();

  return (
    <main className="shop-ops-preview-shell" aria-label="Preview estetica shop operations">
      <section className="shop-ops-preview-hero">
        <div className="shop-ops-preview-brand">
          <Image alt="28 Print" src={brandLogo} priority sizes="72px" />
          <div>
            <span>Style lab</span>
            <strong>Gestionale shop</strong>
          </div>
        </div>
        <div className="shop-ops-preview-hero-copy">
          <span className="shop-ops-preview-kicker">Prova non ufficiale</span>
          <h1>Dashboard e ordine, ma con il carattere dello shop.</h1>
          <p>
            Una direzione piu compatta, piu scura, con lime operativo e pannelli netti. Qui possiamo stressare il linguaggio visuale prima di portarlo nelle pagine vere.
          </p>
        </div>
        <div className="shop-ops-preview-hero-side">
          <div className="shop-ops-preview-hero-actions">
            <Link className="shop-ops-preview-button is-light" href="/">
              Dashboard ufficiale
            </Link>
            <Link className="shop-ops-preview-button is-outline" href="/orders/cc6fa15a-6792-4829-a70e-a77c94e04536">
              Ordine ufficiale
            </Link>
          </div>
        </div>
      </section>

      <section className="shop-ops-preview-dashboard" aria-label="Dashboard shop demo">
        <div className="shop-ops-preview-panel shop-ops-preview-panel-primary">
          <div className="shop-ops-preview-section-head">
            <div>
              <span className="shop-ops-preview-kicker">Dashboard</span>
              <h2>Oggi in produzione</h2>
            </div>
            <span className="shop-ops-preview-live-pill">
              <PreviewGlyph kind="bell" />
              3 nuovi shop
            </span>
          </div>

          <div className="shop-ops-preview-metrics">
            <article className="shop-ops-preview-metric is-lime">
              <PreviewGlyph kind="shop" />
              <strong>7</strong>
              <span>Shop da evadere</span>
            </article>
            <article className="shop-ops-preview-metric">
              <PreviewGlyph kind="orders" />
              <strong>18</strong>
              <span>Ordini attivi</span>
            </article>
            <article className="shop-ops-preview-metric">
              <PreviewGlyph kind="money" />
              <strong>428 €</strong>
              <span>Incasso previsto</span>
            </article>
          </div>

          <div className="shop-ops-preview-lane">
            <div className="shop-ops-preview-lane-head">
              <strong>Shop online da avviare</strong>
              <span>solo ordini non pronti</span>
            </div>
            {shopOrders.map((order) => (
              <article className={`shop-ops-preview-order is-${order.tone}`} key={order.code}>
                <div>
                  <span>{order.code}</span>
                  <strong>{order.customer}</strong>
                  <p>{order.meta}</p>
                </div>
                <div className="shop-ops-preview-order-side">
                  <strong>{order.total}</strong>
                  <button type="button">
                    <PreviewGlyph kind="arrow" />
                    Apri
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="shop-ops-preview-panel shop-ops-preview-side">
          <span className="shop-ops-preview-kicker">Vista rapida</span>
          <h2>Priorita visive</h2>
          <div className="shop-ops-preview-priority-list">
            <span><b />Shop online</span>
            <span><b />Urgente reale</span>
            <span><b />Da incassare</span>
          </div>
          <p>
            Il colore forte serve per orientarsi, non per decorare. Lime significa: arrivato dallo shop e da prendere in mano.
          </p>
        </aside>
      </section>

      <section className="shop-ops-preview-detail" aria-label="Dettaglio ordine shop demo">
        <div className="shop-ops-preview-detail-head">
          <div>
            <span className="shop-ops-preview-kicker">Dettaglio ordine</span>
            <h2>Ordine shop</h2>
            <p>SHOP-20260829-018 • Maria Rossi • ritiro oggi alle 18:30</p>
          </div>
          <div className="shop-ops-preview-detail-actions">
            <button className="shop-ops-preview-button is-lime" type="button">Avvia lavorazione</button>
            <button className="shop-ops-preview-button is-outline" type="button">Segna pronto</button>
          </div>
        </div>

        <div className="shop-ops-preview-detail-grid">
          <article className="shop-ops-preview-checkout-card">
            <div className="shop-ops-preview-checkout-main">
              <span>Totale pagato</span>
              <strong>12,80 €</strong>
              <p>Pagamento demo registrato, ordine pronto per la produzione.</p>
            </div>
            <div className="shop-ops-preview-checkout-stats">
              <span><strong>4</strong> documenti</span>
              <span><strong>43</strong> pagine</span>
              <span><strong>No</strong> fattura</span>
            </div>
          </article>

          <article className="shop-ops-preview-documents-card">
            <div className="shop-ops-preview-lane-head">
              <strong>Documenti da stampare</strong>
              <span>preferenze cliente</span>
            </div>
            {documentRows.map((document) => (
              <div className="shop-ops-preview-document-row" key={document.name}>
                <span className="shop-ops-preview-file-icon">
                  <PreviewGlyph kind="file" />
                </span>
                <div>
                  <strong>{document.name}</strong>
                  <p>{document.options}</p>
                </div>
                <em>{document.pages}</em>
              </div>
            ))}
          </article>

          <article className="shop-ops-preview-note-card">
            <span className="shop-ops-preview-kicker">Nota cliente</span>
            <p>Se possibile, tenere separati i due PDF del contratto. Ritiro in negozio prima della chiusura.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
