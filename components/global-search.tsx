"use client";

import { startTransition, useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { GlobalSearchSection } from "@/lib/global-search";

type SearchResponse = {
  sections: GlobalSearchSection[];
};

export function GlobalSearch({
  autoFocus = false,
  onNavigate,
  variant = "desktop"
}: {
  autoFocus?: boolean;
  onNavigate?: () => void;
  variant?: "desktop" | "mobile-sheet";
}) {
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
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    setQuery("");
    setDebouncedQuery("");
    setSections([]);
    setIsFocused(false);
  }, [pathname]);

  useEffect(() => {
    if (!autoFocus) {
      return;
    }

    const focusHandle = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      setIsFocused(true);
    });

    return () => window.cancelAnimationFrame(focusHandle);
  }, [autoFocus]);

  useEffect(() => {
    if (typeof navigator !== "undefined" && /mac/i.test(navigator.platform)) {
      setShortcutLabel("Cmd");
    }
  }, []);

  useEffect(() => {
    if (variant !== "desktop") {
      return;
    }

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
  }, [variant]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 140);

    return () => window.clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    const normalizedQuery = debouncedQuery.trim();
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
  }, [debouncedQuery]);

  useEffect(() => {
    for (const item of sections.flatMap((section) => section.items).slice(0, 6)) {
      router.prefetch(item.href);
    }
  }, [router, sections]);

  const totalResults = sections.reduce((sum, section) => sum + section.items.length, 0);
  const showPanel = variant === "mobile-sheet" ? true : isFocused && query.trim().length > 0;

  function navigateTo(href: string) {
    startTransition(() => {
      router.push(href);
    });
    setIsFocused(false);
    onNavigate?.();
  }

  return (
    <div className={`global-search global-search-${variant}`} ref={containerRef}>
      <form
        className={`global-search-form${variant === "mobile-sheet" ? " global-search-form-mobile" : ""}`}
        onSubmit={(event) => {
          event.preventDefault();
          const normalizedQuery = query.trim();
          if (!normalizedQuery) {
            return;
          }

          const firstResult = sections[0]?.items[0];
          navigateTo(firstResult?.href || `/orders?q=${encodeURIComponent(normalizedQuery)}`);
        }}
      >
        {variant === "desktop" ? (
          <label className="global-search-label" htmlFor={inputId}>
            Ricerca globale
          </label>
        ) : null}
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
        {variant === "desktop" ? <span className="subtle">Comando rapido: {shortcutLabel} + K</span> : null}
        {variant === "mobile-sheet" && query.trim().length < 2 ? (
          <span className="subtle">Scrivi almeno 2 caratteri per vedere i risultati.</span>
        ) : null}
        {query.trim().length >= 2 ? (
          <span className="subtle">
            {isLoading ? "Ricerca in corso..." : `${totalResults} risultati`}
          </span>
        ) : null}
      </div>

      {showPanel ? (
        <div className={`global-search-panel${variant === "mobile-sheet" ? " global-search-panel-mobile" : ""}`}>
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
                      onClick={() => navigateTo(item.href)}
                      onMouseEnter={() => router.prefetch(item.href)}
                      onMouseDown={(event) => event.preventDefault()}
                      onFocus={() => router.prefetch(item.href)}
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
