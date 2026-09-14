"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  unlockShopBetaAccessAction,
  type ShopBetaAccessActionState
} from "@/app/shop/actions";

const initialState: ShopBetaAccessActionState = {
  error: null
};

function BetaAccessSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="primary shop-beta-access-button" disabled={pending} type="submit">
      {pending ? "Controllo..." : "Entra nella beta"}
    </button>
  );
}

export function ShopBetaAccessForm() {
  const [state, formAction] = useFormState(unlockShopBetaAccessAction, initialState);

  return (
    <form action={formAction} className="shop-beta-access-form">
      <div className="field full">
        <label htmlFor="shop-beta-access-code">Codice beta</label>
        <input
          autoCapitalize="characters"
          autoComplete="off"
          id="shop-beta-access-code"
          name="accessCode"
          placeholder="Inserisci codice"
          required
          spellCheck={false}
          type="text"
        />
      </div>
      {state.error ? <div className="shop-beta-access-error">{state.error}</div> : null}
      <BetaAccessSubmitButton />
    </form>
  );
}
