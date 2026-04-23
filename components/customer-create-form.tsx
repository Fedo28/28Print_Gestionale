"use client";

import { useEffect, useRef, useState } from "react";
import { formatDateTime } from "@/lib/format";
import {
  buildManualFormDraftStorageKey,
  hasMeaningfulManualFormDraft,
  MANUAL_FORM_DRAFT_STORAGE_EVENT,
  parseManualFormDraftSnapshot
} from "@/lib/form-drafts";

const CUSTOMER_DRAFT_KEY = buildManualFormDraftStorageKey("customer-create");
const CUSTOMER_FORM_FIELDS = [
  "name",
  "type",
  "phone",
  "whatsapp",
  "email",
  "pec",
  "vatNumber",
  "taxCode",
  "uniqueCode",
  "notes"
] as const;

export function CustomerCreateForm({
  action,
  typeOptions
}: {
  action: (formData: FormData) => void | Promise<void>;
  typeOptions: Array<{ value: string; label: string }>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<string | null>(null);
  const [draftRestoredAt, setDraftRestoredAt] = useState<string | null>(null);

  function readFields() {
    const form = formRef.current;
    const formData = form ? new FormData(form) : new FormData();
    return Object.fromEntries(CUSTOMER_FORM_FIELDS.map((fieldName) => [fieldName, String(formData.get(fieldName) || "")])) as Record<
      (typeof CUSTOMER_FORM_FIELDS)[number],
      string
    >;
  }

  function applyFields(fields: Record<(typeof CUSTOMER_FORM_FIELDS)[number], string>) {
    const form = formRef.current;
    if (!form) {
      return;
    }

    for (const fieldName of CUSTOMER_FORM_FIELDS) {
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
      window.localStorage.removeItem(CUSTOMER_DRAFT_KEY);
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

    window.localStorage.setItem(CUSTOMER_DRAFT_KEY, JSON.stringify(snapshot));
    window.dispatchEvent(new Event(MANUAL_FORM_DRAFT_STORAGE_EVENT));
    setHasSavedDraft(true);
    setLastDraftSavedAt(snapshot.savedAt);
    setDraftRestoredAt(snapshot.savedAt);
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const draft = parseManualFormDraftSnapshot(window.localStorage.getItem(CUSTOMER_DRAFT_KEY), CUSTOMER_FORM_FIELDS);
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
      className="form-grid"
      ref={formRef}
    >
      <div className="order-draft-banner order-draft-banner-inline customer-draft-banner">
        <div className="stack">
          <strong>Bozza cliente opzionale</strong>
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

      <div className="field wide">
        <label htmlFor="name">Nome / Ragione sociale</label>
        <input id="name" name="name" required />
      </div>
      <div className="field">
        <label htmlFor="type">Tipo cliente</label>
        <select defaultValue="PUBBLICO" id="type" name="type">
          {typeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="phone">Telefono</label>
        <input id="phone" name="phone" placeholder="Facoltativo" />
      </div>
      <div className="field">
        <label htmlFor="whatsapp">WhatsApp</label>
        <input id="whatsapp" name="whatsapp" />
      </div>
      <div className="field wide">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" />
      </div>
      <div className="field wide">
        <label htmlFor="pec">PEC</label>
        <input id="pec" name="pec" type="email" />
      </div>
      <div className="field">
        <label htmlFor="vatNumber">P. IVA</label>
        <input id="vatNumber" name="vatNumber" />
      </div>
      <div className="field">
        <label htmlFor="taxCode">Codice fiscale</label>
        <input id="taxCode" name="taxCode" />
      </div>
      <div className="field">
        <label htmlFor="uniqueCode">Codice univoco (CU)</label>
        <input id="uniqueCode" name="uniqueCode" />
      </div>
      <div className="field full">
        <label htmlFor="notes">Note</label>
        <textarea id="notes" name="notes" />
      </div>
      <div className="button-row customers-entry-actions">
        <button className="primary" type="submit">
          Salva cliente
        </button>
      </div>
    </form>
  );
}
