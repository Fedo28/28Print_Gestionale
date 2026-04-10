"use client";

import { CustomerType } from "@prisma/client";
import { useDeferredValue, useId, useState } from "react";
import { customerTypeLabels } from "@/lib/constants";
import { rankCustomers } from "@/lib/customer-search";

export type CustomerAutocompleteOption = {
  id: string;
  name: string;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  pec?: string | null;
  taxCode?: string | null;
  vatNumber?: string | null;
  uniqueCode?: string | null;
  type: CustomerType;
  orderCount?: number;
};

type CustomerAutocompleteProps = {
  customers: CustomerAutocompleteOption[];
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (customer: CustomerAutocompleteOption) => void;
  label: string;
  placeholder: string;
  helperText?: string;
  selectedCustomerId?: string | null;
  emptyMessage?: string;
  maxSuggestions?: number;
};

export function CustomerAutocomplete({
  customers,
  query,
  onQueryChange,
  onSelect,
  label,
  placeholder,
  helperText,
  selectedCustomerId,
  emptyMessage = "Nessun cliente trovato. Continua a scrivere o inseriscilo come nuovo.",
  maxSuggestions = 6
}: CustomerAutocompleteProps) {
  const [isFocused, setIsFocused] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const inputId = useId();
  const normalizedResults = rankCustomers(customers, deferredQuery);
  const suggestionResults = normalizedResults.slice(0, maxSuggestions);
  const selectedCustomer = selectedCustomerId ? customers.find((customer) => customer.id === selectedCustomerId) : null;
  const showSuggestions = isFocused && deferredQuery.trim().length > 0;

  return (
    <div className="field full customer-autocomplete-field">
      <label htmlFor={inputId}>{label}</label>
      <input
        autoComplete="off"
        id={inputId}
        onBlur={() => {
          window.setTimeout(() => setIsFocused(false), 120);
        }}
        onChange={(event) => onQueryChange(event.target.value)}
        onFocus={() => setIsFocused(true)}
        placeholder={placeholder}
        spellCheck={false}
        value={query}
      />
      <div className="customer-autocomplete-meta">
        <span className="subtle">{customers.length} clienti disponibili</span>
        {deferredQuery.trim() ? <span className="subtle">{normalizedResults.length} risultati trovati</span> : null}
      </div>
      {helperText ? <p className="hint customer-autocomplete-hint">{helperText}</p> : null}

      {showSuggestions ? (
        suggestionResults.length > 0 ? (
          <div className="customer-autocomplete-suggestions" aria-label="Suggerimenti clienti">
            {suggestionResults.map((customer) => (
              <button
                className={`customer-autocomplete-suggestion${selectedCustomer?.id === customer.id ? " is-selected" : ""}`}
                key={customer.id}
                onClick={() => {
                  onSelect(customer);
                  setIsFocused(false);
                }}
                onMouseDown={(event) => event.preventDefault()}
                type="button"
              >
                <strong>{customer.name}</strong>
                <span>
                  {[customer.phone, customer.email].filter(Boolean).join(" • ") || "Nessun contatto rapido"}
                </span>
                <span>
                  {customerTypeLabels[customer.type]}
                  {typeof customer.orderCount === "number" ? ` • ${customer.orderCount} ordini` : ""}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mini-item customer-autocomplete-empty">
            <p className="subtle">{emptyMessage}</p>
          </div>
        )
      ) : null}
    </div>
  );
}
