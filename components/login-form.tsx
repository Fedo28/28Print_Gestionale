"use client";

import { useFormState, useFormStatus } from "react-dom";
import { loginAction, type LoginActionState } from "@/app/actions";

const initialState: LoginActionState = {
  error: null
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="primary" disabled={pending} type="submit">
      {pending ? "Accesso..." : "Accedi"}
    </button>
  );
}

export function LoginForm({
  defaultNickname,
  defaultPassword,
  healthMessage
}: {
  defaultNickname?: string;
  defaultPassword?: string;
  healthMessage?: string;
}) {
  const [state, formAction] = useFormState(loginAction, initialState);

  return (
    <div className="stack login-form-shell">
      {healthMessage ? <div className="empty login-feedback">{healthMessage}</div> : null}
      {state.error ? <div className="empty login-feedback">{state.error}</div> : null}

      <form action={formAction} className="stack login-form">
        <div className="field full">
          <label htmlFor="nickname">Nickname</label>
          <input
            autoCapitalize="off"
            autoComplete="username"
            defaultValue={defaultNickname}
            id="nickname"
            name="nickname"
            required
            spellCheck={false}
          />
        </div>
        <div className="field full">
          <label htmlFor="password">Password</label>
          <input
            autoComplete="current-password"
            defaultValue={defaultPassword}
            id="password"
            name="password"
            required
            type="password"
          />
        </div>
        <div className="button-row login-submit-row">
          <SubmitButton />
        </div>
      </form>
    </div>
  );
}
