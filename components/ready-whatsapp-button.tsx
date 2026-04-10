"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatDateTime } from "@/lib/format";

export function ReadyWhatsAppButton({
  orderId,
  hasPhone,
  disabled = false,
  compact = false,
  notifiedAt
}: {
  orderId: string;
  hasPhone: boolean;
  disabled?: boolean;
  compact?: boolean;
  notifiedAt?: Date | string | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const hasAlreadyNotified = Boolean(notifiedAt);
  const isDisabled = disabled || !hasPhone || isPending;
  const title = disabled
    ? "Disponibile solo quando l'ordine e pronto."
    : !hasPhone
      ? "Manca un numero cliente valido."
      : hasAlreadyNotified
        ? "Reinvia messaggio WhatsApp"
        : "Invia messaggio WhatsApp";

  return (
    <div className={`ready-whatsapp-control${compact ? " compact" : ""}`}>
      <button
        aria-label="Apri messaggio WhatsApp"
        className={`button ghost ready-whatsapp-button${hasAlreadyNotified ? " sent" : ""}`}
        disabled={isDisabled}
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
              setMessage(hasAlreadyNotified ? "Promemoria WhatsApp registrato." : "Cliente segnato come avvisato.");
              router.refresh();
            })();
          });
        }}
        title={title}
        type="button"
      >
        <svg aria-hidden="true" className="glyph" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
          <path d="M4.5 7.5A2.5 2.5 0 0 1 7 5h10a2.5 2.5 0 0 1 2.5 2.5v9A2.5 2.5 0 0 1 17 19H7a2.5 2.5 0 0 1-2.5-2.5v-9Z" />
          <path d="m6 8l6 5l6-5" />
        </svg>
      </button>
      {!compact && message ? <p className="hint">{message}</p> : null}
      {!compact && !message && hasAlreadyNotified ? <p className="hint">{`Avvisato il ${formatDateTime(notifiedAt!)}`}</p> : null}
      {!compact && !disabled && !hasPhone ? <p className="hint">Manca un numero cliente valido: aggiorna telefono o WhatsApp.</p> : null}
    </div>
  );
}
