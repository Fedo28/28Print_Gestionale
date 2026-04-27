import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { resolveAttachmentStorageMode } from "@/lib/storage";

export const dynamic = "force-dynamic";

function maskDatabaseFingerprint(databaseUrl?: string) {
  if (!databaseUrl?.trim()) {
    return "DATABASE_URL mancante";
  }

  try {
    const parsed = new URL(databaseUrl);
    const host = parsed.hostname || "host sconosciuto";
    const databaseName = parsed.pathname.replace(/^\//, "") || "db sconosciuto";
    const safeHost = host
      .split(".")
      .map((segment, index, all) => {
        if (index === 0 && segment.length > 6) {
          return `${segment.slice(0, 3)}***${segment.slice(-2)}`;
        }

        if (index < all.length - 2) {
          return segment.slice(0, 2) || "**";
        }

        return segment;
      })
      .join(".");

    return `${safeHost}/${databaseName}`;
  } catch {
    return "DATABASE_URL non leggibile";
  }
}

export default async function DeployCheckPage() {
  await requireAdmin();

  const [usersCount, customersCount, ordersCount, quotesCount, activeOrdersCount, latestOrder, latestQuote] = await Promise.all([
    prisma.user.count(),
    prisma.customer.count(),
    prisma.order.count(),
    prisma.order.count({ where: { isQuote: true } }),
    prisma.order.count({ where: { isQuote: false } }),
    prisma.order.findFirst({
      where: { isQuote: false },
      orderBy: { createdAt: "desc" },
      include: { customer: true }
    }),
    prisma.order.findFirst({
      where: { isQuote: true },
      orderBy: { createdAt: "desc" },
      include: { customer: true }
    })
  ]);

  const attachmentMode = resolveAttachmentStorageMode();
  const dbFingerprint = maskDatabaseFingerprint(process.env.DATABASE_URL);

  return (
    <div className="stack">
      <PageHeader
        title="Controllo deploy"
        description="Apri questa pagina sia in locale sia su Vercel: se impronta database e conteggi coincidono, l'ambiente e allineato."
      />

      <section className="card card-pad">
        <div className="grid grid-2">
          <div className="mini-item">
            <strong>Ambiente runtime</strong>
            <div className="subtle">{process.env.VERCEL_ENV || "local"}</div>
          </div>
          <div className="mini-item">
            <strong>Node environment</strong>
            <div className="subtle">{process.env.NODE_ENV || "non definito"}</div>
          </div>
          <div className="mini-item">
            <strong>Database attivo</strong>
            <div className="subtle">{dbFingerprint}</div>
          </div>
          <div className="mini-item">
            <strong>Archivio allegati</strong>
            <div className="subtle">
              {attachmentMode === "blob" ? "Vercel Blob" : "Filesystem locale"} •{" "}
              {process.env.BLOB_READ_WRITE_TOKEN?.trim() ? "token presente" : "token assente"}
            </div>
          </div>
        </div>
      </section>

      <section className="card card-pad">
        <div className="list-header">
          <div>
            <h3>Conteggi archivio</h3>
            <p className="card-muted">Se qui vedi numeri diversi tra locale e Vercel, i due ambienti non stanno leggendo lo stesso database.</p>
          </div>
        </div>
        <div className="grid grid-2">
          <div className="mini-item">
            <strong>Utenti</strong>
            <div className="subtle">{usersCount}</div>
          </div>
          <div className="mini-item">
            <strong>Clienti</strong>
            <div className="subtle">{customersCount}</div>
          </div>
          <div className="mini-item">
            <strong>Ordini attivi</strong>
            <div className="subtle">{activeOrdersCount}</div>
          </div>
          <div className="mini-item">
            <strong>Preventivi</strong>
            <div className="subtle">{quotesCount}</div>
          </div>
          <div className="mini-item">
            <strong>Totale schede</strong>
            <div className="subtle">{ordersCount}</div>
          </div>
        </div>
      </section>

      <div className="grid grid-2">
        <section className="card card-pad">
          <div className="list-header">
            <div>
              <h3>Ultimo ordine</h3>
              <p className="card-muted">Serve a capire al volo se il deploy vede davvero gli ultimi salvataggi.</p>
            </div>
          </div>
          {latestOrder ? (
            <div className="mini-item">
              <strong>{latestOrder.orderCode}</strong>
              <div className="subtle">{latestOrder.title}</div>
              <div className="subtle">{latestOrder.customer.name}</div>
              <div className="subtle">{formatDateTime(latestOrder.createdAt)}</div>
              <div className="subtle">{formatCurrency(latestOrder.totalCents)}</div>
            </div>
          ) : (
            <div className="empty">Nessun ordine presente.</div>
          )}
        </section>

        <section className="card card-pad">
          <div className="list-header">
            <div>
              <h3>Ultimo preventivo</h3>
              <p className="card-muted">Anche qui il confronto locale/Vercel deve restare coerente.</p>
            </div>
          </div>
          {latestQuote ? (
            <div className="mini-item">
              <strong>{latestQuote.orderCode}</strong>
              <div className="subtle">{latestQuote.title}</div>
              <div className="subtle">{latestQuote.customer.name}</div>
              <div className="subtle">{formatDateTime(latestQuote.createdAt)}</div>
              <div className="subtle">{formatCurrency(latestQuote.totalCents)}</div>
            </div>
          ) : (
            <div className="empty">Nessun preventivo presente.</div>
          )}
        </section>
      </div>
    </div>
  );
}
