"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { createStaffUserAction, type StaffProfileActionState } from "@/app/actions";
import { userRoleLabels } from "@/lib/constants";

const initialState: StaffProfileActionState = {
  error: null,
  successMessage: null,
  createdNickname: null
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="primary" disabled={pending} type="submit">
      {pending ? "Creazione..." : "Crea profilo"}
    </button>
  );
}

export function StaffProfileForm() {
  const [state, formAction] = useFormState(createStaffUserAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!state.successMessage) {
      return;
    }

    formRef.current?.reset();
    router.refresh();
  }, [router, state.successMessage]);

  return (
    <div className="stack">
      {state.error ? <div className="empty">{state.error}</div> : null}
      {state.successMessage ? (
        <div className="mini-item">
          <strong>{state.successMessage}</strong>
          {state.createdNickname ? <div className="subtle">Nickname pronto: {state.createdNickname}</div> : null}
        </div>
      ) : null}

      <form action={formAction} className="form-grid" ref={formRef}>
        <div className="field wide">
          <label htmlFor="staff-name">Nome profilo</label>
          <input id="staff-name" name="name" placeholder="Es. Marco Officina" required />
        </div>

        <div className="field">
          <label htmlFor="staff-role">Ruolo</label>
          <select defaultValue="OPERATOR" id="staff-role" name="role">
            <option value="OPERATOR">{userRoleLabels.OPERATOR}</option>
            <option value="ADMIN">{userRoleLabels.ADMIN}</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="staff-nickname">Nickname</label>
          <input
            autoCapitalize="off"
            id="staff-nickname"
            name="nickname"
            placeholder="nome.cognome"
            required
            spellCheck={false}
          />
          <p className="hint">Solo minuscole, numeri, punto, trattino o underscore.</p>
        </div>

        <div className="field wide">
          <label htmlFor="staff-email">Email</label>
          <input id="staff-email" name="email" placeholder="collega@azienda.it" required type="email" />
        </div>

        <div className="field full">
          <label htmlFor="staff-password">Password iniziale</label>
          <input id="staff-password" name="password" required type="password" />
          <p className="hint">Per ora la imposti tu in profilazione. Nel prossimo step collegheremo il link definitivo per l'accesso.</p>
        </div>

        <div className="button-row">
          <SubmitButton />
        </div>
      </form>
    </div>
  );
}
