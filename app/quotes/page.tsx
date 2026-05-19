import Link from "next/link";
import { OrderSearchInput } from "@/components/order-search-input";
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
    <div className="stack quotes-page-shell">
      <PageHeader
        title="Preventivi"
        action={
          <Link className="button primary" href="/quotes/new">
            Nuovo preventivo
          </Link>
        }
      />

      <section className="card card-pad quotes-page-filters-card">
        <form className="toolbar filters-bar" method="get">
          <div className="filters-grow">
            <OrderSearchInput
              ariaLabel="Ricerca preventivi"
              name="q"
              initialValue={filters.q}
              placeholder="Cerca codice, titolo, cliente o telefono"
              scope="quotes"
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

      <section className="card card-pad table-wrap orders-table-wrap quotes-page-results-card">
        <QuotesTable quotes={quotes} />
      </section>
    </div>
  );
}
