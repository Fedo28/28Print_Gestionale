"use client";

import { useDeferredValue, useState } from "react";
import { updateServiceAction } from "@/app/actions";
import { normalizeCatalogServiceSearchValue, rankCatalogServices } from "@/lib/catalog-search";
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
  const normalizedQuery = normalizeCatalogServiceSearchValue(deferredQuery);

  const rankedResults = normalizedQuery ? rankCatalogServices(services, normalizedQuery) : [];

  const suggestionResults = rankedResults.slice(0, 6);
  const visibleResults = rankedResults.slice(0, 12);

  return (
    <div className="stack settings-existing-services">
      <div className="list-header">
        <div>
          <h4>Servizi presenti</h4>
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
          {normalizedQuery ? (
            <div className="settings-catalog-search-meta">
              <span className="subtle">{rankedResults.length} risultati trovati</span>
            </div>
          ) : null}
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
                    <span className="settings-catalog-suggestion-meta">{formatCurrency(service.basePriceCents)}</span>
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
                <p className="subtle">Nessun servizio trovato.</p>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
