"use client";

import { useDeferredValue, useState } from "react";
import { updateServiceAction } from "@/app/actions";
import { formatCurrency } from "@/lib/format";
import { formatServiceUnitPriceLabel, serviceUnitOptions, type ServiceUnitValue } from "@/lib/service-units";

type CatalogServiceSearchProps = {
  services: Array<{
    id: string;
    code: string | null;
    name: string;
    description: string | null;
    basePriceCents: number;
    unit: ServiceUnitValue;
    quantityTiers: string | null;
    active: boolean;
  }>;
};

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function buildSearchHaystack(service: CatalogServiceSearchProps["services"][number]) {
  return normalizeSearchValue(
    [
      service.code || "",
      service.name,
      service.description || "",
      formatServiceUnitPriceLabel(service.unit),
      service.unit,
      service.quantityTiers || "",
      service.active ? "attivo" : "disattivato"
    ].join(" ")
  );
}

function getSearchScore(service: CatalogServiceSearchProps["services"][number], normalizedQuery: string) {
  const haystack = buildSearchHaystack(service);
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);

  if (!terms.length || !terms.every((term) => haystack.includes(term))) {
    return Number.MAX_SAFE_INTEGER;
  }

  const normalizedCode = normalizeSearchValue(service.code || "");
  const normalizedName = normalizeSearchValue(service.name);
  const normalizedDescription = normalizeSearchValue(service.description || "");

  if (normalizedCode === normalizedQuery) {
    return 0;
  }

  if (normalizedName === normalizedQuery) {
    return 1;
  }

  if (normalizedCode.startsWith(normalizedQuery)) {
    return 2;
  }

  if (normalizedName.startsWith(normalizedQuery)) {
    return 3;
  }

  if (normalizedDescription.startsWith(normalizedQuery)) {
    return 4;
  }

  if (normalizedCode.includes(normalizedQuery)) {
    return 5;
  }

  if (normalizedName.includes(normalizedQuery)) {
    return 6;
  }

  return 7;
}

function ServiceResultCard({ service }: { service: CatalogServiceSearchProps["services"][number] }) {
  return (
    <article className={`mini-item service-admin-item${service.active ? "" : " service-admin-item-muted"}`}>
      <form action={updateServiceAction} className="form-grid">
        <input name="id" type="hidden" value={service.id} />
        <div className="field service-admin-code">
          <label htmlFor={`service-code-${service.id}`}>Codice</label>
          <input defaultValue={service.code || ""} id={`service-code-${service.id}`} name="code" required />
        </div>
        <div className="field wide service-admin-name">
          <label htmlFor={`service-name-${service.id}`}>Nome</label>
          <input defaultValue={service.name} id={`service-name-${service.id}`} name="name" required />
        </div>
        <div className="field service-admin-price">
          <label htmlFor={`service-price-${service.id}`}>Prezzo base</label>
          <input
            defaultValue={(service.basePriceCents / 100).toFixed(2).replace(".", ",")}
            id={`service-price-${service.id}`}
            name="basePrice"
            required
          />
        </div>
        <div className="field service-admin-price">
          <label htmlFor={`service-unit-${service.id}`}>Unita</label>
          <select defaultValue={service.unit} id={`service-unit-${service.id}`} name="unit">
            {serviceUnitOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field full service-admin-description">
          <label htmlFor={`service-description-${service.id}`}>Descrizione</label>
          <textarea defaultValue={service.description || ""} id={`service-description-${service.id}`} name="description" />
        </div>
        <div className="field full service-admin-tiers">
          <label htmlFor={`service-tiers-${service.id}`}>Scaglioni quantita</label>
          <input
            defaultValue={service.quantityTiers || ""}
            id={`service-tiers-${service.id}`}
            name="quantityTiers"
            placeholder="1-9:0,50 | 10-49:0,30 | 50+:0,20"
          />
        </div>
        <div className="field service-admin-toggle">
          <label className="toggle-field" htmlFor={`service-active-${service.id}`}>
            <input defaultChecked={service.active} id={`service-active-${service.id}`} name="active" type="checkbox" />
            <span>{service.active ? "Attivo" : "Disattivato"}</span>
          </label>
        </div>
        <div className="button-row service-admin-actions">
          <span className="subtle">
            {formatCurrency(service.basePriceCents)} • {formatServiceUnitPriceLabel(service.unit)}
          </span>
          <button className="secondary" type="submit">
            Salva servizio
          </button>
        </div>
      </form>
    </article>
  );
}

export function CatalogServiceSearch({ services }: CatalogServiceSearchProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = normalizeSearchValue(deferredQuery);

  const rankedResults = normalizedQuery
    ? services
        .map((service) => ({
          service,
          score: getSearchScore(service, normalizedQuery)
        }))
        .filter((entry) => entry.score !== Number.MAX_SAFE_INTEGER)
        .sort(
          (left, right) =>
            left.score - right.score ||
            left.service.name.localeCompare(right.service.name, "it") ||
            (left.service.code || "").localeCompare(right.service.code || "", "it")
        )
        .map((entry) => entry.service)
    : [];

  const suggestionResults = rankedResults.slice(0, 6);
  const visibleResults = rankedResults.slice(0, 12);

  return (
    <div className="stack settings-existing-services">
      <div className="list-header">
        <div>
          <h4>Servizi presenti</h4>
          <p className="card-muted">Scrivi liberamente codice, nome, descrizione o scaglioni: i risultati qui sotto restano modificabili, incluso il nome del servizio.</p>
        </div>
      </div>

      <div className="mini-item settings-catalog-search-shell">
        <div className="field full settings-catalog-search-field">
          <label htmlFor="catalog-service-search">Cerca nel catalogo</label>
          <input
            autoComplete="off"
            id="catalog-service-search"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setQuery("");
              }
            }}
            placeholder="Scrivi qui: biglietti, manifesto 70x100, PVC, 1-20:0,50"
            spellCheck={false}
            type="search"
            value={query}
          />
          <div className="settings-catalog-search-meta">
            <span className="subtle">{services.length} servizi disponibili</span>
            {normalizedQuery ? <span className="subtle">{rankedResults.length} risultati trovati</span> : null}
          </div>
        </div>

        {normalizedQuery ? (
          <>
            {suggestionResults.length ? (
              <div className="settings-catalog-suggestions" aria-label="Suggerimenti catalogo">
                {suggestionResults.map((service) => (
                  <button
                    className="settings-catalog-suggestion"
                    key={`suggestion-${service.id}`}
                    onClick={() => setQuery(service.name)}
                    type="button"
                  >
                    <span className="settings-catalog-suggestion-name">{service.name}</span>
                    <span className="settings-catalog-suggestion-meta">
                      {service.code || "Senza codice"} • {formatCurrency(service.basePriceCents)} • {formatServiceUnitPriceLabel(service.unit)}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            {visibleResults.length ? (
              <div className="mini-list">
                {visibleResults.map((service) => (
                  <ServiceResultCard key={service.id} service={service} />
                ))}
              </div>
            ) : (
              <div className="mini-item settings-catalog-search-empty">
                <p className="subtle">Nessun servizio trovato con questa ricerca. Prova con una parte del nome, il codice o il formato.</p>
              </div>
            )}

            {rankedResults.length > visibleResults.length ? (
              <p className="hint">Sto mostrando i primi {visibleResults.length} risultati. Restringi la ricerca per vedere una selezione piu precisa.</p>
            ) : null}
          </>
        ) : (
          <div className="mini-item settings-catalog-search-empty">
            <p className="subtle">Il catalogo completo non viene mostrato qui sotto. Inizia a digitare e ti suggerisco subito i servizi piu vicini a quello che stai cercando.</p>
          </div>
        )}
      </div>
    </div>
  );
}
