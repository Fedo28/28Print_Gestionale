"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { updateOrderCustomerAction } from "@/app/actions";

type CustomerResult = {
  id: string;
  label: string;
  meta: string;
};

type SearchResponse = {
  sections?: Array<{
    key: string;
    items: CustomerResult[];
  }>;
};

export function OrderCustomerSwitchForm({
  currentCustomerId,
  currentCustomerName,
  orderId,
  returnTo
}: {
  currentCustomerId: string;
  currentCustomerName: string;
  orderId: string;
  returnTo: string;
}) {
  const [query, setQuery] = useState(currentCustomerName);
  const [selectedCustomerId, setSelectedCustomerId] = useState(currentCustomerId);
  const [results, setResults] = useState<CustomerResult[]>([]);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const normalizedQuery = query.trim();
  const canSearch = normalizedQuery.length >= 2;
  const hasChanged = selectedCustomerId && selectedCustomerId !== currentCustomerId;
  const showResults = isFocused && canSearch && results.length > 0;

  useEffect(() => {
    if (!canSearch) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      startTransition(() => {
        void (async () => {
        try {
          const response = await fetch(`/api/search?q=${encodeURIComponent(normalizedQuery)}&scope=records`, {
            headers: { Accept: "application/json" },
            signal: controller.signal
          });

          if (!response.ok) {
            setResults([]);
            return;
          }

          const data = (await response.json()) as SearchResponse;
          const customers = data.sections?.find((section) => section.key === "customers")?.items || [];
          setResults(customers.filter((customer) => customer.id !== currentCustomerId));
        } catch {
          if (!controller.signal.aborted) {
            setResults([]);
          }
        }
        })();
      });
    }, 160);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [canSearch, currentCustomerId, normalizedQuery]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const selectedLabel = useMemo(() => {
    if (selectedCustomerId === currentCustomerId) {
      return currentCustomerName;
    }

    return results.find((customer) => customer.id === selectedCustomerId)?.label || query;
  }, [currentCustomerId, currentCustomerName, query, results, selectedCustomerId]);

  return (
    <form
      action={updateOrderCustomerAction}
      className="form-grid order-detail-edit-form order-detail-customer-switch-form"
      onSubmit={(event) => {
        if (!hasChanged) {
          event.preventDefault();
        }
      }}
    >
      <input name="orderId" type="hidden" value={orderId} />
      <input name="customerId" type="hidden" value={selectedCustomerId} />
      <input name="returnTo" type="hidden" value={returnTo} />
      <div className="field full order-detail-customer-switch-field" ref={containerRef}>
        <label htmlFor="order-customer-switch">Cliente</label>
        <input
          autoComplete="off"
          id="order-customer-switch"
          name="customerSearch"
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedCustomerId("");
          }}
          onFocus={() => setIsFocused(true)}
          placeholder="Cerca cliente salvato"
          spellCheck={false}
          value={query}
        />
        {showResults ? (
          <div className="order-detail-customer-switch-results" role="list">
            {results.map((customer) => (
              <button
                className="order-detail-customer-switch-result"
                key={customer.id}
                onClick={() => {
                  setSelectedCustomerId(customer.id);
                  setQuery(customer.label);
                  setIsFocused(false);
                }}
                onMouseDown={(event) => event.preventDefault()}
                type="button"
              >
                <strong>{customer.label}</strong>
                <span>{customer.meta}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="button-row order-detail-submit-row">
        <button className="secondary" disabled={!hasChanged || isPending} type="submit">
          Salva cliente
        </button>
      </div>
      <input name="selectedCustomerLabel" type="hidden" value={selectedLabel} />
    </form>
  );
}
