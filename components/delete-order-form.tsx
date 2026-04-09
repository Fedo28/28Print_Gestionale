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
  isQuote
}: {
  orderId: string;
  isQuote: boolean;
}) {
  const [isConfirming, setIsConfirming] = useState(false);

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
