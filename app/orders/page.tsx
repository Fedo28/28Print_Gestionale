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
  parseDashboardPreset,
  parseInvoiceFilter,
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
    preset?: string;
  };
};

export default async function OrdersPage({ searchParams }: Props) {
  await requireAuth();
  const filters = {
    q: searchParams?.q?.trim() || undefined,
    phase: parsePhaseFilter(searchParams?.phase || null),
    status: parseStatusFilter(searchParams?.status || null),
    payment: parsePaymentFilter(searchParams?.payment || null),
    invoice: parseInvoiceFilter(searchParams?.invoice || null),
    priority: parsePriorityFilter(searchParams?.priority || null),
    preset: parseDashboardPreset(searchParams?.preset || null)
  };
  const orders = await getOrdersList({
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
    filters.preset !== "ALL"
      ? {
          key: "preset",
          label: `Vista: ${dashboardPresetLabels[filters.preset]}`,
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
  ].filter((entry): entry is { key: string; label: string; href: string } => Boolean(entry));

  return (
    <div className="stack">
      <PageHeader
        title="Ordini"
        description={
          filters.preset !== "ALL"
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
        <form className="toolbar filters-bar" method="get">
          {filters.preset !== "ALL" ? <input name="preset" type="hidden" value={filters.preset} /> : null}
          <div className="filters-grow">
            <input
              aria-label="Ricerca ordini"
              defaultValue={filters.q}
              name="q"
              placeholder="Cerca codice, titolo, cliente o telefono"
            />
          </div>
          <div className="filters-field">
            <select aria-label="Fase" defaultValue={filters.phase} name="phase">
              <option value="ALL">Tutte le fasi</option>
              {visibleMainPhases.map((value) => (
                <option key={value} value={value}>
                  {mainPhaseLabels[value]}
                </option>
              ))}
            </select>
          </div>
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
          <button className="secondary" type="submit">
            Filtra
          </button>
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
            <Link className="compact-link" href="/orders" prefetch={false}>
              Azzera tutto
            </Link>
          </div>
        ) : null}
      </section>

      <section className="card card-pad table-wrap orders-table-wrap">
        <OrdersTable
          orders={orders.map((order) => ({
            ...order,
            hasWhatsapp: Boolean((order.customer.whatsapp || order.customer.phone || "").replace(/[^\d+]/g, ""))
          }))}
        />
      </section>
    </div>
  );
}
