"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type ImportError = {
  row: number;
  message: string;
  code?: string;
};

type ImportResult = {
  created: number;
  updated: number;
  errors: ImportError[];
};

export function CatalogImportForm() {
  const router = useRouter();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <div className="stack settings-import-block">
      <form
        className="stack settings-import-form"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);

          startTransition(() => {
            void (async () => {
              setMessage("");
              setResult(null);

              const response = await fetch("/api/settings/catalog/import", {
                method: "POST",
                body: formData
              });

              const body = (await response.json().catch(() => null)) as
                | { error?: string; created?: number; updated?: number; errors?: ImportError[] }
                | null;

              if (!response.ok) {
                setMessage(body?.error || "Import catalogo non riuscito.");
                return;
              }

              setResult({
                created: body?.created || 0,
                updated: body?.updated || 0,
                errors: body?.errors || []
              });
              router.refresh();
            })();
          });
        }}
      >
        <div className="field full">
          <label htmlFor="catalogFile">Import Excel catalogo</label>
          <input accept=".xlsx" id="catalogFile" name="file" required type="file" />
        </div>
        <p className="hint settings-import-hint">
          Colonne richieste: <code>code</code>, <code>name</code>, <code>base_price</code>. Opzionali: <code>description</code>, <code>active</code>.
        </p>
        <div className="button-row settings-form-actions">
          <button className="secondary" disabled={isPending} type="submit">
            {isPending ? "Import in corso..." : "Importa file Excel"}
          </button>
        </div>
      </form>

      {message ? <div className="empty">{message}</div> : null}

      {result ? (
        <div className="mini-item catalog-import-result">
          <div className="list-header">
            <strong>Import completato</strong>
            <span>{result.created + result.updated} righe valide</span>
          </div>
          <div className="subtle">Creati: {result.created} • Aggiornati: {result.updated}</div>
          {result.errors.length ? (
            <div className="catalog-import-errors">
              {result.errors.map((error, index) => (
                <div className="subtle" key={`${error.row}-${index}`}>
                  Riga {error.row}
                  {error.code ? ` (${error.code})` : ""}: {error.message}
                </div>
              ))}
            </div>
          ) : (
            <div className="subtle">Nessun errore nel file.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
