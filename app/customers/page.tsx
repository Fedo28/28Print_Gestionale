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
  const customers = await getCustomers({
    type: filters.type
  });
  const typeTabs = [
    { key: "ALL", label: "Tutti", href: buildCustomersFilterHref({ type: "ALL" }) },
    ...Object.entries(customerTypeLabels).map(([value, label]) => ({
      key: value,
      label,
      href: buildCustomersFilterHref({ type: value as keyof typeof customerTypeLabels })
    }))
  ];

  return (
    <div className="stack customers-page-shell">
      <PageHeader title="Clienti" />

      <div className="grid grid-2 customers-page-grid">
        <section className="card card-pad customers-entry-card">
          <div className="list-header">
            <div>
              <h3>Nuovo cliente</h3>
            </div>
          </div>
          <CustomerCreateForm
            action={createCustomerAction}
            typeOptions={Object.entries(customerTypeLabels).map(([value, label]) => ({ value, label }))}
          />
        </section>

        <section className="card card-pad customers-directory-card">
          <details className="customers-directory-disclosure" open={filters.type !== "ALL"}>
            <summary className="customers-directory-summary">
              <div className="customers-directory-summary-copy">
                <strong>Archivio clienti</strong>
                <span>Apri solo quando ti serve</span>
              </div>
              <div className="customers-directory-summary-aside">
                <span className="pill">{customers.length} clienti</span>
                <span aria-hidden="true" className="customers-directory-summary-chevron" />
              </div>
            </summary>

            <div className="customers-directory-body">
              <nav className="customers-type-switch" aria-label="Filtro tipo cliente">
                {typeTabs.map((tab) => (
                  <Link
                    className={`customers-type-link${filters.type === tab.key ? " active" : ""}`}
                    href={tab.href}
                    key={tab.key}
                    prefetch={false}
                  >
                    {tab.label}
                  </Link>
                ))}
              </nav>

              <CustomersDirectory customers={customers} />
            </div>
          </details>
        </section>
      </div>
    </div>
  );
}
