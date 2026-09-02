"use client";

import { BillboardAssetKind, CustomerType } from "@prisma/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  createBillboardBookingAction,
  deleteBillboardBookingAction,
  updateBillboardBookingAction
} from "@/app/actions";
import {
  BILLBOARD_MIN_BOOKING_DAYS,
  BillboardPackagePresetValue,
  addDaysToDateKey,
  computeBillboardUnitPriceCents,
  getBillboardPresetMeta,
  getSuggestedPackageUnits
} from "@/lib/billboard-pricing";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { CustomerAutocomplete, CustomerAutocompleteOption } from "@/components/customer-autocomplete";
import { UndoButtonContent } from "@/components/undo-button-content";
import { useUndoHistory } from "@/components/use-undo-history";
import { rankBillboardAssets } from "@/lib/billboard-asset-search";
import { billboardAssetKindLabels, customerTypeLabels } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import { parseFlexibleAdjustmentInput } from "@/lib/pricing";

type BillboardAssetOption = {
  id: string;
  code: string;
  name: string;
  kind: BillboardAssetKind;
  location?: string | null;
};

type BillboardCustomerPackageOption = {
  id: string;
  customerId: string;
  label: string;
  preset: BillboardPackagePresetValue;
  purchasedUnits: number;
  usedUnits: number;
  remainingUnits: number;
  unitPriceCents: number;
  note: string | null;
};

type BillboardBookingSnapshot = {
  id: string;
  billboardAssetId: string;
  customerName: string;
  monitorSlot?: number | null;
  startsAt: string;
  endsAt: string;
};

type BillboardPricingMode = "SINGLE" | "EXISTING_PACKAGE" | BillboardPackagePresetValue;
type BillboardBookingFormMode = "create" | "update";

type BillboardBookingFormDefaultBooking = {
  id: string;
  billboardAssetId: string;
  billboardCustomerPackageId?: string | null;
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
  pricingMode: BillboardPricingMode;
  selectedPackageId: string;
  basePriceInput: string;
  discountInput: string;
  packageUnitsInput: string;
  packageNoteInput: string;
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

function resolveInitialPricingMode(
  defaultBooking: BillboardBookingFormDefaultBooking | null,
  customerPackages: BillboardCustomerPackageOption[],
  defaultPricingMode: BillboardPricingMode
): BillboardPricingMode {
  if (!defaultBooking?.billboardCustomerPackageId) {
    return defaultPricingMode;
  }

  const customerPackage = customerPackages.find((entry) => entry.id === defaultBooking.billboardCustomerPackageId);
  return customerPackage ? "EXISTING_PACKAGE" : "SINGLE";
}

function formatPriceInput(cents: number) {
  if (!cents) {
    return "";
  }

  return (Math.max(cents, 0) / 100).toFixed(2).replace(".", ",");
}

export function BillboardBookingForm({
  customers,
  assets,
  customerPackages,
  existingBookings,
  defaultStartDate = "",
  defaultEndDate = "",
  defaultAsset = null,
  defaultBooking = null,
  defaultCustomerId = "",
  defaultCustomerName = "",
  defaultPricingMode = "SINGLE",
  defaultSelectedPackageId = "",
  fixedKind = null,
  mode = "create"
}: {
  customers: CustomerAutocompleteOption[];
  assets: BillboardAssetOption[];
  customerPackages: BillboardCustomerPackageOption[];
  existingBookings: BillboardBookingSnapshot[];
  defaultStartDate?: string;
  defaultEndDate?: string;
  defaultAsset?: BillboardAssetOption | null;
  defaultBooking?: BillboardBookingFormDefaultBooking | null;
  defaultCustomerId?: string;
  defaultCustomerName?: string;
  defaultPricingMode?: BillboardPricingMode;
  defaultSelectedPackageId?: string;
  fixedKind?: BillboardAssetKind | null;
  mode?: BillboardBookingFormMode;
}) {
  const fixedKindAssets = fixedKind ? assets.filter((asset) => asset.kind === fixedKind) : assets;
  const fixedDefaultAsset = defaultAsset && (!fixedKind || defaultAsset.kind === fixedKind)
    ? defaultAsset
    : defaultBooking
      ? assets.find((asset) => asset.id === defaultBooking.billboardAssetId && (!fixedKind || asset.kind === fixedKind)) || null
      : fixedKindAssets[0] || null;
  const initialSelectedCustomer =
    (defaultBooking?.customerId
      ? customers.find((customer) => customer.id === defaultBooking.customerId)
      : defaultCustomerId
        ? customers.find((customer) => customer.id === defaultCustomerId)
        : null) || null;
  const initialTargetIds = Array.from(
    new Set(
      [
        defaultBooking?.billboardAssetId || "",
        !defaultBooking && fixedDefaultAsset ? fixedDefaultAsset.id : ""
      ].filter(Boolean)
    )
  );
  const ignoredBookingId = mode === "update" ? defaultBooking?.id || null : null;
  const isMonitorOnlyForm = fixedKind === "MONITOR";
  const isVelaOnlyForm = fixedKind === "VELA_ITINERANTE";
  const isSpecialFixedKind = isMonitorOnlyForm || isVelaOnlyForm;
  const isSingleFixedAssetForm = Boolean(fixedKind && fixedKindAssets.length === 1);
  const initialPricingMode = resolveInitialPricingMode(defaultBooking, customerPackages, defaultPricingMode);
  const initialPackage = defaultBooking?.billboardCustomerPackageId
    ? customerPackages.find((entry) => entry.id === defaultBooking.billboardCustomerPackageId) || null
    : defaultSelectedPackageId
      ? customerPackages.find((entry) => entry.id === defaultSelectedPackageId) || null
      : null;
  const initialBasePriceInput = defaultBooking?.priceInput || formatPriceInput(
    initialPackage?.unitPriceCents ||
      getBillboardPresetMeta(
        isMonitorOnlyForm
          ? "SINGLE"
          : initialPricingMode === "EXISTING_PACKAGE"
            ? "SINGLE"
            : initialPricingMode
      ).unitPriceCents
  );
  const [customerQuery, setCustomerQuery] = useState(defaultBooking?.customerName || defaultCustomerName || "");
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialSelectedCustomer?.id || "");
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
  const [pricingMode, setPricingMode] = useState<BillboardPricingMode>(isMonitorOnlyForm ? "SINGLE" : initialPricingMode);
  const [selectedPackageId, setSelectedPackageId] = useState(initialPackage?.id || "");
  const [basePriceInput, setBasePriceInput] = useState(initialBasePriceInput);
  const [discountInput, setDiscountInput] = useState("");
  const [packageUnitsInput, setPackageUnitsInput] = useState(
    initialPackage
      ? String(initialPackage.purchasedUnits)
      : String(getSuggestedPackageUnits(initialPricingMode === "EXISTING_PACKAGE" ? "SINGLE" : initialPricingMode, initialTargetIds.length || 1))
  );
  const [packageNoteInput, setPackageNoteInput] = useState(initialPackage?.note || "");
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
  const activeAction = mode === "update" ? updateBillboardBookingAction : createBillboardBookingAction;
  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId) || null;
  const selectedCustomerPackages = useMemo(
    () =>
      customerPackages
        .filter((entry) => entry.customerId === selectedCustomerId && (entry.remainingUnits > 0 || entry.id === selectedPackageId))
        .sort((left, right) => right.remainingUnits - left.remainingUnits || left.label.localeCompare(right.label, "it")),
    [customerPackages, selectedCustomerId, selectedPackageId]
  );
  const selectedPackage = selectedCustomerPackages.find((entry) => entry.id === selectedPackageId) || null;
  const selectedTargets = selectedTargetIds
    .map((targetId) => assets.find((asset) => asset.id === targetId) || null)
    .filter((asset): asset is BillboardAssetOption => asset !== null);
  const hasSelectedDates = Boolean(startDate && endDate);
  const visibleAssets = useMemo(() => rankBillboardAssets(fixedKindAssets, assetQuery), [assetQuery, fixedKindAssets]);
  const trimmedCustomerQuery = customerQuery.trim();
  const discountState = useMemo(() => parseFlexibleAdjustmentInput(discountInput, "AMOUNT"), [discountInput]);
  const resolvedBasePriceCents = selectedPackage
    ? parseMoneyDraftToCents(basePriceInput) || selectedPackage.unitPriceCents
    : parseMoneyDraftToCents(basePriceInput);
  const effectiveUnitPriceCents = computeBillboardUnitPriceCents(
    resolvedBasePriceCents,
    discountState.mode,
    discountState.value
  );
  const priceInput = formatPriceInput(effectiveUnitPriceCents);
  const paidPreviewCents = parseMoneyDraftToCents(paidInput);
  const totalValuePreviewCents = effectiveUnitPriceCents * selectedTargets.length;
  const totalPaidPreviewCents = paidPreviewCents * selectedTargets.length;
  const totalBalancePreviewCents = Math.max(0, totalValuePreviewCents - totalPaidPreviewCents);
  const suggestionEndDate = startDate ? addDaysToDateKey(startDate, BILLBOARD_MIN_BOOKING_DAYS - 1) : "";
  const bookingDurationDays = getBookingDurationDays(startDate, endDate);
  const isBelowSuggestedDuration = bookingDurationDays > 0 && bookingDurationDays < BILLBOARD_MIN_BOOKING_DAYS;
  const includedTargetCount = Math.max(selectedTargets.length, mode === "update" ? 1 : 0);
  const selectedMonitorSlotLabel = selectedTargets[0] ? selectedMonitorSlots[selectedTargets[0].id] || 1 : 1;

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
      pricingMode,
      selectedPackageId,
      basePriceInput,
      discountInput,
      packageUnitsInput,
      packageNoteInput,
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
    setPricingMode(snapshot.pricingMode);
    setSelectedPackageId(snapshot.selectedPackageId);
    setBasePriceInput(snapshot.basePriceInput);
    setDiscountInput(snapshot.discountInput);
    setPackageUnitsInput(snapshot.packageUnitsInput);
    setPackageNoteInput(snapshot.packageNoteInput);
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
  const isExistingPackageMode = pricingMode === "EXISTING_PACKAGE";
  const isNewPackageMode = pricingMode !== "SINGLE" && !isExistingPackageMode;
  const existingPackageOffset = mode === "update" && defaultBooking?.billboardCustomerPackageId === selectedPackage?.id ? 1 : 0;
  const selectedPackageRemainingAfterSelection = selectedPackage
    ? selectedPackage.remainingUnits + existingPackageOffset - includedTargetCount
    : null;
  const draftedPackageUnits = parsePackageUnitsInput(packageUnitsInput, pricingMode, includedTargetCount);
  const newPackageRemainingAfterSelection = isNewPackageMode
    ? draftedPackageUnits - includedTargetCount
    : null;
  const hasPackageCreditConflict = isExistingPackageMode
    ? Boolean(selectedPackage && selectedPackageRemainingAfterSelection !== null && selectedPackageRemainingAfterSelection < 0)
    : isNewPackageMode
      ? newPackageRemainingAfterSelection !== null && newPackageRemainingAfterSelection < 0
      : false;
  const isUpdateMode = mode === "update";
  const isSubmitDisabled =
    !hasSelectedDates ||
    selectedTargets.length === 0 ||
    hasBlockingTargetConflict ||
    hasPackageCreditConflict ||
    effectiveUnitPriceCents <= 0;
  const stepCardClassName = `mini-item billboard-booking-step-card${isUpdateMode || isSpecialFixedKind ? " billboard-booking-step-card-half" : " full"}`;

  useEffect(() => {
    if (!isSingleFixedAssetForm) {
      return;
    }

    if (selectedTargetIds.length === 0 && fixedKindAssets[0]) {
      applyAssetSelection(fixedKindAssets[0]);
    }
  }, [fixedKindAssets, isSingleFixedAssetForm, selectedTargetIds.length]);

  useEffect(() => {
    if (selectedCustomerId && !selectedCustomer) {
      setSelectedCustomerId("");
    }
  }, [selectedCustomer, selectedCustomerId]);

  useEffect(() => {
    if (startDate && (!endDate || endDate < startDate)) {
      setEndDate(suggestionEndDate);
    }
  }, [endDate, startDate, suggestionEndDate]);

  useEffect(() => {
    if (!isMonitorOnlyForm) {
      return;
    }

    if (pricingMode !== "SINGLE") {
      setPricingMode("SINGLE");
    }

    if (selectedPackageId) {
      setSelectedPackageId("");
    }
  }, [fixedKindAssets, isMonitorOnlyForm, pricingMode, selectedPackageId, selectedTargetIds.length]);

  useEffect(() => {
    if (!selectedCustomerId && pricingMode === "EXISTING_PACKAGE") {
      setPricingMode("SINGLE");
      setSelectedPackageId("");
    }
  }, [pricingMode, selectedCustomerId]);

  useEffect(() => {
    if (pricingMode !== "EXISTING_PACKAGE") {
      return;
    }

    if (selectedCustomerPackages.length === 0) {
      setPricingMode("SINGLE");
      setSelectedPackageId("");
      return;
    }

    if (!selectedPackageId || !selectedCustomerPackages.some((entry) => entry.id === selectedPackageId)) {
      const nextPackage = selectedCustomerPackages[0];
      setSelectedPackageId(nextPackage.id);
      setBasePriceInput(formatPriceInput(nextPackage.unitPriceCents));
      setPackageUnitsInput(String(nextPackage.purchasedUnits));
      setPackageNoteInput(nextPackage.note || "");
    }
  }, [pricingMode, selectedCustomerPackages, selectedPackageId]);

  useEffect(() => {
    if (pricingMode !== "EXISTING_PACKAGE" || !selectedPackage) {
      return;
    }

    setBasePriceInput(formatPriceInput(selectedPackage.unitPriceCents));
    setPackageUnitsInput(String(selectedPackage.purchasedUnits));
    setPackageNoteInput(selectedPackage.note || "");
  }, [pricingMode, selectedPackage]);

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
    basePriceInput,
    customerDraft,
    customerQuery,
    discountInput,
    endDate,
    noteInput,
    packageNoteInput,
    packageUnitsInput,
    paidInput,
    pricingMode,
    recordBookingUndo,
    resetBookingUndo,
    selectedCustomerId,
    selectedMonitorSlots,
    selectedPackageId,
    selectedTargetIds,
    startDate
  ]);

  function findExactCustomerMatch(value: string) {
    const normalizedValue = value.trim().toLocaleLowerCase("it-IT");
    if (!normalizedValue) {
      return null;
    }

    return customers.find((customer) => customer.name.trim().toLocaleLowerCase("it-IT") === normalizedValue) || null;
  }

  function clearSelectedCustomer() {
    setSelectedCustomerId("");
    setCustomerQuery("");
    setCustomerDraft((current) => createEmptyInlineCustomerDraft(current.type));
    if (pricingMode === "EXISTING_PACKAGE") {
      setPricingMode("SINGLE");
      setSelectedPackageId("");
      setBasePriceInput(formatPriceInput(getBillboardPresetMeta("SINGLE").unitPriceCents));
      setDiscountInput("");
    }
  }

  function applyPricingMode(nextMode: BillboardPricingMode) {
    setPricingMode(nextMode);

    if (nextMode === "SINGLE") {
      setSelectedPackageId("");
      setBasePriceInput(formatPriceInput(getBillboardPresetMeta("SINGLE").unitPriceCents));
      setDiscountInput("");
      setPackageUnitsInput(String(Math.max(1, includedTargetCount || 1)));
      setPackageNoteInput("");
      return;
    }

    if (nextMode === "EXISTING_PACKAGE") {
      const nextPackage = selectedCustomerPackages[0] || null;
      setSelectedPackageId(nextPackage?.id || "");
      setBasePriceInput(formatPriceInput(nextPackage?.unitPriceCents || getBillboardPresetMeta("SINGLE").unitPriceCents));
      setDiscountInput("");
      setPackageUnitsInput(String(nextPackage?.purchasedUnits || Math.max(1, includedTargetCount || 1)));
      setPackageNoteInput(nextPackage?.note || "");
      return;
    }

    const meta = getBillboardPresetMeta(nextMode);
    setSelectedPackageId("");
    setBasePriceInput(formatPriceInput(meta.unitPriceCents));
    setDiscountInput("");
    setPackageUnitsInput(String(getSuggestedPackageUnits(nextMode, Math.max(1, includedTargetCount || 1))));
    setPackageNoteInput("");
  }

  const assetCatalogContent = (
    <>
      <div className="field full billboard-multi-select-search">
        <label htmlFor="billboardAssetSearch">Cerca plancia / impianto</label>
        <input
          autoComplete="off"
          id="billboardAssetSearch"
          onChange={(event) => setAssetQuery(event.target.value)}
          spellCheck={false}
          value={assetQuery}
        />
      </div>

      {!hasSelectedDates ? (
        <div className="empty billboard-multi-select-empty">Scegli prima il periodo per vedere le plance libere.</div>
      ) : visibleAssets.length > 0 ? (
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
        <div className="empty billboard-multi-select-empty">Nessuna plancia.</div>
      )}
    </>
  );

  const selectedTargetsCard = (
    <div className="mini-item billboard-selected-targets-card">
      <div className="list-header">
        <div>
          <strong>
            {isMonitorOnlyForm
              ? "Plancia monitor"
              : isVelaOnlyForm
                ? "Vela selezionata"
                : isUpdateMode
                  ? "Prenotazione selezionata"
                  : "Plance selezionate"}
          </strong>
        </div>
        <span className="pill status">{selectedTargets.length}</span>
      </div>

      {selectedTargets.length === 0 ? (
        <div className="empty billboard-multi-select-empty">Nessuna plancia selezionata.</div>
      ) : (
        <div className="billboard-target-list billboard-target-list-v2">
          {selectedTargets.map((asset) => {
            const overlappingBookings = getOverlappingBookings(asset.id);
            const isBlocked = conflictingTargetIds.has(asset.id);
            const availableSlots = getAvailableMonitorSlots(asset.id);
            const chosenSlot = selectedMonitorSlots[asset.id] || availableSlots[0] || 1;
            const occupiedSlots = asset.kind === "MONITOR"
              ? overlappingBookings.length
              : overlappingBookings.length > 0
                ? 1
                : 0;

            return (
              <article className="mini-item billboard-target-card" key={asset.id}>
                <div className="list-header">
                  <div>
                    <strong>{asset.name}</strong>
                    <div className="subtle">
                      {asset.code} • {billboardAssetKindLabels[asset.kind]}
                    </div>
                  </div>
                  {isUpdateMode ? (
                    <span className="pill status">Attiva</span>
                  ) : isMonitorOnlyForm ? (
                    <span className="pill status">Monitor</span>
                  ) : isVelaOnlyForm ? (
                    <span className="pill status">Vela</span>
                  ) : (
                    <button
                      className="ghost"
                      onClick={(event) => {
                        event.preventDefault();
                        removeAssetSelection(asset.id);
                      }}
                      type="button"
                    >
                      Rimuovi
                    </button>
                  )}
                </div>
                {asset.location ? <div className="subtle">{asset.location}</div> : null}

                <div className="billboard-target-availability">
                  <span className={`pill ${isBlocked ? "warning" : "status"}`}>
                    {asset.kind === "MONITOR"
                      ? `${Math.max(0, 6 - occupiedSlots)} slot disponibili`
                      : isBlocked
                        ? "Gia occupato nel periodo"
                        : "Disponibile nel periodo"}
                  </span>
                  {asset.kind === "MONITOR" ? <span className="pill">Slot scelto {chosenSlot}</span> : null}
                </div>

                {asset.kind === "MONITOR" ? (
                  <>
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
                ) : null}

                {overlappingBookings.length > 0 ? (
                  <div className="subtle billboard-target-conflicts">
                    {asset.kind === "MONITOR"
                      ? `Presenti nel periodo: ${overlappingBookings.map((booking) => booking.customerName).join(" • ")}`
                      : `Occupato da ${overlappingBookings[0]?.customerName || "un altro cliente"} nel periodo selezionato.`}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="stack">
      <form
        action={activeAction}
        className={`form-grid billboard-booking-form billboard-booking-form-v4${isUpdateMode ? " is-update" : ""}${isSpecialFixedKind ? " is-special-kind" : ""}`}
      >
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
        <input name="pricingMode" type="hidden" value={isMonitorOnlyForm ? "SINGLE" : pricingMode} />
        <input
          name="billboardCustomerPackageId"
          type="hidden"
          value={isMonitorOnlyForm ? "" : pricingMode === "EXISTING_PACKAGE" ? selectedPackageId : ""}
        />
        <input
          name="billboardPackageUnits"
          type="hidden"
          value={pricingMode === "PACK_3" ? "3" : pricingMode === "PACK_10" ? "10" : packageUnitsInput}
        />
        <input name="billboardPackageNote" type="hidden" value={packageNoteInput} />
        <input name="price" type="hidden" value={priceInput} />

        <section className={stepCardClassName}>
          <div className="billboard-booking-step-head">
            <div>
              <span className="compact-kicker">Fase 1</span>
              <strong>Periodo</strong>
            </div>
            <span className={`pill ${isBelowSuggestedDuration ? "warning" : "status"}`}>
              {bookingDurationDays > 0 ? `${bookingDurationDays} giorni` : "Scegli le date"}
            </span>
          </div>
          <div className="billboard-booking-period-layout">
            <div className="billboard-booking-period-grid">
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
            </div>

            <div className="billboard-booking-14d-help">
              <span className="compact-kicker">Standard consigliato</span>
              <strong>14 giorni</strong>
              <span>
                {startDate ? `Dal ${startDate} al ${suggestionEndDate}` : "Seleziona la data iniziale per suggerire il periodo."}
              </span>
              <button
                className="button ghost"
                onClick={(event) => {
                  event.preventDefault();
                  if (!startDate) {
                    return;
                  }
                  setEndDate(suggestionEndDate);
                }}
                type="button"
              >
                Applica 14 giorni
              </button>
            </div>
          </div>
          {isBelowSuggestedDuration ? (
            <p className="hint">
              Prenotazione sotto i 14 giorni standard. Va bene per le eccezioni, ma resta evidenziata come fuori periodo.
            </p>
          ) : null}
        </section>

        <section className={stepCardClassName}>
          <div className="billboard-booking-step-head">
            <div>
              <span className="compact-kicker">Fase 2</span>
              <strong>Cliente</strong>
            </div>
            {selectedCustomer ? <span className="pill status">{selectedCustomer.name}</span> : null}
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
            placeholder="Cerca cliente"
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
              {!isMonitorOnlyForm && selectedCustomerPackages.length > 0 ? (
                <div className="billboard-customer-package-strip">
                  {selectedCustomerPackages.slice(0, 3).map((pkg) => (
                    <button
                      className={`billboard-package-pill${pricingMode === "EXISTING_PACKAGE" && selectedPackageId === pkg.id ? " is-active" : ""}`}
                      key={pkg.id}
                      onClick={(event) => {
                        event.preventDefault();
                        applyPricingMode("EXISTING_PACKAGE");
                        setSelectedPackageId(pkg.id);
                      }}
                      type="button"
                    >
                      {pkg.label} • {pkg.remainingUnits} residui
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <input name="customerName" type="hidden" value={trimmedCustomerQuery} />
              <div className="billboard-booking-step-grid">
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
        </section>

        <section className="mini-item billboard-booking-step-card full">
          <div className="billboard-booking-step-head">
            <div>
              <span className="compact-kicker">Fase 3</span>
              <strong>{isMonitorOnlyForm ? "Plancia Monitor" : isVelaOnlyForm ? "Vela e prezzo" : "Plance, pacchetti e prezzo"}</strong>
            </div>
            <span className="pill status">
              {isVelaOnlyForm
                ? `${selectedTargets.length} ${selectedTargets.length === 1 ? "impianto" : "impianti"}`
                : `${selectedTargets.length} ${selectedTargets.length === 1 ? "plancia" : "plance"}`}
            </span>
          </div>

          <div className={`billboard-selection-workbench${isUpdateMode ? " is-update" : ""}${isMonitorOnlyForm ? " billboard-selection-workbench-monitor" : ""}`}>
            <div className="billboard-selection-catalog">
              {isSingleFixedAssetForm ? (
                selectedTargetsCard
              ) : isUpdateMode ? (
                <>
                  {selectedTargetsCard}
                  <details className="billboard-booking-change-panel">
                    <summary>Cambia impianto / plancia</summary>
                    <div className="billboard-booking-change-panel-body">{assetCatalogContent}</div>
                  </details>
                </>
              ) : (
                assetCatalogContent
              )}
            </div>

            <aside className="billboard-selection-side">
              {isSingleFixedAssetForm ? null : isUpdateMode ? null : selectedTargetsCard}

              <div className="mini-item billboard-pricing-card">
                <div className="list-header">
                  <div>
                    <strong>{isMonitorOnlyForm ? "Prezzo e riepilogo" : "Prezzi e pacchetti"}</strong>
                    <div className="subtle">
                      {isMonitorOnlyForm
                        ? "Gestisci qui lo slot del monitor e il riepilogo economico."
                        : "Listini predefiniti ma modificabili con sconto."}
                    </div>
                  </div>
                  <span className="pill">{formatCurrency(effectiveUnitPriceCents)}</span>
                </div>

                {isMonitorOnlyForm ? null : (
                  <>
                    <div className="billboard-pricing-mode-grid">
                      {[
                        { value: "SINGLE" as const, label: "Singola" },
                        { value: "PACK_3" as const, label: "Pack 3" },
                        { value: "PACK_10" as const, label: "Pack 10" },
                        { value: "RESELLER" as const, label: "Rivenditore" }
                      ].map((option) => (
                        <button
                          className={`billboard-pricing-mode-button${pricingMode === option.value ? " is-active" : ""}`}
                          key={option.value}
                          onClick={(event) => {
                            event.preventDefault();
                            applyPricingMode(option.value);
                          }}
                          type="button"
                        >
                          {option.label}
                        </button>
                      ))}
                      {selectedCustomerPackages.length > 0 ? (
                        <button
                          className={`billboard-pricing-mode-button${pricingMode === "EXISTING_PACKAGE" ? " is-active" : ""}`}
                          onClick={(event) => {
                            event.preventDefault();
                            applyPricingMode("EXISTING_PACKAGE");
                          }}
                          type="button"
                        >
                          Pack cliente
                        </button>
                      ) : null}
                    </div>

                    {pricingMode === "EXISTING_PACKAGE" ? (
                      <div className="field full">
                        <label htmlFor="billboard-existing-package">Pacchetto cliente</label>
                        <select
                          id="billboard-existing-package"
                          onChange={(event) => setSelectedPackageId(event.target.value)}
                          value={selectedPackageId}
                        >
                          {selectedCustomerPackages.map((pkg) => (
                            <option key={pkg.id} value={pkg.id}>
                              {pkg.label} • {pkg.remainingUnits} residui • {formatCurrency(pkg.unitPriceCents)}
                            </option>
                          ))}
                        </select>
                        {selectedPackage ? (
                          <p className={`hint${selectedPackageRemainingAfterSelection !== null && selectedPackageRemainingAfterSelection < 0 ? " is-error" : ""}`}>
                            {selectedPackageRemainingAfterSelection !== null && selectedPackageRemainingAfterSelection >= 0
                              ? `Dopo questa prenotazione resteranno ${selectedPackageRemainingAfterSelection} crediti.`
                              : "Questo pacchetto non ha abbastanza crediti residui."}
                          </p>
                        ) : (
                          <p className="hint">Seleziona un cliente per usare i suoi pacchetti.</p>
                        )}
                      </div>
                    ) : null}
                  </>
                )}

                <div className="billboard-booking-step-grid">
                  <div className="field">
                    <label htmlFor="priceBase">Prezzo listino per impianto</label>
                    <input
                      className="currency-input"
                      id="priceBase"
                      inputMode="decimal"
                      onChange={(event) => setBasePriceInput(event.target.value)}
                      type="text"
                      value={basePriceInput}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="priceDiscount">Sconto</label>
                    <input
                      id="priceDiscount"
                      inputMode="decimal"
                      onChange={(event) => setDiscountInput(event.target.value)}
                      placeholder="Es. 50 oppure 20%"
                      type="text"
                      value={discountInput}
                    />
                  </div>

                  <div className="field">
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
                </div>

                {isMonitorOnlyForm || pricingMode === "SINGLE" || pricingMode === "EXISTING_PACKAGE" ? null : (
                  <div className="billboard-booking-step-grid">
                    <div className="field">
                      <label htmlFor="billboardPackageUnits">Crediti acquistati</label>
                      <input
                        disabled={pricingMode === "PACK_3" || pricingMode === "PACK_10"}
                        id="billboardPackageUnits"
                        min={1}
                        onChange={(event) => setPackageUnitsInput(event.target.value)}
                        type="number"
                        value={pricingMode === "PACK_3" ? "3" : pricingMode === "PACK_10" ? "10" : packageUnitsInput}
                      />
                    </div>
                    <div className="field wide">
                      <label htmlFor="billboardPackageNote">Nota pacchetto</label>
                      <input
                        id="billboardPackageNote"
                        onChange={(event) => setPackageNoteInput(event.target.value)}
                        placeholder="Es. blocco autunno / rivenditore / campagna"
                        value={packageNoteInput}
                      />
                    </div>
                    <div className="billboard-package-summary">
                      <span className="compact-kicker">Residuo stimato</span>
                      <strong>
                        {newPackageRemainingAfterSelection !== null ? `${newPackageRemainingAfterSelection} crediti` : "N/D"}
                      </strong>
                      <span>
                        {hasPackageCreditConflict
                          ? "Il pacchetto nuovo non copre le plance selezionate."
                          : "I crediti residui potranno essere usati anche in date future."}
                      </span>
                    </div>
                  </div>
                )}

                <div className="mini-item billboard-booking-balance-card field full">
                  <div className="list-header">
                    <div>
                      <strong>Riepilogo economico</strong>
                    </div>
                    <span className={`pill ${totalBalancePreviewCents > 0 ? "warning" : "status"}`}>
                      Saldo totale {formatCurrency(totalBalancePreviewCents)}
                    </span>
                  </div>
                  <div className="billboard-booking-financials">
                    <span>{isMonitorOnlyForm ? `Slot ${selectedMonitorSlotLabel}` : `Plance ${selectedTargets.length}`}</span>
                    <span>Prezzo finale {formatCurrency(effectiveUnitPriceCents)}</span>
                    <span>Valore totale {formatCurrency(totalValuePreviewCents)}</span>
                    <span>Incassato totale {formatCurrency(totalPaidPreviewCents)}</span>
                    <span>Residuo totale {formatCurrency(totalBalancePreviewCents)}</span>
                  </div>
                  {hasBlockingTargetConflict ? (
                    <div className="subtle">
                      {isMonitorOnlyForm
                        ? "Lo slot scelto non e disponibile nel periodo selezionato."
                        : "Una o piu plance non sono disponibili nel periodo selezionato."}
                    </div>
                  ) : null}
                  {isMonitorOnlyForm || !hasPackageCreditConflict ? null : (
                    <div className="subtle">Il pacchetto scelto non copre il numero di plance selezionate.</div>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </section>

        <div className={`field full billboard-booking-note-field${isUpdateMode ? " is-compact" : ""}`}>
          <label htmlFor="note">Note</label>
          <textarea id="note" name="note" onChange={(event) => setNoteInput(event.target.value)} value={noteInput} />
        </div>

        <div className="button-row billboard-booking-submit-row full">
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
          <SubmitButton disabled={isSubmitDisabled} mode={mode} selectionCount={selectedTargets.length} />
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

function parsePackageUnitsInput(value: string, pricingMode: BillboardPricingMode, fallback: number) {
  if (pricingMode === "PACK_3") {
    return 3;
  }

  if (pricingMode === "PACK_10") {
    return 10;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Math.max(1, fallback);
  }

  return Math.round(parsed);
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

function getBookingDurationDays(startDate: string, endDate: string) {
  if (!startDate || !endDate) {
    return 0;
  }

  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 0;
  }

  const dayMs = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / dayMs) + 1;
}

function rangesOverlap(leftStart: string, leftEnd: string, rightStart: string, rightEnd: string) {
  if (!leftStart || !leftEnd || !rightStart || !rightEnd) {
    return false;
  }

  return new Date(`${leftStart}T12:00:00`).getTime() <= new Date(`${rightEnd}T12:00:00`).getTime() &&
    new Date(`${leftEnd}T12:00:00`).getTime() >= new Date(`${rightStart}T12:00:00`).getTime();
}
