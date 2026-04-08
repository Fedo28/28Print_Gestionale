"use client";

import { BillboardAssetKind, BillboardBookingStatus } from "@prisma/client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { createBillboardBookingAction } from "@/app/actions";
import {
  BillboardAssetAutocomplete,
  BillboardAssetAutocompleteOption
} from "@/components/billboard-asset-autocomplete";
import { CustomerAutocomplete, CustomerAutocompleteOption } from "@/components/customer-autocomplete";
import {
  billboardAssetKindLabels,
  billboardBookingStatusLabels,
  customerTypeLabels
} from "@/lib/constants";
import { formatCurrency } from "@/lib/format";

type BillboardAssetOption = BillboardAssetAutocompleteOption & {
  kind: BillboardAssetKind;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="primary" disabled={pending} type="submit">
      {pending ? "Salvataggio..." : "Salva prenotazione"}
    </button>
  );
}

export function BillboardBookingForm({
  customers,
  assets,
  defaultStartDate,
  defaultEndDate
}: {
  customers: CustomerAutocompleteOption[];
  assets: BillboardAssetOption[];
  defaultStartDate: string;
  defaultEndDate: string;
}) {
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [assetQuery, setAssetQuery] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [paidInput, setPaidInput] = useState("");
  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId) || null;
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId) || null;
  const pricePreviewCents = parseMoneyDraftToCents(priceInput);
  const paidPreviewCents = parseMoneyDraftToCents(paidInput);
  const balancePreviewCents = Math.max(0, pricePreviewCents - paidPreviewCents);

  return (
    <form action={createBillboardBookingAction} className="form-grid" encType="multipart/form-data">
      <input name="customerId" type="hidden" value={selectedCustomerId} />
      <input name="billboardAssetId" type="hidden" value={selectedAssetId} />

      <CustomerAutocomplete
        customers={customers}
        emptyMessage="Cliente non trovato. Crealo prima nella sezione clienti, poi torna qui per prenotare."
        helperText="Scrivi nome, telefono, email, codice fiscale o partita IVA per trovare subito il cliente da prenotare."
        label="Cliente"
        onQueryChange={(value) => {
          setCustomerQuery(value);
          if (selectedCustomerId) {
            setSelectedCustomerId("");
          }
        }}
        onSelect={(customer) => {
          setSelectedCustomerId(customer.id);
          setCustomerQuery(customer.name);
        }}
        placeholder="Es. Rossi, +39 333..., azienda@mail.it"
        query={customerQuery}
        selectedCustomerId={selectedCustomerId}
      />

      {selectedCustomer ? (
        <div className="mini-item customer-selection-card field full">
          <div className="list-header">
            <div>
              <strong>{selectedCustomer.name}</strong>
              <div className="subtle">{customerTypeLabels[selectedCustomer.type]}</div>
            </div>
            <button
              className="ghost"
              onClick={(event) => {
                event.preventDefault();
                setSelectedCustomerId("");
                setCustomerQuery("");
              }}
              type="button"
            >
              Cambia cliente
            </button>
          </div>
          <div className="subtle">{selectedCustomer.phone}</div>
          <div className="subtle">{selectedCustomer.email || selectedCustomer.whatsapp || "Nessun contatto secondario"}</div>
        </div>
      ) : null}

      <BillboardAssetAutocomplete
        assets={assets}
        emptyMessage="Nessun impianto corrisponde a questa ricerca. Prova con cartellone, monitor, vela o il codice impianto."
        helperText="Scrivi nome, codice o luogo per trovare subito l'impianto giusto senza scorrere tutta la lista."
        label="Impianto"
        onQueryChange={(value) => {
          setAssetQuery(value);
          if (selectedAssetId) {
            setSelectedAssetId("");
          }
        }}
        onSelect={(asset) => {
          setSelectedAssetId(asset.id);
          setAssetQuery(asset.name);
        }}
        placeholder="Es. Cartellone 03, monitor, CARTELLONE_12"
        query={assetQuery}
        selectedAssetId={selectedAssetId}
      />

      {selectedAsset ? (
        <div className="mini-item customer-selection-card field full">
          <div className="list-header">
            <div>
              <strong>{selectedAsset.name}</strong>
              <div className="subtle">{billboardAssetKindLabels[selectedAsset.kind]}</div>
            </div>
            <button
              className="ghost"
              onClick={(event) => {
                event.preventDefault();
                setSelectedAssetId("");
                setAssetQuery("");
              }}
              type="button"
            >
              Cambia impianto
            </button>
          </div>
          <div className="subtle">{selectedAsset.code}</div>
          <div className="subtle">{selectedAsset.location || "Luogo da definire"}</div>
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="startsAt">Dal</label>
        <input defaultValue={defaultStartDate} id="startsAt" name="startsAt" required type="date" />
      </div>

      <div className="field">
        <label htmlFor="endsAt">Al</label>
        <input defaultValue={defaultEndDate} id="endsAt" name="endsAt" required type="date" />
      </div>

      <div className="field">
        <label htmlFor="status">Stato prenotazione</label>
        <select defaultValue="CONFERMATO" id="status" name="status">
          {(["OPZIONATO", "CONFERMATO", "SCADUTO"] as BillboardBookingStatus[]).map((status) => (
            <option key={status} value={status}>
              {billboardBookingStatusLabels[status]}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="price">Valore prenotazione</label>
        <input
          id="price"
          inputMode="decimal"
          name="price"
          onChange={(event) => setPriceInput(event.target.value)}
          placeholder="Es. 250,00"
          type="text"
          value={priceInput}
        />
      </div>

      <div className="field">
        <label htmlFor="paid">Incassato</label>
        <input
          id="paid"
          inputMode="decimal"
          name="paid"
          onChange={(event) => setPaidInput(event.target.value)}
          placeholder="Es. 100,00"
          type="text"
          value={paidInput}
        />
      </div>

      <div className="mini-item billboard-booking-balance-card field full">
        <div className="list-header">
          <div>
            <strong>Riepilogo economico</strong>
            <div className="subtle">Controllo veloce del valore campagna e del saldo ancora aperto.</div>
          </div>
          <span className={`pill ${balancePreviewCents > 0 ? "warning" : "status"}`}>
            Saldo {formatCurrency(balancePreviewCents)}
          </span>
        </div>
        <div className="billboard-booking-financials">
          <span>Valore {formatCurrency(pricePreviewCents)}</span>
          <span>Incassato {formatCurrency(paidPreviewCents)}</span>
          <span>Residuo {formatCurrency(balancePreviewCents)}</span>
        </div>
      </div>

      <div className="field full">
        <label htmlFor="note">Nota campagna</label>
        <textarea
          id="note"
          name="note"
          placeholder="Cosa deve essere pubblicizzato, riferimenti creativi, note per stampa o installazione"
        />
      </div>

      <div className="field full">
        <label htmlFor="pdf">Allega PDF</label>
        <input accept="application/pdf,.pdf" id="pdf" name="pdf" type="file" />
        <p className="hint">Facoltativo. Utile per bozza grafica, conferma cliente o materiale da esporre.</p>
      </div>

      <div className="button-row">
        <SubmitButton />
      </div>
    </form>
  );
}

function parseMoneyDraftToCents(value: string) {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  if (!normalized) {
    return 0;
  }

  const parsed = Number.parseFloat(normalized);
  if (Number.isNaN(parsed) || parsed < 0) {
    return 0;
  }

  return Math.round(parsed * 100);
}
