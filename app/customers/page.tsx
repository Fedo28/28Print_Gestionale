import Link from "next/link";
import { createCustomerAction } from "@/app/actions";
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
          <form action={createCustomerAction} className="form-grid">
            <div className="field wide">
              <label htmlFor="name">Nome / Ragione sociale</label>
              <input id="name" name="name" required />
            </div>
            <div className="field">
              <label htmlFor="type">Tipo cliente</label>
              <select defaultValue="PUBBLICO" id="type" name="type">
                {Object.entries(customerTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="phone">Telefono</label>
              <input id="phone" name="phone" placeholder="Facoltativo" />
            </div>
            <div className="field">
              <label htmlFor="whatsapp">WhatsApp</label>
              <input id="whatsapp" name="whatsapp" />
            </div>
            <div className="field wide">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" />
            </div>
            <div className="field wide">
              <label htmlFor="pec">PEC</label>
              <input id="pec" name="pec" type="email" />
            </div>
            <div className="field">
              <label htmlFor="vatNumber">P. IVA</label>
              <input id="vatNumber" name="vatNumber" />
            </div>
            <div className="field">
              <label htmlFor="taxCode">Codice fiscale</label>
              <input id="taxCode" name="taxCode" />
            </div>
            <div className="field">
              <label htmlFor="uniqueCode">Codice univoco (CU)</label>
              <input id="uniqueCode" name="uniqueCode" />
            </div>
            <div className="field full">
              <label htmlFor="notes">Note</label>
              <textarea id="notes" name="notes" />
            </div>
            <div className="button-row customers-entry-actions">
              <button className="primary" type="submit">
                Salva cliente
              </button>
            </div>
          </form>
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
