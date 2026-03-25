"use client";

import { useState, useTransition } from "react";

export function ReadyWhatsAppButton({
  orderId,
  hasPhone
}: {
  orderId: string;
  hasPhone: boolean;
}) {
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <div className="ready-whatsapp-control">
      <button
        aria-label="Apri messaggio WhatsApp"
        className="button ghost ready-whatsapp-button"
        disabled={!hasPhone || isPending}
        onClick={() => {
          startTransition(() => {
            void (async () => {
              setMessage("");

              const response = await fetch(`/api/orders/${orderId}/whatsapp`, {
                method: "POST"
              });

              if (!response.ok) {
                const body = (await response.json().catch(() => null)) as { error?: string } | null;
                setMessage(body?.error || "Impossibile aprire il messaggio WhatsApp.");
                return;
              }

              const data = (await response.json()) as { whatsappUrl: string };
              window.open(data.whatsappUrl, "_blank", "noopener,noreferrer");
            })();
          });
        }}
        title="Invia messaggio WhatsApp"
        type="button"
      >
        <svg aria-hidden="true" className="glyph" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
          <path d="M4.5 7.5A2.5 2.5 0 0 1 7 5h10a2.5 2.5 0 0 1 2.5 2.5v9A2.5 2.5 0 0 1 17 19H7a2.5 2.5 0 0 1-2.5-2.5v-9Z" />
          <path d="m6 8l6 5l6-5" />
        </svg>
      </button>
      {message ? <p className="hint">{message}</p> : null}
      {!hasPhone ? <p className="hint">Manca un numero cliente valido: aggiorna telefono o WhatsApp.</p> : null}
    </div>
  );
}
