"use client";

import { HistoryBackButton } from "@/components/history-back-button";

export function PrintOrderActions({ backHref }: { backHref: string }) {
  return (
    <section aria-label="Azioni anteprima di stampa" className="print-preview-actions">
      <div className="print-preview-actions-copy">
        <strong>Anteprima pronta</strong>
        <span>Stampa ufficiale 28 Print</span>
      </div>
      <div className="button-row">
        <button className="button primary" onClick={() => window.print()} type="button">
          Apri stampa
        </button>
        <HistoryBackButton className="button ghost" fallbackHref={backHref} label="Torna indietro" />
      </div>
    </section>
  );
}
