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
    <div className="stack">
      <CustomerAutocomplete
        customers={customers.map((customer) => ({
          ...customer,
          orderCount: customer.orders.length
        }))}
        helperText="Cerca per nome, telefono, email, codice fiscale o partita IVA."
        label="Cerca cliente"
        onQueryChange={(value) => {
          setQuery(value);
          setHighlightedCustomerId(null);
        }}
        onSelect={(customer) => {
          setQuery(customer.name);
          setHighlightedCustomerId(customer.id);
        }}
        placeholder="Es. Rossi, +39 333..., info@azienda.it, IT123..."
        query={query}
        selectedCustomerId={highlightedCustomerId}
      />

      <div className="mini-list">
        {visibleCustomers.length === 0 ? (
          <div className="empty">Nessun cliente corrisponde a questa ricerca.</div>
        ) : (
          visibleCustomers.map((customer) => (
            <article
              className={`mini-item customer-directory-item${highlightedCustomerId === customer.id ? " customer-directory-item-highlighted" : ""}`}
              key={customer.id}
            >
              <div className="list-header">
                <Link href={`/customers/${customer.id}`}>
                  <strong>{customer.name}</strong>
                </Link>
                <span className="pill">{customerTypeLabels[customer.type]}</span>
              </div>
              <div className="subtle">{customer.orders.length} ordini</div>
              <div className="subtle">{customer.phone}</div>
              <div className="subtle">{customer.email || customer.whatsapp || "Nessun contatto secondario"}</div>
              <div className="subtle">Ultimo ordine: {customer.orders[0] ? formatDate(customer.orders[0].createdAt) : "Nessuno"}</div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
