import { CustomerType, Priority } from "@prisma/client";
import Link from "next/link";
import { OrderSearchInput } from "@/components/order-search-input";
import { QuotesTable } from "@/components/quotes-table";
import { PageHeader } from "@/components/page-header";
import { requireAuth } from "@/lib/auth";
import { customerTypeLabels, priorityLabels } from "@/lib/constants";
import {
  parseCustomerTypeFilter,
  parseOrderSortDirection,
  parseOrderSortField,
  parsePriorityFilter,
  type CustomerTypeFilter,
  type OrderSortDirection,
  type OrderSortField,
  type PriorityFilter
} from "@/lib/order-filters";
import { getOrdersList } from "@/lib/orders";
import { automaticPriorityValues } from "@/lib/priorities";

export const dynamic = "force-dynamic";

type QuotesDeliveryFilter = "ALL" | "PENDING" | "SCHEDULED";

type Props = {
  searchParams?: {
    q?: string;
    priority?: Priority | "ALL" | string;
    customerType?: CustomerType | "ALL" | string;
    delivery?: string;
    sort?: string;
    dir?: string;
  };
};

type QuotesPageFilters = {
  q?: string;
  priority: PriorityFilter;
  customerType: CustomerTypeFilter;
  delivery: QuotesDeliveryFilter;
  sort: OrderSortField;
  dir: OrderSortDirection;
};

function parseQuotesDeliveryFilter(raw: string | null | undefined): QuotesDeliveryFilter {
  if (raw === "PENDING" || raw === "SCHEDULED") {
    return raw;
  }

  return "ALL";
}

function buildQuotesHref(filters: Partial<QuotesPageFilters> = {}) {
  const params = new URLSearchParams();

  if (filters.q?.trim()) {
    params.set("q", filters.q.trim());
  }

  if (filters.priority && filters.priority !== "ALL") {
    params.set("priority", filters.priority);
  }

  if (filters.customerType && filters.customerType !== "ALL") {
    params.set("customerType", filters.customerType);
  }

  if (filters.delivery && filters.delivery !== "ALL") {
    params.set("delivery", filters.delivery);
  }

  if (filters.sort) {
    params.set("sort", filters.sort);
  }

  if (filters.dir) {
    params.set("dir", filters.dir);
  }

  const nextQuery = params.toString();
  return nextQuery ? `/quotes?${nextQuery}` : "/quotes";
}

export default async function QuotesPage({ searchParams }: Props) {
  await requireAuth();
  const filters = {
    q: searchParams?.q?.trim() || undefined,
    priority: parsePriorityFilter(searchParams?.priority || null),
    customerType: parseCustomerTypeFilter(searchParams?.customerType || null),
    delivery: parseQuotesDeliveryFilter(searchParams?.delivery),
    sort: parseOrderSortField(searchParams?.sort || null) || "delivery",
    dir: parseOrderSortDirection(searchParams?.dir || null) || "asc"
  };
  const quotesCollection = await getOrdersList({
    query: filters.q,
    priority: filters.priority,
    customerType: filters.customerType,
    quote: "QUOTE",
    sort: filters.sort,
    direction: filters.dir
  });
  const quotes =
    filters.delivery === "PENDING"
      ? quotesCollection.filter((quote) => quote.schedulePending)
      : filters.delivery === "SCHEDULED"
        ? quotesCollection.filter((quote) => !quote.schedulePending)
        : quotesCollection;
  const activeFilters = [
    filters.q
      ? {
          key: "q",
          label: `Ricerca: ${filters.q}`,
          href: buildQuotesHref({ ...filters, q: undefined })
        }
      : null,
    filters.priority !== "ALL"
      ? {
          key: "priority",
          label: `Priorita: ${priorityLabels[filters.priority]}`,
          href: buildQuotesHref({ ...filters, priority: "ALL" })
        }
      : null,
    filters.customerType !== "ALL"
      ? {
          key: "customerType",
          label: `Cliente: ${customerTypeLabels[filters.customerType]}`,
          href: buildQuotesHref({ ...filters, customerType: "ALL" })
        }
      : null,
    filters.delivery !== "ALL"
      ? {
          key: "delivery",
          label: `Pianificazione: ${filters.delivery === "PENDING" ? "Da definire" : "Con data stimata"}`,
          href: buildQuotesHref({ ...filters, delivery: "ALL" })
        }
      : null
  ].filter((entry): entry is { key: string; label: string; href: string } => Boolean(entry));
  const hasAdvancedFilters = filters.priority !== "ALL" || filters.customerType !== "ALL" || filters.delivery !== "ALL";

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
        <form className="stack orders-filters-shell" method="get">
          <input name="sort" type="hidden" value={filters.sort} />
          <input name="dir" type="hidden" value={filters.dir} />
          <div className="toolbar filters-bar">
            <div className="filters-grow">
              <OrderSearchInput
                ariaLabel="Ricerca preventivi"
                name="q"
                initialValue={filters.q}
                placeholder="Cerca codice, titolo, cliente o telefono"
                requestParams={{
                  priority: filters.priority !== "ALL" ? filters.priority : undefined,
                  customerType: filters.customerType !== "ALL" ? filters.customerType : undefined
                }}
                scope="quotes"
              />
            </div>
            <button className="secondary" type="submit">
              Cerca
            </button>
          </div>
          <details className="advanced-filters-panel" open={hasAdvancedFilters}>
            <summary>Filtri avanzati</summary>
            <div className="toolbar filters-bar advanced-filters-grid">
              <div className="filters-field">
                <select aria-label="Priorita" defaultValue={filters.priority} name="priority">
                  <option value="ALL">Tutte le priorita</option>
                  {automaticPriorityValues.map((value) => (
                    <option key={value} value={value}>
                      {priorityLabels[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filters-field">
                <select aria-label="Tipo cliente" defaultValue={filters.customerType} name="customerType">
                  <option value="ALL">Tutti i clienti</option>
                  {Object.entries(customerTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filters-field">
                <select aria-label="Pianificazione" defaultValue={filters.delivery} name="delivery">
                  <option value="ALL">Tutta la pianificazione</option>
                  <option value="SCHEDULED">Con data stimata</option>
                  <option value="PENDING">Da definire</option>
                </select>
              </div>
              <div className="advanced-filters-actions">
                <button className="secondary" type="submit">
                  Applica filtri
                </button>
                <Link
                  className="compact-link"
                  href={buildQuotesHref({ q: filters.q, sort: filters.sort, dir: filters.dir })}
                  prefetch={false}
                >
                  Pulisci avanzati
                </Link>
              </div>
            </div>
          </details>
        </form>
        {activeFilters.length > 0 ? (
          <div className="active-filters-row">
            <span className="active-filters-label">Filtri attivi</span>
            <div className="active-filters-list">
              {activeFilters.map((filter) => (
                <Link className="active-filter-chip" href={filter.href} key={filter.key} prefetch={false}>
                  {filter.label}
                </Link>
              ))}
            </div>
            <Link className="compact-link" href="/quotes" prefetch={false}>
              Azzera tutto
            </Link>
          </div>
        ) : null}
      </section>

      <section className="card card-pad table-wrap orders-table-wrap quotes-page-results-card">
        <div className="list-header orders-results-head quotes-results-head">
          <div>
            <h3>Risultati</h3>
            <span className="subtle">
              {quotes.length} {quotes.length === 1 ? "preventivo nella lista" : "preventivi nella lista"}
            </span>
          </div>
        </div>
        <QuotesTable
          buildSortHref={(field) =>
            buildQuotesHref({
              ...filters,
              sort: field,
              dir: filters.sort === field && filters.dir === "asc" ? "desc" : "asc"
            })
          }
          quotes={quotes}
          sortDirection={filters.dir}
          sortField={filters.sort}
        />
      </section>
    </div>
  );
}
