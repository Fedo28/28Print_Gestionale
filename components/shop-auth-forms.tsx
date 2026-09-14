"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  loginCustomerAccountAction,
  registerCustomerAccountAction,
  type ShopAuthActionState
} from "@/app/shop/actions";

const initialState: ShopAuthActionState = {
  error: null
};

function SubmitButton({ idleLabel, pendingLabel }: { idleLabel: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button className="primary" disabled={pending} type="submit">
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}

export function ShopLoginForm({ healthMessage }: { healthMessage?: string }) {
  const [state, formAction] = useFormState(loginCustomerAccountAction, initialState);

  return (
    <div className="stack">
      {healthMessage ? <div className="empty">{healthMessage}</div> : null}
      {state.error ? <div className="empty">{state.error}</div> : null}

      <form action={formAction} className="stack">
        <div className="field full">
          <label htmlFor="shop-login-email">Email</label>
          <input autoCapitalize="off" autoComplete="email" id="shop-login-email" name="email" required spellCheck={false} type="email" />
        </div>
        <div className="field full">
          <label htmlFor="shop-login-password">Password</label>
          <input autoComplete="current-password" id="shop-login-password" name="password" required type="password" />
        </div>
        <div className="button-row">
          <SubmitButton idleLabel="Accedi allo shop" pendingLabel="Accesso..." />
        </div>
      </form>
    </div>
  );
}

export function ShopRegisterForm({ healthMessage }: { healthMessage?: string }) {
  const [state, formAction] = useFormState(registerCustomerAccountAction, initialState);

  return (
    <div className="stack">
      {healthMessage ? <div className="empty">{healthMessage}</div> : null}
      {state.error ? <div className="empty">{state.error}</div> : null}

      <form action={formAction} className="stack">
        <div className="field full">
          <label htmlFor="shop-register-full-name">Nome e cognome</label>
          <input autoCapitalize="words" autoComplete="name" id="shop-register-full-name" name="fullName" required />
        </div>
        <div className="field full">
          <label htmlFor="shop-register-phone">Telefono</label>
          <input autoComplete="tel" id="shop-register-phone" name="phone" required type="tel" />
        </div>
        <div className="field full">
          <label htmlFor="shop-register-email">Email</label>
          <input autoCapitalize="off" autoComplete="email" id="shop-register-email" name="email" required spellCheck={false} type="email" />
        </div>
        <div className="field full">
          <label htmlFor="shop-register-password">Password</label>
          <input autoComplete="new-password" id="shop-register-password" name="password" required type="password" />
        </div>
        <div className="field full">
          <label htmlFor="shop-register-confirm-password">Conferma password</label>
          <input autoComplete="new-password" id="shop-register-confirm-password" name="confirmPassword" required type="password" />
        </div>
        <div className="button-row">
          <SubmitButton idleLabel="Crea account cliente" pendingLabel="Creazione..." />
        </div>
      </form>
    </div>
  );
}
