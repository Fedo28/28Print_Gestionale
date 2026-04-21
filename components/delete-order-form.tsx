"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteOrderAction } from "@/app/actions";

function DeleteSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="danger" disabled={pending} type="submit">
      {pending ? "Eliminazione..." : "Conferma eliminazione"}
    </button>
  );
}

export function DeleteOrderForm({
  orderId,
  isQuote,
  compact = false
}: {
  orderId: string;
  isQuote: boolean;
  compact?: boolean;
}) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (compact) {
    return !isConfirming ? (
      <button
        aria-label={isQuote ? "Cestina preventivo" : "Cestina ordine"}
        className="order-delete-trigger-icon danger-icon-button"
        onClick={() => setIsConfirming(true)}
        title={isQuote ? "Cestina preventivo" : "Cestina ordine"}
        type="button"
      >
        <svg aria-hidden="true" className="glyph" viewBox="0 0 24 24">
          <path
            d="M9 4.5h6m-8 3h10m-8 0v9m3-9v9m3-9v9M8 19.5h8a1 1 0 0 0 1-1v-11H7v11a1 1 0 0 0 1 1Z"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.9"
          />
        </svg>
      </button>
    ) : (
      <form action={deleteOrderAction} className="order-delete-compact-confirm">
        <input name="id" type="hidden" value={orderId} />
        <button className="secondary" onClick={() => setIsConfirming(false)} type="button">
          Annulla
        </button>
        <DeleteSubmitButton />
      </form>
    );
  }

  return (
    <div className="mini-item danger-zone">
      <div className="list-header">
        <div>
          <strong>{isQuote ? "Cestina preventivo" : "Cestina ordine"}</strong>
          <p className="card-muted">
            {isQuote
              ? "Rimuove il preventivo e i suoi allegati. L'azione e definitiva."
              : "Rimuove ordine, allegati e storico collegato. L'azione e definitiva."}
          </p>
        </div>
        <span className="pill danger">Irreversibile</span>
      </div>

      {!isConfirming ? (
        <div className="button-row danger-zone-actions">
          <button className="ghost" onClick={() => setIsConfirming(true)} type="button">
            {isQuote ? "Cestina preventivo" : "Cestina ordine"}
          </button>
        </div>
      ) : (
        <form action={deleteOrderAction} className="button-row danger-zone-actions">
          <input name="id" type="hidden" value={orderId} />
          <button className="secondary" onClick={() => setIsConfirming(false)} type="button">
            Annulla
          </button>
          <DeleteSubmitButton />
        </form>
      )}
    </div>
  );
}
