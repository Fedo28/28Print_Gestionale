import { CustomerType, InvoiceStatus, MainPhase, OperationalStatus, PaymentStatus, Priority } from "@prisma/client";
import Link from "next/link";
import { OrderSearchInput } from "@/components/order-search-input";
import { OrdersTable } from "@/components/orders-table";
import { PageHeader } from "@/components/page-header";
import { requireAuth } from "@/lib/auth";
import {
  customerTypeLabels,
  invoiceStatusLabels,
  mainPhaseLabels,
  operationalStatusLabels,
  paymentStatusLabels,
  priorityLabels,
  visibleMainPhases
} from "@/lib/constants";
import {
  buildOrdersFilterHref,
  dashboardPresetLabels,
  type CustomerTypeFilter,
  type DashboardPreset,
  type OrderListFilters,
  type OrderListView,
  type OrderSortDirection,
  type OrderSortField,
  parseDashboardPreset,
  parseInvoiceFilter,
  parseOrderListView,
  parseOrderSortDirection,
  parseOrderSortField,
  parsePaymentFilter,
  parsePhaseFilter,
  parsePriorityFilter,
  parseShopOrderFilter,
  parseStatusFilter,
  parseCustomerTypeFilter
} from "@/lib/order-filters";
import { getOrdersList, getOrdersTabCounts } from "@/lib/orders";
import { automaticPriorityValues } from "@/lib/priorities";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: {
    q?: string;
    phase?: MainPhase | "ALL" | string;
    status?: OperationalStatus | "ALL" | string;
    payment?: PaymentStatus | "ALL" | string;
    invoice?: InvoiceStatus | "ALL" | string;
    priority?: Priority | "ALL" | string;
    customerType?: CustomerType | "ALL" | string;
    view?: string;
    preset?: string;
    sort?: string;
    dir?: string;
    shop?: string;
  };
};

export default async function OrdersPage({ searchParams }: Props) {
  await requireAuth();
  const requestedPhase = parsePhaseFilter(searchParams?.phase || null);
  const requestedPreset = parseDashboardPreset(searchParams?.preset || null);
  const view: OrderListView =
    parseOrderListView(searchParams?.view || null) === "DELIVERED" || requestedPhase === "CONSEGNATO" ? "DELIVERED" : "ACTIVE";
  const sort = parseOrderSortField(searchParams?.sort || null) || "delivery";
  const dir = parseOrderSortDirection(searchParams?.dir || null) || (view === "DELIVERED" ? "desc" : "asc");
  const preset: DashboardPreset =
    view === "DELIVERED"
      ? "ALL"
      : requestedPreset === "ALL"
        ? requestedPhase === "SVILUPPO_COMPLETATO"
          ? "READY"
          : "TO_DO"
        : requestedPreset;
  const filters = {
    view,
    q: searchParams?.q?.trim() || undefined,
    phase: view === "DELIVERED" ? "ALL" : requestedPhase,
    status: parseStatusFilter(searchParams?.status || null),
    payment: parsePaymentFilter(searchParams?.payment || null),
    invoice: parseInvoiceFilter(searchParams?.invoice || null),
    priority: parsePriorityFilter(searchParams?.priority || null),
    customerType: parseCustomerTypeFilter(searchParams?.customerType || null),
    shop: parseShopOrderFilter(searchParams?.shop || null),
    preset,
    sort,
    dir
  };
  const activeTab = getOrdersPrimaryTab(filters.view, filters.preset);
  const [orders, tabCounts] = await Promise.all([
    getOrdersList({
      view: filters.view,
      query: filters.q,
      phase: filters.phase,
      status: filters.status,
      payment: filters.payment,
      invoice: filters.invoice,
      priority: filters.priority,
      customerType: filters.customerType,
      shop: filters.shop,
      quote: "ORDER",
      preset: filters.preset,
      sort: filters.sort,
      direction: filters.dir
    }),
    getOrdersTabCounts({
      query: filters.q,
      status: filters.status,
      payment: filters.payment,
      invoice: filters.invoice,
      priority: filters.priority,
      customerType: filters.customerType,
      shop: filters.shop,
      quote: "ORDER"
    })
  ]);
  const presetFilterLabel = getOrdersPresetFilterLabel(filters.preset);
  const activeFilters = [
    presetFilterLabel
      ? {
          key: "preset",
          label: `Vista: ${presetFilterLabel}`,
          href: buildOrdersFilterHref({ ...filters, preset: "ALL" })
        }
      : null,
    filters.q
      ? {
          key: "q",
          label: `Ricerca: ${filters.q}`,
          href: buildOrdersFilterHref({ ...filters, q: undefined })
        }
      : null,
    filters.phase !== "ALL"
      ? {
          key: "phase",
          label: `Fase: ${mainPhaseLabels[filters.phase]}`,
          href: buildOrdersFilterHref({ ...filters, phase: "ALL" })
        }
      : null,
    filters.status !== "ALL"
      ? {
          key: "status",
          label: `Stato: ${operationalStatusLabels[filters.status]}`,
          href: buildOrdersFilterHref({ ...filters, status: "ALL" })
        }
      : null,
    filters.payment !== "ALL"
      ? {
          key: "payment",
          label: `Pagamento: ${paymentStatusLabels[filters.payment]}`,
          href: buildOrdersFilterHref({ ...filters, payment: "ALL" })
        }
      : null,
    filters.invoice !== "ALL"
      ? {
          key: "invoice",
          label: `Fatturazione: ${invoiceStatusLabels[filters.invoice]}`,
          href: buildOrdersFilterHref({ ...filters, invoice: "ALL" })
        }
      : null,
    filters.priority !== "ALL"
      ? {
          key: "priority",
          label: `Priorita: ${priorityLabels[filters.priority]}`,
          href: buildOrdersFilterHref({ ...filters, priority: "ALL" })
        }
      : null,
    filters.customerType !== "ALL"
      ? {
          key: "customerType",
          label: `Cliente: ${customerTypeLabels[filters.customerType]}`,
          href: buildOrdersFilterHref({ ...filters, customerType: "ALL" })
        }
      : null,
    filters.shop === "ONLINE"
      ? {
          key: "shop",
          label: "Origine: Shop online",
          href: buildOrdersFilterHref({ ...filters, shop: "ALL" })
        }
      : null
  ].filter((entry): entry is { key: string; label: string; href: string } => Boolean(entry));
  const hasAdvancedFilters =
    Boolean(filters.q) ||
    filters.phase !== "ALL" ||
    filters.status !== "ALL" ||
    filters.payment !== "ALL" ||
    filters.invoice !== "ALL" ||
    filters.priority !== "ALL" ||
    filters.customerType !== "ALL" ||
    filters.shop !== "ALL";
  const tabLinks = [
    { key: "TO_DO", label: "Da fare", count: tabCounts.TO_DO, href: buildOrdersTabHref("TO_DO", filters) },
    { key: "READY", label: "Pronti", count: tabCounts.READY, href: buildOrdersTabHref("READY", filters) },
    { key: "DELIVERED", label: "Consegnati", count: tabCounts.DELIVERED, href: buildOrdersTabHref("DELIVERED", filters) }
  ] as const;
  const activeWorkState = getOrdersWorkState(filters.preset);
  const workStateLinks = [
    { key: "TO_DO", label: "Tutti da fare", count: tabCounts.TO_DO, href: buildOrdersTabHref("TO_DO", filters) },
    { key: "TO_START", label: "Da avviare", count: tabCounts.TO_START, href: buildOrdersTabHref("TO_START", filters) },
    { key: "WORKING", label: "In lavorazione", count: tabCounts.WORKING, href: buildOrdersTabHref("WORKING", filters) },
    { key: "BLOCKED", label: "Sospesi", count: tabCounts.BLOCKED, href: buildOrdersTabHref("BLOCKED", filters) }
  ] as const;
  const activeWorkStateLabel = workStateLinks.find((entry) => entry.key === activeWorkState)?.label || "Tutti da fare";
  const isPrioritySort = filters.sort === "priority" && filters.dir === "desc";
  const prioritySortHref = buildOrdersFilterHref({
    ...filters,
    sort: isPrioritySort ? "delivery" : "priority",
    dir: isPrioritySort ? "asc" : "desc"
  });
  const clearAdvancedFiltersHref = buildOrdersFilterHref({
    ...filters,
    phase: "ALL",
    status: "ALL",
    payment: "ALL",
    invoice: "ALL",
    priority: "ALL",
    customerType: "ALL",
    shop: "ALL"
  });
  const resultsTitle = filters.shop === "ONLINE" ? "Ordini shop online" : getOrdersResultsTitle(filters.view, filters.preset);

  return (
    <div className="stack orders-page-shell">
      <PageHeader
        title="Ordini"
        action={
          <div className="button-row orders-page-head-actions">
            <Link className="button ghost orders-page-history-button" href="/orders/activity">
              Cronologia
            </Link>
            <Link className="button primary" href="/orders/new">
              Nuovo ordine
            </Link>
          </div>
        }
      />

      <section className="card card-pad orders-page-filters-card">
        <nav className="orders-primary-tabs" aria-label="Selettore vista ordini">
          {tabLinks.map((tab) => (
            <Link
              className={`orders-primary-tab${activeTab === tab.key ? " active" : ""}`}
              href={tab.href}
              key={tab.key}
              replace
              scroll={false}
            >
              <span>{tab.label}</span>
              <strong className="orders-tab-count">{tab.count}</strong>
            </Link>
          ))}
        </nav>
        <div className="orders-quick-controls">
          {activeTab === "TO_DO" ? (
            <details className="orders-work-state-menu">
              <summary>{`Stato: ${activeWorkStateLabel}`}</summary>
              <div className="orders-work-state-menu-panel">
                {workStateLinks.map((entry) => (
                  <Link
                    aria-current={activeWorkState === entry.key ? "page" : undefined}
                    className={activeWorkState === entry.key ? "active" : ""}
                    href={entry.href}
                    key={entry.key}
                    replace
                    scroll={false}
                  >
                    <span>{entry.label}</span>
                    <strong>{entry.count}</strong>
                  </Link>
                ))}
              </div>
            </details>
          ) : null}
          {view === "ACTIVE" ? (
            <Link
              className={`orders-priority-sort-toggle${isPrioritySort ? " active" : ""}`}
              href={prioritySortHref}
              replace
              scroll={false}
            >
              Urgenti prima
            </Link>
          ) : null}
        </div>
        <form className="stack orders-filters-shell" method="get">
          {view === "DELIVERED" ? <input name="view" type="hidden" value="DELIVERED" /> : null}
          {filters.preset !== "ALL" ? <input name="preset" type="hidden" value={filters.preset} /> : null}
          {filters.shop === "ONLINE" ? <input name="shop" type="hidden" value="online" /> : null}
          <input name="sort" type="hidden" value={filters.sort} />
          <input name="dir" type="hidden" value={filters.dir} />
          <details className="advanced-filters-panel" open={hasAdvancedFilters}>
            <summary>Altri filtri</summary>
            <div className="toolbar filters-bar advanced-filters-grid">
              <div className="orders-list-search-row">
                <div className="filters-grow">
                  <OrderSearchInput
                    ariaLabel="Ricerca ordini"
                    name="q"
                    initialValue={filters.q}
                    placeholder="Cerca cliente o lavoro"
                    requestParams={{
                      view: filters.view,
                      phase: filters.phase !== "ALL" ? filters.phase : undefined,
                      status: filters.status !== "ALL" ? filters.status : undefined,
                      payment: filters.payment !== "ALL" ? filters.payment : undefined,
                      invoice: filters.invoice !== "ALL" ? filters.invoice : undefined,
                      priority: filters.priority !== "ALL" ? filters.priority : undefined,
                      customerType: filters.customerType !== "ALL" ? filters.customerType : undefined,
                      shop: filters.shop === "ONLINE" ? "ONLINE" : undefined,
                      preset: filters.preset !== "ALL" ? filters.preset : undefined
                    }}
                    scope="orders"
                  />
                </div>
                <button className="secondary" type="submit">
                  Cerca
                </button>
              </div>
              {view === "ACTIVE" ? (
                <div className="filters-field">
                  <select aria-label="Fase" defaultValue={filters.phase} name="phase">
                    <option value="ALL">Tutte le fasi</option>
                    {visibleMainPhases.filter((value) => value !== "CONSEGNATO").map((value) => (
                      <option key={value} value={value}>
                        {mainPhaseLabels[value]}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="filters-field">
                <select aria-label="Stato operativo" defaultValue={filters.status} name="status">
                  <option value="ALL">Tutti gli stati</option>
                  {Object.entries(operationalStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filters-field">
                <select aria-label="Stato pagamento" defaultValue={filters.payment} name="payment">
                  <option value="ALL">Tutti i pagamenti</option>
                  {Object.entries(paymentStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filters-field">
                <select aria-label="Fatturazione" defaultValue={filters.invoice} name="invoice">
                  <option value="ALL">Tutta la fatturazione</option>
                  {Object.entries(invoiceStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
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
              <div className="advanced-filters-actions">
                <button className="secondary" type="submit">
                  Applica filtri
                </button>
                <Link className="compact-link" href={clearAdvancedFiltersHref} prefetch={false}>
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
            <Link className="compact-link" href={view === "DELIVERED" ? "/orders?view=DELIVERED" : "/orders"} prefetch={false}>
              Azzera tutto
            </Link>
          </div>
        ) : null}
      </section>

      <section className="card card-pad table-wrap orders-table-wrap orders-page-results-card">
        <div className="list-header orders-results-head">
          <div>
            <h3>{resultsTitle}</h3>
            <span className="subtle">
              {orders.length} {orders.length === 1 ? "ordine nella lista" : "ordini nella lista"}
            </span>
          </div>
        </div>
        <OrdersTable
          filters={filters}
          sortDirection={filters.dir}
          sortField={filters.sort}
          view={view}
          orders={orders.map((order) => ({
            ...order,
            hasWhatsapp: Boolean((order.customer.whatsapp || order.customer.phone || "").replace(/[^\d+]/g, ""))
          }))}
        />
      </section>
    </div>
  );
}

type OrdersTabKey = "TO_DO" | "TO_START" | "WORKING" | "BLOCKED" | "READY" | "DELIVERED";
type OrdersPrimaryTabKey = "TO_DO" | "READY" | "DELIVERED";
type OrdersWorkStateKey = "TO_DO" | "TO_START" | "WORKING" | "BLOCKED";

function getOrdersPrimaryTab(view: OrderListView, preset: DashboardPreset): OrdersPrimaryTabKey | null {
  if (view === "DELIVERED") {
    return "DELIVERED";
  }

  if (preset === "READY") {
    return "READY";
  }

  if (
    preset === "ALL" ||
    preset === "TO_DO" ||
    preset === "PRIORITY_TODAY" ||
    preset === "TO_START" ||
    preset === "WORKING" ||
    preset === "BLOCKED"
  ) {
    return "TO_DO";
  }

  return null;
}

function getOrdersWorkState(preset: DashboardPreset): OrdersWorkStateKey {
  if (preset === "TO_START" || preset === "WORKING" || preset === "BLOCKED") {
    return preset;
  }

  return "TO_DO";
}

function buildOrdersTabHref(
  tab: OrdersTabKey,
  filters: Pick<OrderListFilters, "q" | "status" | "payment" | "invoice" | "priority" | "customerType" | "shop" | "sort" | "dir">
) {
  const base = {
    q: filters.q,
    phase: "ALL" as const,
    status: filters.status,
    payment: filters.payment,
    invoice: filters.invoice,
    priority: filters.priority,
    customerType: filters.customerType as CustomerTypeFilter | undefined,
    shop: filters.shop,
    sort: filters.sort,
    dir: filters.dir
  };

  switch (tab) {
    case "TO_DO":
      return buildOrdersFilterHref({ ...base, view: "ACTIVE", preset: "TO_DO" });
    case "TO_START":
      return buildOrdersFilterHref({ ...base, view: "ACTIVE", preset: "TO_START" });
    case "WORKING":
      return buildOrdersFilterHref({ ...base, view: "ACTIVE", preset: "WORKING" });
    case "BLOCKED":
      return buildOrdersFilterHref({ ...base, view: "ACTIVE", preset: "BLOCKED" });
    case "READY":
      return buildOrdersFilterHref({ ...base, view: "ACTIVE", preset: "READY" });
    case "DELIVERED":
      return buildOrdersFilterHref({ ...base, view: "DELIVERED", preset: "ALL" });
    default:
      return buildOrdersFilterHref({ ...base, view: "ACTIVE", preset: "TO_DO" });
  }
}

function getOrdersResultsTitle(view: OrderListView, preset: DashboardPreset) {
  if (view === "DELIVERED") {
    return "Consegnati";
  }

  if (preset === "READY") {
    return "Pronti";
  }

  if (preset === "TO_START" || preset === "WORKING" || preset === "BLOCKED") {
    return dashboardPresetLabels[preset];
  }

  return getOrdersPresetFilterLabel(preset) || "Da fare";
}

function getOrdersPresetFilterLabel(preset: DashboardPreset) {
  if (
    preset === "ALL" ||
    preset === "TO_DO" ||
    preset === "PRIORITY_TODAY" ||
    preset === "TO_START" ||
    preset === "WORKING" ||
    preset === "BLOCKED" ||
    preset === "READY"
  ) {
    return null;
  }

  return dashboardPresetLabels[preset];
}
