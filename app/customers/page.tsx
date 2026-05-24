import Link from "next/link";
import { createCustomerAction } from "@/app/actions";
import { CustomerCreateForm } from "@/components/customer-create-form";
import { CustomersDirectory } from "@/components/customers-directory";
import { PageHeader } from "@/components/page-header";
import { requireAuth } from "@/lib/auth";
import { buildCustomersFilterHref, parseCustomerTypeFilter } from "@/lib/customer-filters";
import { customerTypeLabels } from "@/lib/constants";
import { getCustomers } from "@/lib/orders";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: {
    type?: string;
  };
};

export default async function CustomersPage({ searchParams }: Props) {
  await requireAuth();
  const filters = {
    type: parseCustomerTypeFilter(searchParams?.type || null)
  };
  const allCustomersPromise = getCustomers();
  const filteredCustomersPromise = filters.type === "ALL" ? allCustomersPromise : getCustomers({ type: filters.type });
  const [allCustomers, customers] = await Promise.all([allCustomersPromise, filteredCustomersPromise]);
  const customerTypeCounts = Object.fromEntries(
    Object.keys(customerTypeLabels).map((value) => [
      value,
      allCustomers.filter((customer) => customer.type === value).length
    ])
  ) as Record<keyof typeof customerTypeLabels, number>;
  const customersWithOrdersCount = allCustomers.filter((customer) => customer.orders.length > 0).length;
  const activeTypeLabel = filters.type === "ALL" ? "Tutti i clienti" : customerTypeLabels[filters.type];
  const typeSummaryCards = [
    {
      key: "ALL" as const,
      label: "Rubrica completa",
      value: allCustomers.length,
      href: buildCustomersFilterHref({ type: "ALL" })
    },
    ...Object.entries(customerTypeLabels).map(([value, label]) => ({
      key: value as keyof typeof customerTypeLabels,
      label,
      value: customerTypeCounts[value as keyof typeof customerTypeLabels],
      href: buildCustomersFilterHref({ type: value as keyof typeof customerTypeLabels })
    }))
  ];
  const typeTabs = [
    {
      key: "ALL" as const,
      label: "Tutti",
      count: allCustomers.length,
      href: buildCustomersFilterHref({ type: "ALL" })
    },
    ...Object.entries(customerTypeLabels).map(([value, label]) => ({
      key: value,
      label,
      count: customerTypeCounts[value as keyof typeof customerTypeLabels],
      href: buildCustomersFilterHref({ type: value as keyof typeof customerTypeLabels })
    }))
  ];

  return (
    <div className="stack customers-page-shell">
      <PageHeader
        title="Clienti"
        action={
          <div className="button-row customers-page-header-actions">
            <Link className="button primary" href="#customers-new-entry">
              Nuovo cliente
            </Link>
          </div>
        }
      />

      <section className="customers-overview-grid" aria-label="Panoramica clienti">
        {typeSummaryCards.map((card) => (
          <Link
            className={`customers-overview-card compact-card-link${filters.type === card.key ? " active" : ""}`}
            href={card.href}
            key={card.key}
            prefetch={false}
          >
            <span className="customers-overview-card-kicker">{card.label}</span>
            <strong>{card.value}</strong>
          </Link>
        ))}
        <article className="customers-overview-note">
          <span className="customers-overview-card-kicker">Storico ordini</span>
          <strong>{customersWithOrdersCount}</strong>
        </article>
      </section>

      <div className="customers-page-grid">
        <section className="card card-pad customers-directory-card">
          <div className="list-header customers-directory-header">
            <div className="customers-directory-header-copy">
              <span className="compact-kicker">Archivio clienti</span>
              <h3>{activeTypeLabel}</h3>
            </div>
            <div className="customers-directory-header-stats">
              <span className="pill">{customers.length} visibili</span>
            </div>
          </div>

          <nav className="customers-type-switch" aria-label="Filtro tipo cliente">
            {typeTabs.map((tab) => (
              <Link
                className={`customers-type-link${filters.type === tab.key ? " active" : ""}`}
                href={tab.href}
                key={tab.key}
                prefetch={false}
              >
                <span>{tab.label}</span>
                <strong>{tab.count}</strong>
              </Link>
            ))}
          </nav>

          <CustomersDirectory customers={customers} />
        </section>

        <aside className="card card-pad customers-entry-card" id="customers-new-entry">
          <div className="list-header customers-entry-head">
            <div>
              <span className="compact-kicker">Nuova anagrafica</span>
              <h3>Inserisci cliente</h3>
            </div>
          </div>
          <CustomerCreateForm
            action={createCustomerAction}
            typeOptions={Object.entries(customerTypeLabels).map(([value, label]) => ({ value, label }))}
          />
        </aside>
      </div>
    </div>
  );
}
