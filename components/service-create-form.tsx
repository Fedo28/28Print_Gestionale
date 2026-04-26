"use client";

import { useEffect, useRef, useState } from "react";
import { formatDateTime } from "@/lib/format";
import {
  buildManualFormDraftStorageKey,
  hasMeaningfulManualFormDraft,
  MANUAL_FORM_DRAFT_STORAGE_EVENT,
  parseManualFormDraftSnapshot
} from "@/lib/form-drafts";
import { serviceUnitOptions } from "@/lib/service-units";

const SERVICE_DRAFT_KEY = buildManualFormDraftStorageKey("service-create");
const SERVICE_FORM_FIELDS = ["code", "name", "basePrice", "unit", "description", "quantityTiers"] as const;

export function ServiceCreateForm({ action }: { action: (formData: FormData) => void | Promise<void> }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<string | null>(null);
  const [draftRestoredAt, setDraftRestoredAt] = useState<string | null>(null);

  function readFields() {
    const form = formRef.current;
    const formData = form ? new FormData(form) : new FormData();
    return Object.fromEntries(SERVICE_FORM_FIELDS.map((fieldName) => [fieldName, String(formData.get(fieldName) || "")])) as Record<
      (typeof SERVICE_FORM_FIELDS)[number],
      string
    >;
  }

  function applyFields(fields: Record<(typeof SERVICE_FORM_FIELDS)[number], string>) {
    const form = formRef.current;
    if (!form) {
      return;
    }

    for (const fieldName of SERVICE_FORM_FIELDS) {
      const element = form.elements.namedItem(fieldName);
      if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement
      ) {
        element.value = fields[fieldName];
      }
    }
  }

  function clearDraft(resetForm = true) {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SERVICE_DRAFT_KEY);
      window.dispatchEvent(new Event(MANUAL_FORM_DRAFT_STORAGE_EVENT));
    }

    if (resetForm) {
      formRef.current?.reset();
    }

    setHasSavedDraft(false);
    setLastDraftSavedAt(null);
    setDraftRestoredAt(null);
  }

  function saveDraft() {
    if (typeof window === "undefined") {
      return;
    }

    const snapshot = {
      version: 1 as const,
      savedAt: new Date().toISOString(),
      fields: readFields()
    };

    if (!hasMeaningfulManualFormDraft(snapshot)) {
      clearDraft(false);
      return;
    }

    window.localStorage.setItem(SERVICE_DRAFT_KEY, JSON.stringify(snapshot));
    window.dispatchEvent(new Event(MANUAL_FORM_DRAFT_STORAGE_EVENT));
    setHasSavedDraft(true);
    setLastDraftSavedAt(snapshot.savedAt);
    setDraftRestoredAt(snapshot.savedAt);
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const draft = parseManualFormDraftSnapshot(window.localStorage.getItem(SERVICE_DRAFT_KEY), SERVICE_FORM_FIELDS);
    if (!draft) {
      return;
    }

    window.setTimeout(() => {
      applyFields(draft.fields);
      setHasSavedDraft(true);
      setLastDraftSavedAt(draft.savedAt);
      setDraftRestoredAt(draft.savedAt);
    }, 0);
  }, []);

  const draftStatusLabel = draftRestoredAt
    ? `Bozza recuperata da ${formatDateTime(draftRestoredAt)}`
    : lastDraftSavedAt
      ? `Ultimo salvataggio ${formatDateTime(lastDraftSavedAt)}`
      : "Nessuna bozza salvata";

  return (
    <form
      action={async (formData) => {
        await action(formData);
        clearDraft();
      }}
      className="form-grid settings-service-form"
      ref={formRef}
    >
      <div className="order-draft-banner order-draft-banner-inline settings-service-draft-banner">
        <div className="stack">
          <strong>Bozza servizio opzionale</strong>
          <span className="subtle">{draftStatusLabel}</span>
        </div>
        <div className="button-row">
          <button className="secondary" onClick={saveDraft} type="button">
            Salva bozza
          </button>
          {hasSavedDraft ? (
            <button
              className="ghost"
              onClick={() => {
                clearDraft();
              }}
              type="button"
            >
              Svuota bozza
            </button>
          ) : null}
        </div>
      </div>

      <div className="field">
        <label htmlFor="code">Codice</label>
        <input id="code" name="code" placeholder="Facoltativo, lo genero io se vuoto" />
      </div>
      <div className="field wide">
        <label htmlFor="name">Nome servizio</label>
        <input id="name" name="name" required />
      </div>
      <div className="field">
        <label htmlFor="basePrice">Prezzo base</label>
        <input className="currency-input" id="basePrice" inputMode="decimal" name="basePrice" placeholder="0,00" />
      </div>
      <div className="field">
        <label htmlFor="unit">Unita</label>
        <select defaultValue="PZ" id="unit" name="unit">
          {serviceUnitOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field full">
        <label htmlFor="description">Descrizione</label>
        <textarea id="description" name="description" />
      </div>
      <div className="field full">
        <label htmlFor="quantityTiers">Scaglioni quantita</label>
        <input id="quantityTiers" name="quantityTiers" placeholder="1-9:0,50 | 10-49:0,30 | 50+:0,20" />
        <p className="hint">Facoltativo. Per i biglietti da visita il prezzo dello scaglione vale come totale riga; per gli altri servizi viene usato come prezzo unitario sulla quantita inserita.</p>
      </div>
      <div className="button-row settings-form-actions">
        <button className="primary" type="submit">
          Salva servizio
        </button>
      </div>
    </form>
  );
}
