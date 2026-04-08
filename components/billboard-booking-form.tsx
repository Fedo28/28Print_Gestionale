"use client";

import { BillboardAssetKind } from "@prisma/client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { createBillboardBookingAction } from "@/app/actions";
import { CustomerAutocomplete, CustomerAutocompleteOption } from "@/components/customer-autocomplete";
import { customerTypeLabels } from "@/lib/constants";

type BillboardAssetOption = {
  id: string;
  name: string;
  kind: BillboardAssetKind;
  location?: string | null;
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
  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId) || null;

  return (
    <form action={createBillboardBookingAction} className="form-grid" encType="multipart/form-data">
      <input name="customerId" type="hidden" value={selectedCustomerId} />

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

      <div className="field wide">
        <label htmlFor="billboardAssetId">Impianto</label>
        <select defaultValue={assets[0]?.id || ""} id="billboardAssetId" name="billboardAssetId" required>
          {assets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.name}
              {asset.location ? ` • ${asset.location}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="startsAt">Dal</label>
        <input defaultValue={defaultStartDate} id="startsAt" name="startsAt" required type="date" />
      </div>

      <div className="field">
        <label htmlFor="endsAt">Al</label>
        <input defaultValue={defaultEndDate} id="endsAt" name="endsAt" required type="date" />
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
