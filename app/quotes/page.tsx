import Link from "next/link";
import { QuotesTable } from "@/components/quotes-table";
import { PageHeader } from "@/components/page-header";
import { requireAuth } from "@/lib/auth";
import { getOrdersList } from "@/lib/orders";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: {
    q?: string;
  };
};

function buildQuotesHref(query?: string) {
  const params = new URLSearchParams();

  if (query?.trim()) {
    params.set("q", query.trim());
  }

  const nextQuery = params.toString();
  return nextQuery ? `/quotes?${nextQuery}` : "/quotes";
}

export default async function QuotesPage({ searchParams }: Props) {
  await requireAuth();
  const filters = {
    q: searchParams?.q?.trim() || undefined
  };
  const quotes = await getOrdersList({
    query: filters.q,
    quote: "QUOTE"
  });

  return (
    <div className="stack">
      <PageHeader
        title="Preventivi"
        description="Archivio preventivi separato dal flusso ordini, per tenere distinta la trattativa dal lavoro operativo."
        action={
          <Link className="button primary" href="/quotes/new">
            Nuovo preventivo
          </Link>
        }
      />

      <section className="card card-pad">
        <form className="toolbar filters-bar" method="get">
          <div className="filters-grow">
            <input
              aria-label="Ricerca preventivi"
              defaultValue={filters.q}
              name="q"
              placeholder="Cerca codice, titolo, cliente o telefono"
            />
          </div>
          <button className="secondary" type="submit">
            Filtra
          </button>
        </form>
        {filters.q ? (
          <div className="active-filters-row">
            <span className="active-filters-label">Filtri attivi</span>
            <div className="active-filters-list">
              <Link className="active-filter-chip" href={buildQuotesHref()} prefetch={false}>
                Ricerca: {filters.q}
              </Link>
            </div>
            <Link className="compact-link" href="/quotes" prefetch={false}>
              Azzera tutto
            </Link>
          </div>
        ) : null}
      </section>

      <section className="card card-pad table-wrap orders-table-wrap">
        <QuotesTable quotes={quotes} />
      </section>
    </div>
  );
}
