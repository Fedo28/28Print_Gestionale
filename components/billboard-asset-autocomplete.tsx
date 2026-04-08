"use client";

import { BillboardAssetKind } from "@prisma/client";
import { useDeferredValue, useId, useState } from "react";
import { rankBillboardAssets } from "@/lib/billboard-asset-search";
import { billboardAssetKindLabels } from "@/lib/constants";

export type BillboardAssetAutocompleteOption = {
  id: string;
  code: string;
  name: string;
  kind: BillboardAssetKind;
  location?: string | null;
};

type BillboardAssetAutocompleteProps = {
  assets: BillboardAssetAutocompleteOption[];
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (asset: BillboardAssetAutocompleteOption) => void;
  label: string;
  placeholder: string;
  helperText?: string;
  selectedAssetId?: string | null;
  emptyMessage?: string;
  maxSuggestions?: number;
};

export function BillboardAssetAutocomplete({
  assets,
  query,
  onQueryChange,
  onSelect,
  label,
  placeholder,
  helperText,
  selectedAssetId,
  emptyMessage = "Nessun impianto trovato. Prova con nome, codice o luogo.",
  maxSuggestions = 6
}: BillboardAssetAutocompleteProps) {
  const [isFocused, setIsFocused] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const inputId = useId();
  const rankedResults = deferredQuery.trim() ? rankBillboardAssets(assets, deferredQuery) : assets;
  const suggestionResults = rankedResults.slice(0, maxSuggestions);
  const selectedAsset = selectedAssetId ? assets.find((asset) => asset.id === selectedAssetId) : null;
  const showSuggestions = isFocused && (deferredQuery.trim().length > 0 || !selectedAsset);

  return (
    <div className="field full asset-autocomplete-field">
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
      <div className="asset-autocomplete-meta">
        <span className="subtle">{assets.length} impianti disponibili</span>
        {deferredQuery.trim() ? <span className="subtle">{rankedResults.length} risultati trovati</span> : null}
      </div>
      {helperText ? <p className="hint asset-autocomplete-hint">{helperText}</p> : null}

      {showSuggestions ? (
        suggestionResults.length > 0 ? (
          <div className="asset-autocomplete-suggestions" aria-label="Suggerimenti impianti">
            {suggestionResults.map((asset) => (
              <button
                className={`asset-autocomplete-suggestion${selectedAsset?.id === asset.id ? " is-selected" : ""}`}
                key={asset.id}
                onClick={() => {
                  onSelect(asset);
                  setIsFocused(false);
                }}
                onMouseDown={(event) => event.preventDefault()}
                type="button"
              >
                <strong>{asset.name}</strong>
                <span>
                  {asset.code}
                  {asset.location ? ` • ${asset.location}` : " • Luogo da definire"}
                </span>
                <span>{billboardAssetKindLabels[asset.kind]}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mini-item asset-autocomplete-empty">
            <p className="subtle">{emptyMessage}</p>
          </div>
        )
      ) : null}
    </div>
  );
}
