"use client";

import { BillboardAssetKind } from "@prisma/client";
import { deleteBillboardAssetAction, updateBillboardAssetAction } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { billboardAssetKindLabels } from "@/lib/constants";

type BillboardAssetManagerFormProps = {
  asset: {
    id: string;
    code: string;
    name: string;
    kind: BillboardAssetKind;
    location: string | null;
    sortOrder: number;
    bookingCount: number;
  };
  returnDate: string;
};

export function BillboardAssetManagerForm({ asset, returnDate }: BillboardAssetManagerFormProps) {
  return (
    <div className="stack billboard-asset-manager-form-shell">
      <form action={updateBillboardAssetAction} className="form-grid billboard-asset-manager-form">
        <input name="assetId" type="hidden" value={asset.id} />
        <input name="returnDate" type="hidden" value={returnDate} />

        <div className="field">
          <label htmlFor={`billboard-asset-code-${asset.id}`}>Codice</label>
          <input defaultValue={asset.code} id={`billboard-asset-code-${asset.id}`} name="code" required />
        </div>

        <div className="field wide">
          <label htmlFor={`billboard-asset-name-${asset.id}`}>Nome</label>
          <input defaultValue={asset.name} id={`billboard-asset-name-${asset.id}`} name="name" required />
        </div>

        <div className="field">
          <label htmlFor={`billboard-asset-kind-${asset.id}`}>Tipologia</label>
          <select defaultValue={asset.kind} id={`billboard-asset-kind-${asset.id}`} name="kind">
            {Object.entries(billboardAssetKindLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor={`billboard-asset-sort-${asset.id}`}>Ordine</label>
          <input defaultValue={asset.sortOrder} id={`billboard-asset-sort-${asset.id}`} min={0} name="sortOrder" type="number" />
        </div>

        <div className="field full">
          <label htmlFor={`billboard-asset-location-${asset.id}`}>Posizione / note</label>
          <textarea defaultValue={asset.location || ""} id={`billboard-asset-location-${asset.id}`} name="location" rows={3} />
        </div>

        <div className="mini-item billboard-asset-manager-meta">
          <strong>{asset.bookingCount}</strong>
          <span>{asset.bookingCount === 1 ? "prenotazione collegata" : "prenotazioni collegate"}</span>
        </div>

        <div className="button-row billboard-asset-manager-actions">
          <button className="primary" type="submit">
            Salva impianto
          </button>
        </div>
      </form>

      <form action={deleteBillboardAssetAction} className="billboard-asset-manager-delete">
        <input name="assetId" type="hidden" value={asset.id} />
        <input name="returnDate" type="hidden" value={returnDate} />
        <ConfirmSubmitButton
          className="button danger"
          confirmMessage={
            asset.bookingCount > 0
              ? "Questo impianto ha storico collegato: verra nascosto dalle viste attive ma lo storico restera. Continuare?"
              : "Vuoi eliminare questo impianto? L'operazione non puo essere annullata."
          }
        >
          {asset.bookingCount > 0 ? "Nascondi impianto" : "Elimina impianto"}
        </ConfirmSubmitButton>
      </form>
    </div>
  );
}
