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
        placeholder="Es. Rossi, +39 333..., info@azienda.it, pec@azienda.it, IT123..."
        query={query}
        selectedCustomerId={highlightedCustomerId}
      />

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

            return (
              <article
                className={`mini-item customer-directory-item${highlightedCustomerId === customer.id ? " customer-directory-item-highlighted" : ""}`}
                key={customer.id}
              >
                <Link className="customer-directory-link" href={`/customers/${customer.id}`} prefetch={false}>
                  <div className="customer-directory-head">
                    <div className="customer-directory-title">
                      <strong>{customer.name}</strong>
                      <span>{customerTypeLabels[customer.type]}</span>
                    </div>
                    <span className="pill">{customer.orders.length} ordini</span>
                  </div>

                  <div className="customer-directory-meta-grid">
                    <div className="customer-directory-stat">
                      <span>Ultimo ordine</span>
                      <strong>{customer.orders[0] ? formatDate(customer.orders[0].createdAt) : "Nessuno"}</strong>
                    </div>
                    <div className="customer-directory-stat">
                      <span>Contatti</span>
                      <strong>{contactChips.length > 0 ? contactChips.length : "Nessuno"}</strong>
                    </div>
                  </div>

                  <div className="customer-directory-contact-row">
                    {contactChips.length > 0 ? (
                      contactChips.slice(0, 3).map((entry) => (
                        <span className="customer-directory-contact-chip" key={entry}>
                          {entry}
                        </span>
                      ))
                    ) : (
                      <span className="customer-directory-contact-chip is-muted">Nessun contatto rapido</span>
                    )}
                  </div>
                </Link>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
