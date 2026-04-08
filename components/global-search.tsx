"use client";

import { useDeferredValue, useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { GlobalSearchSection } from "@/lib/global-search";

type SearchResponse = {
  sections: GlobalSearchSection[];
};

export function GlobalSearch() {
  const inputId = useId();
  const pathname = usePathname();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [sections, setSections] = useState<GlobalSearchSection[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [shortcutLabel, setShortcutLabel] = useState("Ctrl");
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    setQuery("");
    setSections([]);
    setIsFocused(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof navigator !== "undefined" && /mac/i.test(navigator.platform)) {
      setShortcutLabel("Cmd");
    }
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }

      if (event.key === "Escape") {
        setIsFocused(false);
        inputRef.current?.blur();
      }
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    const normalizedQuery = deferredQuery.trim();
    if (normalizedQuery.length < 2) {
      setSections([]);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    fetch(`/api/search?q=${encodeURIComponent(normalizedQuery)}`, {
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || "Ricerca globale non disponibile.");
        }

        return response.json() as Promise<SearchResponse>;
      })
      .then((payload) => {
        setSections(payload.sections);
      })
      .catch((error) => {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        setSections([]);
      })
      .finally(() => {
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [deferredQuery]);

  const totalResults = sections.reduce((sum, section) => sum + section.items.length, 0);
  const showPanel = isFocused && query.trim().length > 0;

  return (
    <div className="global-search" ref={containerRef}>
      <form
        className="global-search-form"
        onSubmit={(event) => {
          event.preventDefault();
          const normalizedQuery = query.trim();
          if (!normalizedQuery) {
            return;
          }

          const firstResult = sections[0]?.items[0];
          router.push(firstResult?.href || `/orders?q=${encodeURIComponent(normalizedQuery)}`);
          setIsFocused(false);
        }}
      >
        <label className="global-search-label" htmlFor={inputId}>
          Ricerca globale
        </label>
        <div className="global-search-field-shell">
          <svg aria-hidden="true" className="glyph global-search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
            <path d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 0 0-15a7.5 7.5 0 0 0 0 15Z" />
          </svg>
          <input
            autoComplete="off"
            id={inputId}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setIsFocused(true)}
            placeholder="Cerca ordini, clienti, preventivi, cartelloni o catalogo"
            ref={inputRef}
            spellCheck={false}
            value={query}
          />
          {query ? (
            <button
              aria-label="Pulisci ricerca"
              className="global-search-clear"
              onClick={() => {
                setQuery("");
                setSections([]);
                inputRef.current?.focus();
              }}
              type="button"
            >
              <span />
              <span />
            </button>
          ) : null}
        </div>
      </form>

      <div className="global-search-meta">
        <span className="subtle">Comando rapido: {shortcutLabel} + K</span>
        {query.trim().length >= 2 ? (
          <span className="subtle">
            {isLoading ? "Ricerca in corso..." : `${totalResults} risultati`}
          </span>
        ) : null}
      </div>

      {showPanel ? (
        <div className="global-search-panel">
          {query.trim().length < 2 ? (
            <div className="mini-item">
              <strong>Inizia a scrivere</strong>
              <div className="subtle">Ti suggerisco risultati appena arrivi a 2 caratteri.</div>
            </div>
          ) : totalResults === 0 && !isLoading ? (
            <div className="mini-item">
              <strong>Nessun risultato</strong>
              <div className="subtle">Prova con codice ordine, nome cliente, servizio o impianto.</div>
            </div>
          ) : (
            sections.map((section) => (
              <div className="global-search-section" key={section.key}>
                <div className="global-search-section-title">{section.label}</div>
                <div className="global-search-results">
                  {section.items.map((item) => (
                    <button
                      className="global-search-result"
                      key={`${section.key}-${item.id}`}
                      onClick={() => {
                        router.push(item.href);
                        setIsFocused(false);
                      }}
                      onMouseDown={(event) => event.preventDefault()}
                      type="button"
                    >
                      <strong>{item.label}</strong>
                      <span>{item.meta}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
