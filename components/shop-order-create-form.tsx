"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createShopSalesOrderAction, type ShopOrderActionState } from "@/app/shop/actions";

const initialState: ShopOrderActionState = {
  error: null
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button primary" disabled={pending} type="submit">
      {pending ? "Creazione ordine..." : "Crea ordine e passa ai file"}
    </button>
  );
}

export function ShopOrderCreateForm({
  documentBundleJson,
  quantity,
  serviceLabel,
  serviceId,
  sourcePath,
  summary,
  summaryHeading
}: {
  documentBundleJson: string;
  quantity: number;
  serviceLabel: string;
  serviceId: string;
  sourcePath: string;
  summary: string;
  summaryHeading: string;
}) {
  const [state, formAction] = useFormState(createShopSalesOrderAction, initialState);

  return (
    <div className="shop-order-cta-stack">
      {state.error ? <div className="empty">{state.error}</div> : null}

      <form action={formAction} className="shop-order-cta-actions">
        <input name="serviceId" type="hidden" value={serviceId} />
        <input name="serviceLabel" type="hidden" value={serviceLabel} />
        <input name="quantity" type="hidden" value={String(quantity)} />
        <input name="sourcePath" type="hidden" value={sourcePath} />
        <input name="documentBundle" type="hidden" value={documentBundleJson} />
        <input name="configurationSummary" type="hidden" value={summary} />

        <div className="shop-order-cta-head">
          <strong>Invia ordine</strong>
          <div className="subtle">{summaryHeading}</div>
        </div>

        <details className="shop-order-optional-panel">
          <summary>Aggiungi note o fattura</summary>

          <div className="stack compact-stack">
            <div className="field full">
              <label className="toggle-field" htmlFor="shop-order-invoice-requested">
                <input id="shop-order-invoice-requested" name="invoiceRequested" type="checkbox" />
                <span>Richiedo fattura</span>
              </label>
            </div>

            <div className="field full">
              <label htmlFor="shop-order-note">Note</label>
              <textarea id="shop-order-note" name="customerNote" placeholder="Solo se serve" rows={3} />
            </div>
          </div>
        </details>

        <div className="button-row">
          <SubmitButton />
        </div>
      </form>
    </div>
  );
}
