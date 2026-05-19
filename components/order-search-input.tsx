"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SearchRequestParams = Record<string, string | undefined>;

type OrderSearchSuggestion = {
  id: string;
  label: string;
  meta: string;
  href: string;
};

type SearchResponse = {
  items: OrderSearchSuggestion[];
};

type OrderSearchInputProps = {
  name: string;
  ariaLabel: string;
  placeholder: string;
  initialValue?: string;
  scope: "orders" | "quotes";
  requestParams?: SearchRequestParams;
};

export function OrderSearchInput({
  name,
  ariaLabel,
  placeholder,
  initialValue = "",
  scope,
  requestParams
}: OrderSearchInputProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initialValue);
  const [debouncedQuery, setDebouncedQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<OrderSearchSuggestion[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setQuery(initialValue);
    setDebouncedQuery(initialValue);
    setSuggestions([]);
  }, [initialValue]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 140);

    return () => window.clearTimeout(timeoutId);
  }, [query]);

  const requestQueryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("scope", scope);

    for (const [key, value] of Object.entries(requestParams || {})) {
      if (value?.trim()) {
        params.set(key, value);
      }
    }

    return params.toString();
  }, [requestParams, scope]);

  useEffect(() => {
    const normalizedQuery = debouncedQuery.trim();

    if (normalizedQuery.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    fetch(`/api/order-search?${requestQueryString}&q=${encodeURIComponent(normalizedQuery)}`, {
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || "Suggerimenti non disponibili.");
        }

        return response.json() as Promise<SearchResponse>;
      })
      .then((payload) => {
        setSuggestions(payload.items);
      })
      .catch((error) => {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        setSuggestions([]);
      })
      .finally(() => {
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [debouncedQuery, requestQueryString]);

  const showSuggestions = isFocused && query.trim().length > 0;

  function handleNavigate(href: string) {
    startTransition(() => {
      router.push(href);
    });
    setIsFocused(false);
  }

  return (
    <div className="filters-search-field">
      <input
        aria-label={ariaLabel}
        autoComplete="off"
        name={name}
        onBlur={() => {
          window.setTimeout(() => setIsFocused(false), 120);
        }}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setIsFocused(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setIsFocused(false);
            inputRef.current?.blur();
          }
        }}
        placeholder={placeholder}
        ref={inputRef}
        spellCheck={false}
        value={query}
      />

      {showSuggestions ? (
        <div className="filters-search-suggestions" aria-label="Suggerimenti ricerca">
          {query.trim().length < 2 ? (
            <div className="mini-item filters-search-empty">
              <p className="subtle">Scrivi almeno 2 caratteri e ti suggerisco subito i record piu vicini.</p>
            </div>
          ) : isLoading ? (
            <div className="mini-item filters-search-empty">
              <p className="subtle">Sto cercando anche con maiuscole, minuscole e scritte non perfette.</p>
            </div>
          ) : suggestions.length > 0 ? (
            <>
              <div className="filters-search-meta">
                <span className="subtle">{suggestions.length} suggerimenti rapidi</span>
                <span className="subtle">Invio o Cerca filtrano la lista, un click apre la scheda</span>
              </div>
              {suggestions.map((item) => (
                <button
                  className="filters-search-suggestion"
                  key={item.id}
                  onClick={() => handleNavigate(item.href)}
                  onMouseDown={(event) => event.preventDefault()}
                  type="button"
                >
                  <strong>{item.label}</strong>
                  <span>{item.meta}</span>
                </button>
              ))}
            </>
          ) : (
            <div className="mini-item filters-search-empty">
              <p className="subtle">Nessun suggerimento trovato. Prova con una parte del codice, del cliente o del telefono.</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
