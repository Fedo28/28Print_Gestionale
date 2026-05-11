"use client";

import { BillboardAssetKind } from "@prisma/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createBillboardBookingAction } from "@/app/actions";
import {
  BillboardAssetAutocomplete,
  BillboardAssetAutocompleteOption
} from "@/components/billboard-asset-autocomplete";
import { CustomerAutocomplete, CustomerAutocompleteOption } from "@/components/customer-autocomplete";
import { UndoButtonContent } from "@/components/undo-button-content";
import { useUndoHistory } from "@/components/use-undo-history";
import { billboardAssetKindLabels, customerTypeLabels } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";

type BillboardAssetOption = BillboardAssetAutocompleteOption & {
  kind: BillboardAssetKind;
};

type BillboardBookingSnapshot = {
  id: string;
  billboardAssetId: string;
  customerName: string;
  monitorSlot?: number | null;
  startsAt: string;
  endsAt: string;
};

type BillboardBookingUndoSnapshot = {
  customerQuery: string;
  selectedCustomerId: string;
  assetQuery: string;
  selectedAssetId: string;
  selectedTargetIds: string[];
  selectedMonitorSlots: Record<string, number>;
  startDate: string;
  endDate: string;
  priceInput: string;
  paidInput: string;
  noteInput: string;
};

function SubmitButton({ disabled = false }: { disabled?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button className="primary" disabled={pending || disabled} type="submit">
      {pending ? "Salvataggio..." : "Salva prenotazione"}
    </button>
  );
}

function getPreferredCustomerPrimaryContact(
  customer: Pick<CustomerAutocompleteOption, "phone" | "whatsapp">
) {
  return customer.phone?.trim() || customer.whatsapp?.trim() || "Telefono non inserito";
}

function getPreferredCustomerSecondaryContact(
  customer: Pick<CustomerAutocompleteOption, "email" | "whatsapp" | "phone">
) {
  const primaryContact = customer.phone?.trim() || customer.whatsapp?.trim() || "";
  return customer.email?.trim() || (customer.whatsapp?.trim() && customer.whatsapp?.trim() !== primaryContact ? customer.whatsapp.trim() : "") || "Nessun contatto secondario";
}

export function BillboardBookingForm({
  customers,
  assets,
  existingBookings,
  defaultStartDate,
  defaultEndDate,
  defaultAsset = null
}: {
  customers: CustomerAutocompleteOption[];
  assets: BillboardAssetOption[];
  existingBookings: BillboardBookingSnapshot[];
  defaultStartDate: string;
  defaultEndDate: string;
  defaultAsset?: BillboardAssetOption | null;
}) {
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [assetQuery, setAssetQuery] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>(defaultAsset ? [defaultAsset.id] : []);
  const [selectedMonitorSlots, setSelectedMonitorSlots] = useState<Record<string, number>>({});
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [priceInput, setPriceInput] = useState("");
  const [paidInput, setPaidInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const undoSeededRef = useRef(false);
  const undoRestoringRef = useRef(false);
  const bookingUndo = useUndoHistory<BillboardBookingUndoSnapshot>({
    limit: 40,
    debounceMs: 180
  });
  const {
    canUndo: canUndoBooking,
    undo: undoBooking,
    undoCount: undoBookingCount,
    reset: resetBookingUndo,
    record: recordBookingUndo
  } = bookingUndo;
  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId) || null;
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId) || null;
  const selectedTargets = selectedTargetIds
    .map((targetId) => assets.find((asset) => asset.id === targetId) || null)
    .filter((asset): asset is BillboardAssetOption => asset !== null);
  const pricePreviewCents = parseMoneyDraftToCents(priceInput);
  const paidPreviewCents = parseMoneyDraftToCents(paidInput);
  const balancePreviewCents = Math.max(0, pricePreviewCents - paidPreviewCents);
  const totalValuePreviewCents = pricePreviewCents * selectedTargets.length;
  const totalPaidPreviewCents = paidPreviewCents * selectedTargets.length;
  const totalBalancePreviewCents = Math.max(0, totalValuePreviewCents - totalPaidPreviewCents);

  function captureUndoSnapshot(): BillboardBookingUndoSnapshot {
    return {
      customerQuery,
      selectedCustomerId,
      assetQuery,
      selectedAssetId,
      selectedTargetIds: [...selectedTargetIds],
      selectedMonitorSlots: { ...selectedMonitorSlots },
      startDate,
      endDate,
      priceInput,
      paidInput,
      noteInput
    };
  }

  function restoreUndoSnapshot(snapshot: BillboardBookingUndoSnapshot) {
    undoRestoringRef.current = true;
    setCustomerQuery(snapshot.customerQuery);
    setSelectedCustomerId(snapshot.selectedCustomerId);
    setAssetQuery(snapshot.assetQuery);
    setSelectedAssetId(snapshot.selectedAssetId);
    setSelectedTargetIds([...snapshot.selectedTargetIds]);
    setSelectedMonitorSlots({ ...snapshot.selectedMonitorSlots });
    setStartDate(snapshot.startDate);
    setEndDate(snapshot.endDate);
    setPriceInput(snapshot.priceInput);
    setPaidInput(snapshot.paidInput);
    setNoteInput(snapshot.noteInput);

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        undoRestoringRef.current = false;
      });
    } else {
      undoRestoringRef.current = false;
    }
  }

  const bookingsByAsset = useMemo(() => {
    const map = new Map<string, BillboardBookingSnapshot[]>();
    for (const booking of existingBookings) {
      const bucket = map.get(booking.billboardAssetId);
      if (bucket) {
        bucket.push(booking);
      } else {
        map.set(booking.billboardAssetId, [booking]);
      }
    }

    return map;
  }, [existingBookings]);

  function getOverlappingBookings(assetId: string) {
    const bookings = bookingsByAsset.get(assetId) || [];
    return bookings
      .filter((booking) => rangesOverlap(booking.startsAt, booking.endsAt, startDate, endDate))
      .sort(
        (left, right) =>
          new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime() ||
          left.customerName.localeCompare(right.customerName, "it")
      );
  }

  function getAssetCapacity(kind: BillboardAssetKind) {
    return kind === "MONITOR" ? 6 : 1;
  }

  function getMonitorSlotMap(assetId: string) {
    const overlappingBookings = getOverlappingBookings(assetId);
    const occupied = new Map<number, BillboardBookingSnapshot>();
    const unassigned: BillboardBookingSnapshot[] = [];

    for (const booking of overlappingBookings) {
      if (
        typeof booking.monitorSlot === "number" &&
        booking.monitorSlot >= 1 &&
        booking.monitorSlot <= 6 &&
        !occupied.has(booking.monitorSlot)
      ) {
        occupied.set(booking.monitorSlot, booking);
      } else {
        unassigned.push(booking);
      }
    }

    for (const booking of unassigned) {
      const firstFreeSlot = [1, 2, 3, 4, 5, 6].find((slot) => !occupied.has(slot));
      if (!firstFreeSlot) {
        break;
      }
      occupied.set(firstFreeSlot, booking);
    }

    return occupied;
  }

  function getAvailableMonitorSlots(assetId: string) {
    const occupied = getMonitorSlotMap(assetId);
    return [1, 2, 3, 4, 5, 6].filter((slot) => !occupied.has(slot));
  }

  function buildSlots(asset: BillboardAssetOption) {
    if (asset.kind !== "MONITOR") {
      return [];
    }

    const slotMap = getMonitorSlotMap(asset.id);
    return Array.from({ length: 6 }, (_, index) => slotMap.get(index + 1) || null);
  }

  const selectedAssetOccupancy = selectedAsset ? getOverlappingBookings(selectedAsset.id) : [];
  const selectedAssetCapacity = selectedAsset ? getAssetCapacity(selectedAsset.kind) : 0;
  const selectedAssetHasFreeCapacity =
    selectedAsset ? selectedAssetOccupancy.length < selectedAssetCapacity : false;
  const selectedAssetAvailableSlots = selectedAsset?.kind === "MONITOR" ? getAvailableMonitorSlots(selectedAsset.id) : [];
  const selectedAssetAlreadyAdded = selectedAsset ? selectedTargetIds.includes(selectedAsset.id) : false;
  const conflictingTargetIds = new Set(
    selectedTargets
      .filter((asset) => {
        const overlapping = getOverlappingBookings(asset.id);
        if (asset.kind !== "MONITOR") {
          return overlapping.length >= getAssetCapacity(asset.kind);
        }

        const chosenSlot = selectedMonitorSlots[asset.id];
        if (!chosenSlot) {
          return getAvailableMonitorSlots(asset.id).length === 0;
        }

        return !getAvailableMonitorSlots(asset.id).includes(chosenSlot);
      })
      .map((asset) => asset.id)
  );
  const hasBlockingTargetConflict = conflictingTargetIds.size > 0;

  useEffect(() => {
    const snapshot = captureUndoSnapshot();

    if (!undoSeededRef.current) {
      resetBookingUndo(snapshot);
      undoSeededRef.current = true;
      return;
    }

    if (undoRestoringRef.current) {
      return;
    }

    recordBookingUndo(snapshot);
  }, [
    assetQuery,
    customerQuery,
    endDate,
    noteInput,
    paidInput,
    priceInput,
    recordBookingUndo,
    resetBookingUndo,
    selectedAssetId,
    selectedCustomerId,
    selectedMonitorSlots,
    selectedTargetIds,
    startDate
  ]);

  return (
    <form action={createBillboardBookingAction} className="form-grid billboard-booking-form" encType="multipart/form-data">
      <input name="customerId" type="hidden" value={selectedCustomerId} />
      {selectedTargetIds.map((targetId) => (
        <input key={targetId} name="billboardAssetIds" type="hidden" value={targetId} />
      ))}
      <input name="monitorSlotsPayload" type="hidden" value={JSON.stringify(selectedMonitorSlots)} />

      <CustomerAutocomplete
        customers={customers}
        emptyMessage="Cliente non trovato. Crealo prima nella sezione clienti, poi torna qui per prenotare."
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
        placeholder=""
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
          <div className="subtle">{getPreferredCustomerPrimaryContact(selectedCustomer)}</div>
          <div className="subtle">{getPreferredCustomerSecondaryContact(selectedCustomer)}</div>
        </div>
      ) : null}

      <div className="mini-item billboard-target-picker field full">
        <div className="list-header">
          <div>
            <strong>Impianti</strong>
          </div>
          <span className="pill status">{selectedTargets.length} selezionati</span>
        </div>

        <BillboardAssetAutocomplete
          assets={assets}
          emptyMessage="Nessun impianto corrisponde a questa ricerca. Prova con cartellone, monitor, vela o il codice impianto."
          label="Aggiungi impianto"
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
          placeholder=""
          query={assetQuery}
          selectedAssetId={selectedAssetId}
          showMeta={false}
        />

        <div className="billboard-selected-asset-actions billboard-selected-asset-actions-inline">
          <button
            className="primary"
            disabled={!selectedAsset || !selectedAssetHasFreeCapacity || selectedAssetAlreadyAdded}
            onClick={(event) => {
              event.preventDefault();
              if (!selectedAsset || selectedAssetAlreadyAdded || !selectedAssetHasFreeCapacity) {
                return;
              }

              setSelectedTargetIds((current) => [...current, selectedAsset.id]);
              if (selectedAsset.kind === "MONITOR") {
                const preferredSlot =
                  selectedMonitorSlots[selectedAsset.id] || selectedAssetAvailableSlots[0] || 1;
                setSelectedMonitorSlots((current) => ({
                  ...current,
                  [selectedAsset.id]: preferredSlot
                }));
              }
              setSelectedAssetId("");
              setAssetQuery("");
            }}
            type="button"
          >
            {selectedAsset
              ? selectedAssetAlreadyAdded
                ? "Impianto gia inserito"
                : selectedAssetHasFreeCapacity
                  ? "Aggiungi impianto"
                  : selectedAsset.kind === "MONITOR"
                    ? "Monitor pieno"
                    : "Impianto occupato"
              : "Seleziona un impianto"}
          </button>
        </div>

        {selectedAsset ? (
          <div className="mini-item customer-selection-card billboard-selected-asset-card">
            <div className="list-header">
              <div>
                <strong>{selectedAsset.name}</strong>
                <div className="subtle">
                  {selectedAsset.code} • {billboardAssetKindLabels[selectedAsset.kind]}
                </div>
              </div>
              <div className="billboard-selected-asset-actions">
                <button
                  className="ghost"
                  onClick={(event) => {
                    event.preventDefault();
                    setSelectedAssetId("");
                    setAssetQuery("");
                  }}
                  type="button"
                >
                  Cambia
                </button>
              </div>
            </div>
            <div className="subtle">{selectedAsset.location || "Luogo da definire"}</div>
            {selectedAsset.kind === "MONITOR" ? (
              <>
                <div className="billboard-monitor-slot-picker">
                  {[1, 2, 3, 4, 5, 6].map((slot) => {
                    const slotBooking = buildSlots(selectedAsset)[slot - 1];
                    const isAvailable = !slotBooking;
                    const isSelected = (selectedMonitorSlots[selectedAsset.id] || selectedAssetAvailableSlots[0] || 1) === slot;
                    return (
                      <button
                        className={`billboard-monitor-slot-choice${isSelected ? " is-selected" : ""}${isAvailable ? "" : " is-disabled"}`}
                        disabled={!isAvailable}
                        key={`${selectedAsset.id}-slot-${slot}`}
                        onClick={(event) => {
                          event.preventDefault();
                          if (!isAvailable) {
                            return;
                          }
                          setSelectedMonitorSlots((current) => ({ ...current, [selectedAsset.id]: slot }));
                        }}
                        type="button"
                      >
                        Slot {slot}
                      </button>
                    );
                  })}
                </div>
                <div className="billboard-monitor-slot-grid">
                  {buildSlots(selectedAsset).map((slot, index) => (
                    <div className={`billboard-monitor-slot${slot ? " is-occupied" : " is-free"}`} key={`${selectedAsset.id}-${index + 1}`}>
                      <span className="billboard-monitor-slot-index">Slot {index + 1}</span>
                      <strong>{slot ? slot.customerName : "Libero"}</strong>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="billboard-target-availability">
                {selectedAssetHasFreeCapacity ? (
                  <span className="pill status">Disponibile nel periodo</span>
                ) : (
                  <span className="pill warning">Gia occupato nel periodo</span>
                )}
              </div>
            )}
          </div>
        ) : null}

        {selectedTargets.length > 0 ? (
          <div className="billboard-target-list">
            {selectedTargets.map((asset) => {
              const overlappingBookings = getOverlappingBookings(asset.id);
              const capacity = getAssetCapacity(asset.kind);
              const remaining = Math.max(0, capacity - overlappingBookings.length);
              const isBlocked = conflictingTargetIds.has(asset.id);
              const chosenSlot = selectedMonitorSlots[asset.id] || getAvailableMonitorSlots(asset.id)[0] || 1;

              return (
                <article className="mini-item billboard-target-card" key={asset.id}>
                  <div className="list-header">
                    <div>
                      <strong>{asset.name}</strong>
                      <div className="subtle">
                        {asset.code} • {billboardAssetKindLabels[asset.kind]}
                      </div>
                    </div>
                    <button
                      className="ghost"
                      onClick={(event) => {
                        event.preventDefault();
                        setSelectedTargetIds((current) => current.filter((targetId) => targetId !== asset.id));
                        setSelectedMonitorSlots((current) => {
                          const next = { ...current };
                          delete next[asset.id];
                          return next;
                        });
                      }}
                      type="button"
                    >
                      Rimuovi
                    </button>
                  </div>
                  {asset.kind === "MONITOR" ? (
                    <>
                      <div className="billboard-target-availability">
                        <span className={`pill ${isBlocked ? "warning" : "status"}`}>
                          Occupati {overlappingBookings.length}/6
                        </span>
                        <span className={`pill ${remaining > 0 ? "status" : "warning"}`}>Liberi {remaining}</span>
                        <span className="pill">Slot scelto {chosenSlot}</span>
                      </div>
                      <div className="billboard-monitor-slot-picker compact">
                        {[1, 2, 3, 4, 5, 6].map((slot) => {
                          const slotBooking = buildSlots(asset)[slot - 1];
                          const isAvailable = !slotBooking;
                          const isSelected = chosenSlot === slot;
                          return (
                            <button
                              className={`billboard-monitor-slot-choice${isSelected ? " is-selected" : ""}${isAvailable ? "" : " is-disabled"}`}
                              disabled={!isAvailable}
                              key={`${asset.id}-selected-slot-${slot}`}
                              onClick={(event) => {
                                event.preventDefault();
                                if (!isAvailable) {
                                  return;
                                }
                                setSelectedMonitorSlots((current) => ({ ...current, [asset.id]: slot }));
                              }}
                              type="button"
                            >
                              {slot}
                            </button>
                          );
                        })}
                      </div>
                      <div className="billboard-monitor-slot-grid compact">
                        {buildSlots(asset).map((slot, index) => (
                          <div className={`billboard-monitor-slot${slot ? " is-occupied" : " is-free"}`} key={`${asset.id}-selected-${index + 1}`}>
                            <span className="billboard-monitor-slot-index">{index + 1}</span>
                            <strong>{slot ? slot.customerName : "Libero"}</strong>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="billboard-target-availability">
                      <span className={`pill ${overlappingBookings.length > 0 ? "warning" : "status"}`}>
                        {overlappingBookings.length > 0 ? "Gia occupato" : "Disponibile"}
                      </span>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="field billboard-booking-date-field">
        <label htmlFor="startsAt">Dal</label>
        <input
          className="date-time-input"
          id="startsAt"
          name="startsAt"
          onChange={(event) => setStartDate(event.target.value)}
          required
          type="date"
          value={startDate}
        />
      </div>

      <div className="field billboard-booking-date-field">
        <label htmlFor="endsAt">Al</label>
        <input
          className="date-time-input"
          id="endsAt"
          name="endsAt"
          onChange={(event) => setEndDate(event.target.value)}
          required
          type="date"
          value={endDate}
        />
      </div>

      <div className="field billboard-booking-money-field">
        <label htmlFor="price">Valore per impianto</label>
        <input
          className="currency-input"
          id="price"
          inputMode="decimal"
          name="price"
          onChange={(event) => setPriceInput(event.target.value)}
          type="text"
          value={priceInput}
        />
      </div>

      <div className="field billboard-booking-money-field">
        <label htmlFor="paid">Incassato per impianto</label>
        <input
          className="currency-input"
          id="paid"
          inputMode="decimal"
          name="paid"
          onChange={(event) => setPaidInput(event.target.value)}
          type="text"
          value={paidInput}
        />
      </div>

      <div className="mini-item billboard-booking-balance-card field full">
        <div className="list-header">
          <div>
            <strong>Riepilogo</strong>
          </div>
          <span className={`pill ${totalBalancePreviewCents > 0 ? "warning" : "status"}`}>
            Saldo totale {formatCurrency(totalBalancePreviewCents)}
          </span>
        </div>
        <div className="billboard-booking-financials">
          <span>Impianti {selectedTargets.length}</span>
          <span>Valore totale {formatCurrency(totalValuePreviewCents)}</span>
          <span>Incassato totale {formatCurrency(totalPaidPreviewCents)}</span>
          <span>Residuo totale {formatCurrency(totalBalancePreviewCents)}</span>
        </div>
        {hasBlockingTargetConflict ? (
          <div className="subtle">
            Almeno un impianto selezionato non e piu disponibile nel periodo scelto. Rimuovilo o cambia date.
          </div>
        ) : null}
      </div>

      <div className="field full">
        <label htmlFor="note">Note</label>
        <textarea id="note" name="note" onChange={(event) => setNoteInput(event.target.value)} value={noteInput} />
      </div>

      <div className="button-row billboard-booking-submit-row">
        <button
          className="ghost undo-action-button"
          disabled={!canUndoBooking}
          onClick={(event) => {
            event.preventDefault();
            if (!canUndoBooking) {
              return;
            }
            if (!window.confirm("Vuoi annullare l'ultima modifica della prenotazione?")) {
              return;
            }
            const snapshot = undoBooking();
            if (!snapshot) {
              return;
            }
            restoreUndoSnapshot(snapshot);
          }}
          type="button"
        >
          <UndoButtonContent count={canUndoBooking ? undoBookingCount : undefined} label="Indietro" />
        </button>
        <SubmitButton disabled={selectedTargets.length === 0 || hasBlockingTargetConflict} />
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

function rangesOverlap(leftStart: string, leftEnd: string, rightStart: string, rightEnd: string) {
  if (!leftStart || !leftEnd || !rightStart || !rightEnd) {
    return false;
  }

  return new Date(`${leftStart}T12:00:00`).getTime() <= new Date(`${rightEnd}T12:00:00`).getTime() &&
    new Date(`${leftEnd}T12:00:00`).getTime() >= new Date(`${rightStart}T12:00:00`).getTime();
}
