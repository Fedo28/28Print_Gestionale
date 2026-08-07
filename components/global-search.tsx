"use client";

import { startTransition, useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { GlobalSearchSection } from "@/lib/global-search";

type SearchResponse = {
  sections: GlobalSearchSection[];
};

type SearchScope = "records" | "catalog";
type FocusedSearch = SearchScope | null;

function useScopedSearch(query: string, scope: SearchScope) {
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sections, setSections] = useState<GlobalSearchSection[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setDebouncedQuery("");
      setSections([]);
      setIsLoading(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 140);

    return () => window.clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    const normalizedQuery = debouncedQuery.trim();
    if (normalizedQuery.length < 2) {
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    fetch(`/api/search?q=${encodeURIComponent(normalizedQuery)}&scope=${scope}`, {
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
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [debouncedQuery, scope]);

  return { isLoading, sections };
}

export function GlobalSearch({
  autoFocus = false,
  onNavigate,
  variant = "desktop"
}: {
  autoFocus?: boolean;
  onNavigate?: () => void;
  variant?: "desktop" | "mobile-sheet";
}) {
  const recordsInputId = useId();
  const catalogInputId = useId();
  const pathname = usePathname();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const recordsInputRef = useRef<HTMLInputElement>(null);
  const catalogInputRef = useRef<HTMLInputElement>(null);
  const [recordsQuery, setRecordsQuery] = useState("");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [focusedSearch, setFocusedSearch] = useState<FocusedSearch>(null);
  const [shortcutLabel, setShortcutLabel] = useState("Ctrl");
  const recordsSearch = useScopedSearch(recordsQuery, "records");
  const catalogSearch = useScopedSearch(catalogQuery, "catalog");

  useEffect(() => {
    setRecordsQuery("");
    setCatalogQuery("");
    setFocusedSearch(null);
  }, [pathname]);

  useEffect(() => {
    if (!autoFocus) {
      return;
    }

    const focusHandle = window.requestAnimationFrame(() => {
      recordsInputRef.current?.focus();
      setFocusedSearch("records");
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
        recordsInputRef.current?.focus();
        setFocusedSearch("records");
      }

      if (event.key === "Escape") {
        setFocusedSearch(null);
        recordsInputRef.current?.blur();
        catalogInputRef.current?.blur();
      }
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setFocusedSearch(null);
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
    for (const item of recordsSearch.sections.flatMap((section) => section.items).slice(0, 6)) {
      router.prefetch(item.href);
    }
  }, [recordsSearch.sections, router]);

  const recordsTotal = recordsSearch.sections.reduce((sum, section) => sum + section.items.length, 0);
  const catalogTotal = catalogSearch.sections.reduce((sum, section) => sum + section.items.length, 0);
  const recordsPanelClass = `global-search-panel${variant === "mobile-sheet" ? " global-search-panel-mobile" : ""}`;
  const catalogPanelClass = `${recordsPanelClass} global-search-panel-catalog`;

  function navigateTo(href: string) {
    startTransition(() => {
      router.push(href);
    });
    setFocusedSearch(null);
    onNavigate?.();
  }

  return (
    <div className={`global-search global-search-${variant}`} ref={containerRef}>
      <div className="global-search-grid">
        <div className="global-search-column global-search-column-records">
          <form
            className={`global-search-form${variant === "mobile-sheet" ? " global-search-form-mobile" : ""}`}
            onSubmit={(event) => {
              event.preventDefault();
              const normalizedQuery = recordsQuery.trim();
              if (!normalizedQuery) {
                return;
              }

              const firstResult = recordsSearch.sections.flatMap((section) => section.items)[0];
              navigateTo(firstResult?.href || `/orders?q=${encodeURIComponent(normalizedQuery)}`);
            }}
          >
            <label className="global-search-label" htmlFor={recordsInputId}>
              Clienti e ordini
            </label>
            <div className="global-search-field-shell">
              <SearchGlyph />
              <input
                aria-keyshortcuts={variant === "desktop" ? "Control+K Meta+K" : undefined}
                autoComplete="off"
                id={recordsInputId}
                onChange={(event) => setRecordsQuery(event.target.value)}
                onFocus={() => setFocusedSearch("records")}
                placeholder={`Cerca cliente o ordine (${shortcutLabel}+K)`}
                ref={recordsInputRef}
                spellCheck={false}
                value={recordsQuery}
              />
              {recordsQuery ? (
                <ClearButton
                  label="Pulisci ricerca clienti e ordini"
                  onClear={() => {
                    setRecordsQuery("");
                    recordsInputRef.current?.focus();
                  }}
                />
              ) : null}
            </div>
          </form>

          <SearchMeta isLoading={recordsSearch.isLoading} query={recordsQuery} total={recordsTotal} />

          {focusedSearch === "records" && recordsQuery.trim().length > 0 ? (
            <div className={recordsPanelClass}>
              {recordsQuery.trim().length < 2 ? null : recordsTotal === 0 && !recordsSearch.isLoading ? (
                <div className="mini-item global-search-empty">
                  <strong>Nessun risultato</strong>
                </div>
              ) : (
                recordsSearch.sections.map((section) => (
                  <div className="global-search-section" key={section.key}>
                    <div className="global-search-section-title">{section.label}</div>
                    <div className="global-search-results">
                      {section.items.map((item) => (
                        <button
                          className="global-search-result"
                          key={`${section.key}-${item.id}`}
                          onClick={() => navigateTo(item.href)}
                          onFocus={() => router.prefetch(item.href)}
                          onMouseDown={(event) => event.preventDefault()}
                          onMouseEnter={() => router.prefetch(item.href)}
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

        <div className="global-search-column global-search-column-catalog">
          <form
            className={`global-search-form${variant === "mobile-sheet" ? " global-search-form-mobile" : ""}`}
            onSubmit={(event) => event.preventDefault()}
          >
            <label className="global-search-label" htmlFor={catalogInputId}>
              Catalogo materiali
            </label>
            <div className="global-search-field-shell global-search-field-shell-catalog">
              <SearchGlyph />
              <input
                autoComplete="off"
                id={catalogInputId}
                onChange={(event) => setCatalogQuery(event.target.value)}
                onFocus={() => setFocusedSearch("catalog")}
                placeholder="Cerca materiale e prezzo"
                ref={catalogInputRef}
                spellCheck={false}
                value={catalogQuery}
              />
              {catalogQuery ? (
                <ClearButton
                  label="Pulisci ricerca catalogo"
                  onClear={() => {
                    setCatalogQuery("");
                    catalogInputRef.current?.focus();
                  }}
                />
              ) : null}
            </div>
          </form>

          <SearchMeta isLoading={catalogSearch.isLoading} query={catalogQuery} total={catalogTotal} />

          {focusedSearch === "catalog" && catalogQuery.trim().length > 0 ? (
            <div className={catalogPanelClass}>
              {catalogQuery.trim().length < 2 ? null : catalogTotal === 0 && !catalogSearch.isLoading ? (
                <div className="mini-item global-search-empty">
                  <strong>Nessun materiale</strong>
                </div>
              ) : (
                catalogSearch.sections.map((section) => (
                  <div className="global-search-section" key={section.key}>
                    <div className="global-search-section-title">{section.label}</div>
                    <div className="global-search-results" role="list">
                      {section.items.map((item) => (
                        <div
                          className="global-search-result global-search-result-static"
                          key={`${section.key}-${item.id}`}
                          role="listitem"
                        >
                          <strong>{item.label}</strong>
                          <span>{item.meta}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SearchGlyph() {
  return (
    <svg aria-hidden="true" className="glyph global-search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 0 0-15a7.5 7.5 0 0 0 0 15Z" />
    </svg>
  );
}

function ClearButton({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button aria-label={label} className="global-search-clear" onClick={onClear} type="button">
      <span />
      <span />
    </button>
  );
}

function SearchMeta({ isLoading, query, total }: { isLoading: boolean; query: string; total: number }) {
  if (query.trim().length < 2) {
    return null;
  }

  return (
    <div aria-live="polite" className="global-search-meta">
      <span className="subtle">{isLoading ? "Ricerca in corso..." : `${total} risultati`}</span>
    </div>
  );
}
