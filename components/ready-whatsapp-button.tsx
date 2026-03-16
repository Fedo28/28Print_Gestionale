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
    <div className="stack compact-stack status-feedback">
      <button
        className="button ghost"
        disabled={!hasPhone || isPending}
        onClick={() => {
          startTransition(() => {
            void (async () => {
              const response = await fetch(`/api/orders/${orderId}/mark-ready`, {
                method: "POST"
              });

              if (!response.ok) {
                const body = (await response.json().catch(() => null)) as { error?: string } | null;
                setMessage(body?.error || "Impossibile segnare l'ordine come pronto.");
                return;
              }

              const data = (await response.json()) as { whatsappUrl: string };
              window.open(data.whatsappUrl, "_blank", "noopener,noreferrer");
              window.location.reload();
            })();
          });
        }}
        type="button"
      >
        {isPending ? "Invio WhatsApp..." : "Pronto + WhatsApp"}
      </button>
      {message ? <p className="hint">{message}</p> : null}
      {!hasPhone ? <p className="hint">Manca un numero cliente valido: aggiorna telefono o WhatsApp.</p> : null}
    </div>
  );
}
