"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { recordPaymentEntryAction, type PaymentEntryActionState } from "@/app/actions";
import { paymentMethodLabels } from "@/lib/constants";

const initialState: PaymentEntryActionState = {
  error: null,
  successMessage: null,
  submittedAt: null
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="primary" disabled={pending} type="submit">
      {pending ? "Salvataggio..." : "Registra pagamento"}
    </button>
  );
}

export function OrderPaymentEntryForm({ orderId }: { orderId: string }) {
  const [state, formAction] = useFormState(recordPaymentEntryAction, initialState);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!state.submittedAt) {
      return;
    }

    formRef.current?.reset();
    amountRef.current?.focus();
    router.refresh();
  }, [router, state.submittedAt]);

  return (
    <div className="stack payment-entry-stack">
      {state.error ? <div className="empty">{state.error}</div> : null}
      {state.successMessage ? (
        <div className="mini-item payment-entry-feedback">
          <strong>{state.successMessage}</strong>
        </div>
      ) : null}

      <form action={formAction} className="form-grid payment-entry-form" ref={formRef}>
        <input name="orderId" type="hidden" value={orderId} />
        <div className="field">
          <label htmlFor={`payment-amount-${orderId}`}>Importo</label>
          <input
            className="currency-input"
            id={`payment-amount-${orderId}`}
            inputMode="decimal"
            name="amount"
            placeholder="0,00"
            ref={amountRef}
            required
          />
        </div>
        <div className="field">
          <label htmlFor={`payment-method-${orderId}`}>Metodo</label>
          <select id={`payment-method-${orderId}`} name="method">
            {Object.entries(paymentMethodLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field wide">
          <label htmlFor={`payment-note-${orderId}`}>Nota</label>
          <input id={`payment-note-${orderId}`} name="note" placeholder="Acconto, saldo, cassa" />
        </div>
        <div className="button-row payment-form-actions">
          <SubmitButton />
        </div>
      </form>
    </div>
  );
}
