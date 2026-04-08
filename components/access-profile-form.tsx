"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { updateOwnNicknameAction, type AccessProfileActionState } from "@/app/actions";

const initialState: AccessProfileActionState = {
  error: null,
  successMessage: null,
  updatedNickname: null
};

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button className="primary" disabled={pending} type="submit">
      {pending ? "Salvataggio..." : "Aggiorna nickname"}
    </button>
  );
}

export function AccessProfileForm({
  currentNickname,
  email
}: {
  currentNickname: string;
  email: string;
}) {
  const [state, formAction] = useFormState(updateOwnNicknameAction, initialState);
  const router = useRouter();

  useEffect(() => {
    if (!state.successMessage) {
      return;
    }

    router.refresh();
  }, [router, state.successMessage]);

  return (
    <div className="stack">
      {state.error ? <div className="empty">{state.error}</div> : null}
      {state.successMessage ? (
        <div className="mini-item">
          <strong>{state.successMessage}</strong>
          {state.updatedNickname ? <div className="subtle">Nuovo login: @{state.updatedNickname}</div> : null}
        </div>
      ) : null}

      <form action={formAction} className="form-grid">
        <div className="field wide">
          <label htmlFor="access-email">Email profilo</label>
          <input defaultValue={email} id="access-email" readOnly />
        </div>

        <div className="field wide">
          <label htmlFor="access-nickname">Nickname accesso</label>
          <input
            autoCapitalize="off"
            defaultValue={state.updatedNickname || currentNickname}
            id="access-nickname"
            name="nickname"
            required
            spellCheck={false}
          />
          <p className="hint">Da qui puoi personalizzare il nickname dopo il primo accesso. La sessione attuale resta valida.</p>
        </div>

        <div className="button-row">
          <SaveButton />
        </div>
      </form>
    </div>
  );
}
