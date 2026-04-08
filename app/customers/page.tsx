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
  const activeFilters =
    filters.type !== "ALL"
      ? [
          {
            key: "type",
            label: `Tipo: ${customerTypeLabels[filters.type]}`,
            href: buildCustomersFilterHref({ type: "ALL" })
          }
        ]
      : [];

  return (
    <div className="stack">
      <PageHeader
        title="Clienti"
        description="Anagrafica, contatti, dati fiscali e storico ordini per ogni cliente."
      />

      <div className="grid grid-2">
        <section className="card card-pad">
          <div className="list-header">
            <div>
              <h3>Nuovo cliente</h3>
              <p className="card-muted">Inserimento rapido dal banco.</p>
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
              <input id="phone" name="phone" required />
            </div>
            <div className="field">
              <label htmlFor="whatsapp">WhatsApp</label>
              <input id="whatsapp" name="whatsapp" />
            </div>
            <div className="field wide">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" />
            </div>
            <div className="field">
              <label htmlFor="taxCode">Codice fiscale</label>
              <input id="taxCode" name="taxCode" />
            </div>
            <div className="field">
              <label htmlFor="vatNumber">P. IVA</label>
              <input id="vatNumber" name="vatNumber" />
            </div>
            <div className="field full">
              <label htmlFor="notes">Note</label>
              <textarea id="notes" name="notes" />
            </div>
            <div className="button-row">
              <button className="primary" type="submit">
                Salva cliente
              </button>
            </div>
          </form>
        </section>

        <section className="card card-pad">
          <div className="list-header">
            <div>
              <h3>Archivio clienti</h3>
              <p className="card-muted">{customers.length} clienti visibili.</p>
            </div>
          </div>
          <form className="toolbar filters-bar" method="get">
            <div className="filters-field">
              <select aria-label="Tipo cliente" defaultValue={filters.type} name="type">
                <option value="ALL">Tutti i clienti</option>
                {Object.entries(customerTypeLabels).map(([value, label]) => (
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
              <Link className="compact-link" href="/customers" prefetch={false}>
                Azzera tutto
              </Link>
            </div>
          ) : null}

          <CustomersDirectory customers={customers} />
        </section>
      </div>
    </div>
  );
}
