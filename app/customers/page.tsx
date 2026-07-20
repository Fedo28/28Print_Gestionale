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
    new?: string;
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
  const activeTypeLabel = filters.type === "ALL" ? "Tutti i clienti" : customerTypeLabels[filters.type];
  const shouldOpenNewCustomer = searchParams?.new === "1";
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
            <Link className="button primary" href="/customers?new=1#customers-new-entry">
              Nuovo cliente
            </Link>
          </div>
        }
      />

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

        <details className="card card-pad customers-entry-card customers-entry-disclosure" id="customers-new-entry" open={shouldOpenNewCustomer}>
          <summary className="customers-entry-summary">
            <div>
              <span className="compact-kicker">Nuova anagrafica</span>
              <strong>Inserisci cliente</strong>
              <span className="subtle">Apri solo quando serve.</span>
            </div>
            <span className="pill">Apri</span>
          </summary>
          <div className="customers-entry-body">
            <CustomerCreateForm
              action={createCustomerAction}
              typeOptions={Object.entries(customerTypeLabels).map(([value, label]) => ({ value, label }))}
            />
          </div>
        </details>
      </div>
    </div>
  );
}
