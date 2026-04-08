"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import {
  saveStaffInviteSettingsAction,
  type StaffInviteSettingsActionState
} from "@/app/actions";

const initialState: StaffInviteSettingsActionState = {
  error: null,
  successMessage: null
};

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button className="primary" disabled={pending} type="submit">
      {pending ? "Salvataggio..." : "Salva bozza invito"}
    </button>
  );
}

type StaffInviteSettingsFormProps = {
  accessBaseUrl: string;
  subject: string;
  template: string;
  previewBody: string;
  previewAccessLoginUrl: string | null;
};

export function StaffInviteSettingsForm({
  accessBaseUrl,
  subject,
  template,
  previewBody,
  previewAccessLoginUrl
}: StaffInviteSettingsFormProps) {
  const [state, formAction] = useFormState(saveStaffInviteSettingsAction, initialState);
  const router = useRouter();

  useEffect(() => {
    if (!state.successMessage) {
      return;
    }

    router.refresh();
  }, [router, state.successMessage]);

  return (
    <div className="stack staff-invite-preview">
      {state.error ? <div className="empty">{state.error}</div> : null}
      {state.successMessage ? (
        <div className="mini-item">
          <strong>{state.successMessage}</strong>
          <div className="subtle">La prossima profilazione usera subito questa bozza.</div>
        </div>
      ) : null}

      <form action={formAction} className="form-grid">
        <div className="field full">
          <label htmlFor="staff-invite-access-base-url">Dominio accesso</label>
          <input
            defaultValue={accessBaseUrl}
            id="staff-invite-access-base-url"
            name="accessBaseUrl"
            placeholder="https://gestionale.azienda.it"
          />
          <p className="hint">
            Facoltativo. Se lo lasci vuoto continuo a usare il dominio del deploy attuale.
          </p>
        </div>

        <div className="field full">
          <label htmlFor="staff-invite-subject">Oggetto</label>
          <input defaultValue={subject} id="staff-invite-subject" name="subject" required />
        </div>

        <div className="field full">
          <label htmlFor="staff-invite-template">Bozza messaggio</label>
          <textarea defaultValue={template} id="staff-invite-template" name="template" required rows={8} />
          <p className="hint">
            Puoi usare i placeholder <code>{"{nome_staff}"}</code>, <code>{"{nickname}"}</code> e{" "}
            <code>{"{access_url}"}</code>.
          </p>
        </div>

        <div className="button-row">
          <SaveButton />
        </div>
      </form>

      <div className="mini-item">
        <strong>Anteprima attuale</strong>
        <div className="subtle staff-invite-preview-body">{previewBody}</div>
      </div>

      <div className="mini-item">
        <strong>Link previsto</strong>
        <div className="subtle">{previewAccessLoginUrl || "Da configurare nel prossimo passaggio"}</div>
      </div>
    </div>
  );
}
