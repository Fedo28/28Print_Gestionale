import { InvoiceStatus, MainPhase, OperationalStatus, PaymentStatus, Priority } from "@prisma/client";
import Link from "next/link";
import { OrdersTable } from "@/components/orders-table";
import { PageHeader } from "@/components/page-header";
import { requireAuth } from "@/lib/auth";
import {
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
  type DashboardPreset,
  type OrderListView,
  parseDashboardPreset,
  parseInvoiceFilter,
  parseOrderListView,
  parsePaymentFilter,
  parsePhaseFilter,
  parsePriorityFilter,
  parseStatusFilter
} from "@/lib/order-filters";
import { getOrdersList } from "@/lib/orders";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: {
    q?: string;
    phase?: MainPhase | "ALL" | string;
    status?: OperationalStatus | "ALL" | string;
    payment?: PaymentStatus | "ALL" | string;
    invoice?: InvoiceStatus | "ALL" | string;
    priority?: Priority | "ALL" | string;
    view?: string;
    preset?: string;
  };
};

export default async function OrdersPage({ searchParams }: Props) {
  await requireAuth();
  const requestedPhase = parsePhaseFilter(searchParams?.phase || null);
  const view: OrderListView =
    parseOrderListView(searchParams?.view || null) === "DELIVERED" || requestedPhase === "CONSEGNATO" ? "DELIVERED" : "ACTIVE";
  const filters = {
    view,
    q: searchParams?.q?.trim() || undefined,
    phase: view === "DELIVERED" ? "ALL" : requestedPhase,
    status: parseStatusFilter(searchParams?.status || null),
    payment: parsePaymentFilter(searchParams?.payment || null),
    invoice: parseInvoiceFilter(searchParams?.invoice || null),
    priority: parsePriorityFilter(searchParams?.priority || null),
    preset: view === "DELIVERED" ? "ALL" : parseDashboardPreset(searchParams?.preset || null)
  };
  const activeTab = getOrdersTab(filters.view, filters.preset);
  const orders = await getOrdersList({
    view: filters.view,
    query: filters.q,
    phase: filters.phase,
    status: filters.status,
    payment: filters.payment,
    invoice: filters.invoice,
    priority: filters.priority,
    quote: "ORDER",
    preset: filters.preset
  });
  const activeFilters = [
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
  ].filter((entry): entry is { key: string; label: string; href: string } => Boolean(entry));
  const hasAdvancedFilters =
    filters.phase !== "ALL" || filters.status !== "ALL" || filters.payment !== "ALL" || filters.invoice !== "ALL" || filters.priority !== "ALL";
  const tabLinks = [
    { key: "ACTIVE_ALL", label: "Attivi", href: buildOrdersTabHref("ACTIVE_ALL", filters.q) },
    { key: "TODAY", label: "Oggi", href: buildOrdersTabHref("TODAY", filters.q) },
    { key: "TO_START", label: "Da avviare", href: buildOrdersTabHref("TO_START", filters.q) },
    { key: "WORKING", label: "In lavorazione", href: buildOrdersTabHref("WORKING", filters.q) },
    { key: "BLOCKED", label: "Sospesi", href: buildOrdersTabHref("BLOCKED", filters.q) },
    { key: "READY", label: "Pronti", href: buildOrdersTabHref("READY", filters.q) },
    { key: "DELIVERED", label: "Consegnati", href: buildOrdersTabHref("DELIVERED", filters.q) }
  ] as const;

  return (
    <div className="stack">
      <PageHeader
        title={view === "DELIVERED" ? "Storico ordini" : "Ordini"}
        description={
          view === "DELIVERED"
            ? "Storico dei lavori gia consegnati, separato dalla vista operativa per tenere pulita la lista ordini."
            : filters.preset !== "ALL"
            ? `${dashboardPresetLabels[filters.preset]}. Puoi affinare ulteriormente la lista con ricerca e filtri aggiuntivi.`
            : "Ricerca per codice, titolo, cliente e telefono sugli ordini confermati. Ordinamento per consegna e priorita."
        }
        action={
          <Link className="button primary" href="/orders/new">
            Nuovo ordine
          </Link>
        }
      />

      <section className="card card-pad">
        <nav className="calendar-view-switch orders-view-switch" aria-label="Selettore vista ordini">
          {tabLinks.map((tab) => (
            <Link
              className={`calendar-switch-link${activeTab === tab.key ? " active" : ""}`}
              href={tab.href}
              key={tab.key}
              replace
              scroll={false}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        <form className="stack orders-filters-shell" method="get">
          {view === "DELIVERED" ? <input name="view" type="hidden" value="DELIVERED" /> : null}
          {filters.preset !== "ALL" ? <input name="preset" type="hidden" value={filters.preset} /> : null}
          <div className="toolbar filters-bar">
            <div className="filters-grow">
              <input
                aria-label="Ricerca ordini"
                defaultValue={filters.q}
                name="q"
                placeholder={view === "DELIVERED" ? "Cerca nello storico per codice, titolo, cliente o telefono" : "Cerca codice, titolo, cliente o telefono"}
              />
            </div>
            <button className="secondary" type="submit">
              Cerca
            </button>
          </div>
          <details className="advanced-filters-panel" open={hasAdvancedFilters}>
            <summary>Filtri avanzati</summary>
            <div className="toolbar filters-bar advanced-filters-grid">
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
                  {Object.entries(priorityLabels).map(([value, label]) => (
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
                <Link className="compact-link" href={buildOrdersTabHref(activeTab, filters.q)} prefetch={false}>
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

      <section className="card card-pad table-wrap orders-table-wrap">
        <OrdersTable
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

type OrdersTabKey = "ACTIVE_ALL" | "TODAY" | "TO_START" | "WORKING" | "BLOCKED" | "READY" | "DELIVERED";

function getOrdersTab(view: OrderListView, preset: DashboardPreset): OrdersTabKey {
  if (view === "DELIVERED") {
    return "DELIVERED";
  }

  if (preset === "PRIORITY_TODAY") {
    return "TODAY";
  }

  if (preset === "TO_START") {
    return "TO_START";
  }

  if (preset === "WORKING") {
    return "WORKING";
  }

  if (preset === "BLOCKED") {
    return "BLOCKED";
  }

  if (preset === "READY") {
    return "READY";
  }

  return "ACTIVE_ALL";
}

function buildOrdersTabHref(tab: OrdersTabKey, q?: string) {
  const base = {
    q,
    phase: "ALL" as const,
    status: "ALL" as const,
    payment: "ALL" as const,
    invoice: "ALL" as const,
    priority: "ALL" as const
  };

  switch (tab) {
    case "TODAY":
      return buildOrdersFilterHref({ ...base, view: "ACTIVE", preset: "PRIORITY_TODAY" });
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
      return buildOrdersFilterHref({ ...base, view: "ACTIVE", preset: "ALL" });
  }
}
