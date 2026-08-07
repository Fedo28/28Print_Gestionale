"use client";

import { BillboardAssetKind, CustomerType } from "@prisma/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  createBillboardBookingAction,
  deleteBillboardBookingAction,
  updateBillboardBookingAction
} from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { CustomerAutocomplete, CustomerAutocompleteOption } from "@/components/customer-autocomplete";
import { UndoButtonContent } from "@/components/undo-button-content";
import { useUndoHistory } from "@/components/use-undo-history";
import { rankBillboardAssets } from "@/lib/billboard-asset-search";
import { billboardAssetKindLabels, customerTypeLabels } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";

type BillboardAssetOption = {
  id: string;
  code: string;
  name: string;
  kind: BillboardAssetKind;
  location?: string | null;
};

type BillboardBookingSnapshot = {
  id: string;
  billboardAssetId: string;
  customerName: string;
  monitorSlot?: number | null;
  startsAt: string;
  endsAt: string;
};

type BillboardBookingFormMode = "create" | "update";

type BillboardBookingFormDefaultBooking = {
  id: string;
  billboardAssetId: string;
  customerId: string;
  customerName: string;
  monitorSlot?: number | null;
  startsAt: string;
  endsAt: string;
  priceInput: string;
  paidInput: string;
  note: string;
};

type BillboardInlineCustomerDraft = {
  type: CustomerType;
  phone: string;
  whatsapp: string;
  email: string;
  pec: string;
  taxCode: string;
  vatNumber: string;
  uniqueCode: string;
  notes: string;
};

type BillboardBookingUndoSnapshot = {
  customerQuery: string;
  selectedCustomerId: string;
  customerDraft: BillboardInlineCustomerDraft;
  assetQuery: string;
  selectedTargetIds: string[];
  selectedMonitorSlots: Record<string, number>;
  startDate: string;
  endDate: string;
  priceInput: string;
  paidInput: string;
  noteInput: string;
};

function SubmitButton({
  disabled = false,
  mode,
  selectionCount
}: {
  disabled?: boolean;
  mode: BillboardBookingFormMode;
  selectionCount: number;
}) {
  const { pending } = useFormStatus();
  const idleLabel = mode === "update"
    ? "Salva modifiche"
    : selectionCount > 1
      ? `Prenota ${selectionCount} plance`
      : "Salva prenotazione";

  return (
    <button className="primary" disabled={pending || disabled} type="submit">
      {pending ? "Salvataggio..." : idleLabel}
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
  return (
    customer.email?.trim() ||
    (customer.whatsapp?.trim() && customer.whatsapp?.trim() !== primaryContact ? customer.whatsapp.trim() : "") ||
    "Nessun contatto secondario"
  );
}

function createEmptyInlineCustomerDraft(type: CustomerType = "PUBBLICO"): BillboardInlineCustomerDraft {
  return {
    type,
    phone: "",
    whatsapp: "",
    email: "",
    pec: "",
    taxCode: "",
    vatNumber: "",
    uniqueCode: "",
    notes: ""
  };
}

export function BillboardBookingForm({
  customers,
  assets,
  existingBookings,
  defaultStartDate = "",
  defaultEndDate = "",
  defaultAsset = null,
  defaultBooking = null,
  mode = "create"
}: {
  customers: CustomerAutocompleteOption[];
  assets: BillboardAssetOption[];
  existingBookings: BillboardBookingSnapshot[];
  defaultStartDate?: string;
  defaultEndDate?: string;
  defaultAsset?: BillboardAssetOption | null;
  defaultBooking?: BillboardBookingFormDefaultBooking | null;
  mode?: BillboardBookingFormMode;
}) {
  const initialSelectedCustomer =
    defaultBooking?.customerId ? customers.find((customer) => customer.id === defaultBooking.customerId) || null : null;
  const initialTargetIds = Array.from(
    new Set(
      [
        defaultBooking?.billboardAssetId || "",
        !defaultBooking && defaultAsset ? defaultAsset.id : ""
      ].filter(Boolean)
    )
  );
  const ignoredBookingId = mode === "update" ? defaultBooking?.id || null : null;
  const [customerQuery, setCustomerQuery] = useState(defaultBooking?.customerName || "");
  const [selectedCustomerId, setSelectedCustomerId] = useState(defaultBooking?.customerId || "");
  const [customerDraft, setCustomerDraft] = useState<BillboardInlineCustomerDraft>(
    createEmptyInlineCustomerDraft(initialSelectedCustomer?.type || "PUBBLICO")
  );
  const [assetQuery, setAssetQuery] = useState("");
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>(initialTargetIds);
  const [selectedMonitorSlots, setSelectedMonitorSlots] = useState<Record<string, number>>(
    defaultBooking?.billboardAssetId && defaultBooking.monitorSlot
      ? {
          [defaultBooking.billboardAssetId]: defaultBooking.monitorSlot
        }
      : {}
  );
  const [startDate, setStartDate] = useState(defaultBooking?.startsAt || defaultStartDate);
  const [endDate, setEndDate] = useState(defaultBooking?.endsAt || defaultEndDate);
  const [priceInput, setPriceInput] = useState(defaultBooking?.priceInput || "");
  const [paidInput, setPaidInput] = useState(defaultBooking?.paidInput || "");
  const [noteInput, setNoteInput] = useState(defaultBooking?.note || "");
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
  const selectedTargets = selectedTargetIds
    .map((targetId) => assets.find((asset) => asset.id === targetId) || null)
    .filter((asset): asset is BillboardAssetOption => asset !== null);
  const selectedMonitorTargets = selectedTargets.filter((asset) => asset.kind === "MONITOR");
  const visibleAssets = useMemo(() => rankBillboardAssets(assets, assetQuery), [assetQuery, assets]);
  const trimmedCustomerQuery = customerQuery.trim();
  const hasSelectedDates = Boolean(startDate && endDate);
  const pricePreviewCents = parseMoneyDraftToCents(priceInput);
  const paidPreviewCents = parseMoneyDraftToCents(paidInput);
  const totalValuePreviewCents = pricePreviewCents * selectedTargets.length;
  const totalPaidPreviewCents = paidPreviewCents * selectedTargets.length;
  const totalBalancePreviewCents = Math.max(0, totalValuePreviewCents - totalPaidPreviewCents);

  function captureUndoSnapshot(): BillboardBookingUndoSnapshot {
    return {
      customerQuery,
      selectedCustomerId,
      customerDraft: { ...customerDraft },
      assetQuery,
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
    setCustomerDraft({ ...snapshot.customerDraft });
    setAssetQuery(snapshot.assetQuery);
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
    if (!hasSelectedDates) {
      return [];
    }

    const bookings = bookingsByAsset.get(assetId) || [];
    return bookings
      .filter((booking) => booking.id !== ignoredBookingId && rangesOverlap(booking.startsAt, booking.endsAt, startDate, endDate))
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
    if (!hasSelectedDates) {
      return [1, 2, 3, 4, 5, 6];
    }

    const occupied = getMonitorSlotMap(assetId);
    return [1, 2, 3, 4, 5, 6].filter((slot) => !occupied.has(slot));
  }

  function buildSlots(asset: BillboardAssetOption) {
    if (asset.kind !== "MONITOR" || !hasSelectedDates) {
      return [];
    }

    const slotMap = getMonitorSlotMap(asset.id);
    return Array.from({ length: 6 }, (_, index) => slotMap.get(index + 1) || null);
  }

  function isTargetBlocked(asset: BillboardAssetOption) {
    if (!hasSelectedDates) {
      return false;
    }

    const overlappingBookings = getOverlappingBookings(asset.id);
    if (asset.kind !== "MONITOR") {
      return overlappingBookings.length >= getAssetCapacity(asset.kind);
    }

    const availableSlots = getAvailableMonitorSlots(asset.id);
    const chosenSlot = selectedMonitorSlots[asset.id];

    if (!chosenSlot) {
      return availableSlots.length === 0;
    }

    return !availableSlots.includes(chosenSlot);
  }

  function applyAssetSelection(asset: BillboardAssetOption) {
    setSelectedTargetIds((current) => {
      if (mode === "update") {
        return [asset.id];
      }

      if (current.includes(asset.id)) {
        return current;
      }

      return [...current, asset.id];
    });

    setSelectedMonitorSlots((current) => {
      const next = mode === "update" ? {} : { ...current };

      if (asset.kind === "MONITOR") {
        const availableSlots = getAvailableMonitorSlots(asset.id);
        const currentSlot = current[asset.id];
        if (typeof currentSlot === "number" && availableSlots.includes(currentSlot)) {
          next[asset.id] = currentSlot;
        } else if (availableSlots[0]) {
          next[asset.id] = availableSlots[0];
        } else {
          delete next[asset.id];
        }
      } else {
        delete next[asset.id];
      }

      return next;
    });

  }

  function removeAssetSelection(assetId: string) {
    setSelectedTargetIds((current) => current.filter((targetId) => targetId !== assetId));
    setSelectedMonitorSlots((current) => {
      const next = { ...current };
      delete next[assetId];
      return next;
    });
  }

  function toggleAssetSelection(asset: BillboardAssetOption) {
    if (mode === "create" && selectedTargetIds.includes(asset.id)) {
      removeAssetSelection(asset.id);
      return;
    }

    applyAssetSelection(asset);
  }

  const conflictingTargetIds = new Set(
    hasSelectedDates ? selectedTargets.filter((asset) => isTargetBlocked(asset)).map((asset) => asset.id) : []
  );
  const hasBlockingTargetConflict = hasSelectedDates && conflictingTargetIds.size > 0;

  useEffect(() => {
    if (selectedCustomerId && !selectedCustomer) {
      setSelectedCustomerId("");
    }
  }, [selectedCustomer, selectedCustomerId]);

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
    customerDraft,
    customerQuery,
    endDate,
    noteInput,
    paidInput,
    priceInput,
    recordBookingUndo,
    resetBookingUndo,
    selectedCustomerId,
    selectedMonitorSlots,
    selectedTargetIds,
    startDate
  ]);

  function findExactCustomerMatch(value: string) {
    const normalizedValue = value.trim().toLocaleLowerCase("it-IT");
    if (!normalizedValue) {
      return null;
    }

    return (
      customers.find((customer) => customer.name.trim().toLocaleLowerCase("it-IT") === normalizedValue) || null
    );
  }

  function clearSelectedCustomer() {
    setSelectedCustomerId("");
    setCustomerQuery("");
    setCustomerDraft((current) => createEmptyInlineCustomerDraft(current.type));
  }

  const activeAction = mode === "update" ? updateBillboardBookingAction : createBillboardBookingAction;

  return (
    <div className="stack">
      <form action={activeAction} className="form-grid billboard-booking-form">
        {mode === "update" && defaultBooking ? (
          <>
            <input name="bookingId" type="hidden" value={defaultBooking.id} />
            <input name="billboardAssetId" type="hidden" value={selectedTargets[0]?.id || ""} />
          </>
        ) : (
          selectedTargetIds.map((targetId) => (
            <input key={targetId} name="billboardAssetIds" type="hidden" value={targetId} />
          ))
        )}
        <input name="customerId" type="hidden" value={selectedCustomerId} />
        <input name="monitorSlotsPayload" type="hidden" value={JSON.stringify(selectedMonitorSlots)} />

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

        <CustomerAutocomplete
          customers={customers}
          emptyMessage="Cliente non trovato."
          label="Cliente"
          onQueryChange={(value) => {
            const exactMatch = findExactCustomerMatch(value);
            if (exactMatch) {
              setSelectedCustomerId(exactMatch.id);
              setCustomerQuery(exactMatch.name);
              return;
            }

            setCustomerQuery(value);
            if (selectedCustomerId) {
              setSelectedCustomerId("");
            }
          }}
          onSelect={(customer) => {
            setSelectedCustomerId(customer.id);
            setCustomerQuery(customer.name);
            setCustomerDraft((current) => ({
              ...createEmptyInlineCustomerDraft(customer.type),
              type: current.type
            }));
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
                  clearSelectedCustomer();
                }}
                type="button"
              >
                Crea nuovo
              </button>
            </div>
            <div className="subtle">{getPreferredCustomerPrimaryContact(selectedCustomer)}</div>
            <div className="subtle">{getPreferredCustomerSecondaryContact(selectedCustomer)}</div>
          </div>
        ) : (
          <>
            <input name="customerName" type="hidden" value={trimmedCustomerQuery} />
            <div className="field">
              <label htmlFor="customerType">Tipo cliente</label>
              <select
                id="customerType"
                name="customerType"
                onChange={(event) =>
                  setCustomerDraft((current) => ({
                    ...current,
                    type: event.target.value as CustomerType
                  }))
                }
                value={customerDraft.type}
              >
                {Object.entries(customerTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="customerPhone">Telefono</label>
              <input
                id="customerPhone"
                name="customerPhone"
                onChange={(event) =>
                  setCustomerDraft((current) => ({
                    ...current,
                    phone: event.target.value
                  }))
                }
                value={customerDraft.phone}
              />
            </div>
            <div className="field">
              <label htmlFor="customerWhatsapp">WhatsApp</label>
              <input
                id="customerWhatsapp"
                name="customerWhatsapp"
                onChange={(event) =>
                  setCustomerDraft((current) => ({
                    ...current,
                    whatsapp: event.target.value
                  }))
                }
                value={customerDraft.whatsapp}
              />
            </div>
            <details className="field full order-advanced-disclosure">
              <summary>Info avanzate</summary>
              <div className="form-grid order-advanced-grid">
                <div className="field wide">
                  <label htmlFor="customerEmail">Email</label>
                  <input
                    id="customerEmail"
                    name="customerEmail"
                    onChange={(event) =>
                      setCustomerDraft((current) => ({
                        ...current,
                        email: event.target.value
                      }))
                    }
                    type="email"
                    value={customerDraft.email}
                  />
                </div>
                <div className="field wide">
                  <label htmlFor="customerPec">PEC</label>
                  <input
                    id="customerPec"
                    name="customerPec"
                    onChange={(event) =>
                      setCustomerDraft((current) => ({
                        ...current,
                        pec: event.target.value
                      }))
                    }
                    type="email"
                    value={customerDraft.pec}
                  />
                </div>
                <div className="field">
                  <label htmlFor="customerVatNumber">P. IVA</label>
                  <input
                    id="customerVatNumber"
                    name="customerVatNumber"
                    onChange={(event) =>
                      setCustomerDraft((current) => ({
                        ...current,
                        vatNumber: event.target.value
                      }))
                    }
                    value={customerDraft.vatNumber}
                  />
                </div>
                <div className="field">
                  <label htmlFor="customerTaxCode">Codice fiscale</label>
                  <input
                    id="customerTaxCode"
                    name="customerTaxCode"
                    onChange={(event) =>
                      setCustomerDraft((current) => ({
                        ...current,
                        taxCode: event.target.value
                      }))
                    }
                    value={customerDraft.taxCode}
                  />
                </div>
                <div className="field">
                  <label htmlFor="customerUniqueCode">Codice univoco (CU)</label>
                  <input
                    id="customerUniqueCode"
                    name="customerUniqueCode"
                    onChange={(event) =>
                      setCustomerDraft((current) => ({
                        ...current,
                        uniqueCode: event.target.value
                      }))
                    }
                    value={customerDraft.uniqueCode}
                  />
                </div>
              </div>
            </details>
            <div className="field full">
              <label htmlFor="customerNotes">Note cliente</label>
              <textarea
                id="customerNotes"
                name="customerNotes"
                onChange={(event) =>
                  setCustomerDraft((current) => ({
                    ...current,
                    notes: event.target.value
                  }))
                }
                value={customerDraft.notes}
              />
            </div>
          </>
        )}

        <div className="mini-item billboard-target-picker field full">
          <div className="list-header">
            <div>
              <strong>Plance</strong>
            </div>
            <span className="pill status">
              {selectedTargets.length} {selectedTargets.length === 1 ? "selezionata" : "selezionate"}
            </span>
          </div>

          {hasSelectedDates ? (
            <>
              <div className="field full billboard-multi-select-search">
                <label htmlFor="billboardAssetSearch">Cerca plancia</label>
                <input
                  autoComplete="off"
                  id="billboardAssetSearch"
                  onChange={(event) => setAssetQuery(event.target.value)}
                  spellCheck={false}
                  value={assetQuery}
                />
              </div>
              {visibleAssets.length > 0 ? (
                <div className="billboard-multi-select-grid" aria-label="Seleziona plance">
                  {visibleAssets.map((asset) => {
                    const isSelected = selectedTargetIds.includes(asset.id);
                    const isBlocked = isTargetBlocked(asset);
                    const availableMonitorSlots = asset.kind === "MONITOR" ? getAvailableMonitorSlots(asset.id).length : 0;
                    const availabilityLabel = isBlocked
                      ? "Occupata"
                      : isSelected
                        ? "Selezionata"
                        : asset.kind === "MONITOR"
                          ? `${availableMonitorSlots} slot liberi`
                          : "Libera";

                    return (
                      <button
                        aria-pressed={isSelected}
                        className={`billboard-multi-select-option${isSelected ? " is-selected" : ""}${isBlocked ? " is-blocked" : ""}`}
                        disabled={isBlocked && !isSelected}
                        key={asset.id}
                        onClick={() => toggleAssetSelection(asset)}
                        type="button"
                      >
                        <span className="billboard-multi-select-copy">
                          <strong>{asset.name}</strong>
                          <span>{asset.code}</span>
                        </span>
                        <span className="billboard-multi-select-status">{availabilityLabel}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="empty billboard-multi-select-empty">Nessuna plancia</div>
              )}
            </>
          ) : null}

          {selectedMonitorTargets.length > 0 ? (
            <div className="billboard-target-list">
              {selectedMonitorTargets.map((asset) => {
                const overlappingBookings = getOverlappingBookings(asset.id);
                const isBlocked = conflictingTargetIds.has(asset.id);
                const availableSlots = getAvailableMonitorSlots(asset.id);
                const chosenSlot = selectedMonitorSlots[asset.id] || availableSlots[0] || 1;
                const occupiedSlots = asset.kind === "MONITOR" ? overlappingBookings.length : overlappingBookings.length > 0 ? 1 : 0;

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
                          removeAssetSelection(asset.id);
                        }}
                        type="button"
                      >
                        {mode === "update" ? "Svuota" : "Rimuovi"}
                      </button>
                    </div>
                    <div className="subtle">{asset.location || "Luogo da definire"}</div>

                    {hasSelectedDates ? (
                      asset.kind === "MONITOR" ? (
                        <>
                          <div className="billboard-target-availability">
                            <span className={`pill ${isBlocked ? "warning" : "status"}`}>Occupati {occupiedSlots}/6</span>
                            <span className={`pill ${availableSlots.length > 0 ? "status" : "warning"}`}>
                              Liberi {Math.max(0, 6 - occupiedSlots)}
                            </span>
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
                                  key={`${asset.id}-slot-${slot}`}
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
                              <div className={`billboard-monitor-slot${slot ? " is-occupied" : " is-free"}`} key={`${asset.id}-${index + 1}`}>
                                <span className="billboard-monitor-slot-index">{index + 1}</span>
                                <strong>{slot ? slot.customerName : "Libero"}</strong>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="billboard-target-availability">
                          <span className={`pill ${isBlocked ? "warning" : "status"}`}>
                            {isBlocked ? "Gia occupato nel periodo" : "Disponibile nel periodo"}
                          </span>
                        </div>
                      )
                    ) : null}

                    {hasSelectedDates && overlappingBookings.length > 0 ? (
                      <div className="subtle">
                        {asset.kind === "MONITOR"
                          ? `Nel periodo sono gia presenti: ${overlappingBookings.map((booking) => booking.customerName).join(" • ")}`
                          : `Occupato da ${overlappingBookings[0]?.customerName || "un altro cliente"} nel periodo selezionato.`}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : null}
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
            <span>Plance {selectedTargets.length}</span>
            <span>Valore totale {formatCurrency(totalValuePreviewCents)}</span>
            <span>Incassato totale {formatCurrency(totalPaidPreviewCents)}</span>
            <span>Residuo totale {formatCurrency(totalBalancePreviewCents)}</span>
          </div>
          {hasBlockingTargetConflict ? (
            <div className="subtle">Impianto non disponibile nel periodo selezionato.</div>
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
          <SubmitButton
            disabled={!hasSelectedDates || selectedTargets.length === 0 || hasBlockingTargetConflict}
            mode={mode}
            selectionCount={selectedTargets.length}
          />
        </div>
      </form>

      {mode === "update" && defaultBooking ? (
        <form action={deleteBillboardBookingAction} className="billboard-booking-delete-form">
          <input name="bookingId" type="hidden" value={defaultBooking.id} />
          <ConfirmSubmitButton
            className="button danger"
            confirmMessage="Vuoi eliminare questa plancia prenotata? L'operazione non puo essere annullata."
          >
            Elimina plancia
          </ConfirmSubmitButton>
        </form>
      ) : null}
    </div>
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
