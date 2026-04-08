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
    <div className="stack">
      {healthMessage ? <div className="empty">{healthMessage}</div> : null}
      {state.error ? <div className="empty">{state.error}</div> : null}

      <form action={formAction} className="stack">
        <div className="field full">
          <label htmlFor="nickname">Nickname</label>
          <input autoCapitalize="off" defaultValue={defaultNickname} id="nickname" name="nickname" required spellCheck={false} />
        </div>
        <div className="field full">
          <label htmlFor="password">Password</label>
          <input defaultValue={defaultPassword} id="password" name="password" type="password" required />
        </div>
        <div className="button-row">
          <SubmitButton />
        </div>
      </form>
    </div>
  );
}
