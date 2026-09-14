"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { CustomerAutocomplete, CustomerAutocompleteOption } from "@/components/customer-autocomplete";
import { customerTypeLabels } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { rankCustomers } from "@/lib/customer-search";

type CustomerDirectoryEntry = CustomerAutocompleteOption & {
  orders: { id: string; createdAt: Date | string }[];
};

export function CustomersDirectory({ customers }: { customers: CustomerDirectoryEntry[] }) {
  const [query, setQuery] = useState("");
  const [highlightedCustomerId, setHighlightedCustomerId] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  const visibleCustomers = useMemo(() => {
    const ranked = rankCustomers(customers, deferredQuery);
    if (!deferredQuery.trim()) {
      return customers;
    }

    return ranked;
  }, [customers, deferredQuery]);

  return (
    <div className="stack customer-directory-shell">
      <CustomerAutocomplete
        customers={customers.map((customer) => ({
          ...customer,
          orderCount: customer.orders.length
        }))}
        label="Cerca cliente"
        onQueryChange={(value) => {
          setQuery(value);
          setHighlightedCustomerId(null);
        }}
        onSelect={(customer) => {
          setQuery(customer.name);
          setHighlightedCustomerId(customer.id);
        }}
        placeholder="Nome, telefono, email, P.IVA"
        query={query}
        selectedCustomerId={highlightedCustomerId}
      />

      {query.trim() ? (
        <div className="customers-directory-search-meta">
          <span className="subtle">
            {visibleCustomers.length === 1 ? "1 risultato" : `${visibleCustomers.length} risultati`}
          </span>
          <button
            className="ghost customers-directory-search-reset"
            onClick={() => {
              setQuery("");
              setHighlightedCustomerId(null);
            }}
            type="button"
          >
            Azzera ricerca
          </button>
        </div>
      ) : null}

      <div className="mini-list customer-directory-list">
        {visibleCustomers.length === 0 ? (
          <div className="empty">Nessun cliente corrisponde a questa ricerca.</div>
        ) : (
          visibleCustomers.map((customer) => {
            const contactChips = [
              customer.phone ? customer.phone : null,
              customer.whatsapp && customer.whatsapp !== customer.phone ? `WA ${customer.whatsapp}` : null,
              customer.email ? customer.email : null
            ].filter((value): value is string => Boolean(value));
            const primaryContact = contactChips[0] || null;
            const hiddenContactCount = Math.max(contactChips.length - 1, 0);
            const lastOrderLabel = customer.orders[0] ? formatDate(customer.orders[0].createdAt) : null;

            return (
              <article
                className={`mini-item customer-directory-item${highlightedCustomerId === customer.id ? " customer-directory-item-highlighted" : ""}`}
                data-customer-type={customer.type.toLowerCase()}
                key={customer.id}
              >
                <Link className="customer-directory-link" href={`/customers/${customer.id}`} prefetch={false}>
                  <div className="customer-directory-title">
                    <div className="customer-directory-name-row">
                      <strong>{customer.name}</strong>
                      <span className="customer-directory-type-badge">{customerTypeLabels[customer.type]}</span>
                    </div>
                    <div className="customer-directory-inline-meta">
                      <span>{customer.orders.length === 1 ? "1 ordine" : `${customer.orders.length} ordini`}</span>
                      <span>{lastOrderLabel ? `Ultimo ${lastOrderLabel}` : "Nessun ordine"}</span>
                    </div>
                  </div>

                  <div className="customer-directory-contact-row">
                    <span className={`customer-directory-contact-chip${primaryContact ? "" : " is-muted"}`}>
                      {primaryContact || "Nessun contatto"}
                    </span>
                    {hiddenContactCount > 0 ? (
                      <span className="customer-directory-contact-chip is-muted">+{hiddenContactCount}</span>
                    ) : null}
                  </div>

                  <span className="customer-directory-open-cue" aria-hidden="true">
                    &gt;
                  </span>
                </Link>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
