"use client";

import Link from "next/link";
import { BillboardAssetKind, CustomerType } from "@prisma/client";
import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createBillboardBookingAction } from "@/app/actions";
import { BillboardAssetManagerForm } from "@/components/billboard-asset-manager-form";
import { BillboardAssetAutocomplete } from "@/components/billboard-asset-autocomplete";
import { BillboardBookingForm } from "@/components/billboard-booking-form";
import { CustomerAutocomplete } from "@/components/customer-autocomplete";
import { PageHeader } from "@/components/page-header";
import {
  BILLBOARD_MIN_BOOKING_DAYS,
  BillboardPackagePresetValue,
  addDaysToDateKey,
  computeBillboardUnitPriceCents,
  getBillboardPresetMeta,
  getSuggestedPackageUnits
} from "@/lib/billboard-pricing";
import { rankBillboardAssets } from "@/lib/billboard-asset-search";
import { billboardAssetKindLabels } from "@/lib/constants";
import { formatCompactDate, formatCurrency, formatDate, formatDateKey, formatWeekdayLabel } from "@/lib/format";
import { parseFlexibleAdjustmentInput } from "@/lib/pricing";

type BillboardsFocus = "assets" | "occupied" | "free" | "bookings" | "day";
type BillboardKindFilter = "ALL" | BillboardAssetKind | "BOOKINGS_FREE";
type BillboardDayView = "bookings" | "occupied" | "free";
type QuickPricingMode = "SINGLE" | "EXISTING_PACKAGE" | BillboardPackagePresetValue;

type CustomerOption = {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  pec: string | null;
  taxCode: string | null;
  vatNumber: string | null;
  uniqueCode: string | null;
  type: CustomerType;
  orderCount: number;
};

type PlainAssetBooking = {
  id: string;
  billboardAssetId: string;
  billboardCustomerPackageId: string | null;
  packageLabel: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
  note: string | null;
  priceCents: number;
  paidCents: number;
  balanceDueCents: number;
  monitorSlot: number | null;
  customer: {
    id: string;
    name: string;
  };
};

type PlainAsset = {
  id: string;
  code: string;
  name: string;
  kind: BillboardAssetKind;
  location: string | null;
  sortOrder: number;
  bookings: PlainAssetBooking[];
};

type PlainMonthBooking = PlainAssetBooking & {
  billboardAsset: {
    id: string;
    code: string;
    name: string;
    kind: BillboardAssetKind;
    location?: string | null;
    sortOrder: number;
  };
};

type PlainCustomerPackage = {
  id: string;
  customerId: string;
  customerName: string;
  label: string;
  preset: BillboardPackagePresetValue;
  purchasedUnits: number;
  usedUnits: number;
  remainingUnits: number;
  unitPriceCents: number;
  note: string | null;
};

type FocusAsset = PlainAsset & {
  isOccupied: boolean;
  monitorOccupancy: number;
  customerLabel: string;
  dateLabel: string;
  locationLabel: string;
  bookingCountInRange: number;
};

type MonitorBoardAsset = PlainAsset & {
  occupiedCount: number;
  slots: Array<{
    index: number;
    booking: PlainAssetBooking | null;
  }>;
};

type RangeAvailability = {
  asset: PlainAsset;
  availableUnits: number;
  capacity: number;
  overlappingBookings: PlainAssetBooking[];
};

type CalendarDay = {
  key: string;
  date: Date;
  entries: PlainMonthBooking[];
  occupiedCount: number;
  freeCount: number;
  isFullyOccupied: boolean;
  topAssets: string[];
  hiddenAssetsCount: number;
  isToday: boolean;
  isInHighlightedRange: boolean;
  isRangeStart: boolean;
  isRangeEnd: boolean;
};

type BillboardsWorkspaceProps = {
  assets: PlainAsset[];
  customers: CustomerOption[];
  customerPackages: PlainCustomerPackage[];
  initialAssetCode: string | null;
  initialBookingOpen: boolean;
  initialDayKey: string | null;
  initialDayView: BillboardDayView;
  initialFocus: BillboardsFocus | null;
  initialKind: BillboardKindFilter;
  monthBookings: PlainMonthBooking[];
  performanceBookings: PlainMonthBooking[];
  yearBookings: PlainMonthBooking[];
  monthDateKey: string;
  monthLabel: string;
  todayKey: string;
};

type FocusContent =
  | {
      kind: "day";
      title: string;
      dayKey: string;
      bookingCount: number;
      availableCount: number;
      occupiedAssetCount: number;
      openBalanceCents: number;
    }
  | {
      kind: "bookings";
      title: string;
      dayKey: string;
      bookings: PlainMonthBooking[];
    }
  | {
      kind: "available";
      title: string;
      dayKey: string;
      availableAssets: RangeAvailability[];
    }
  | null;

type MonitorFocusContent =
  | {
      kind: "assets";
      title: string;
      count: number;
      assets: FocusAsset[];
    }
  | {
      kind: "bookings";
      title: string;
      count: number;
      bookings: PlainMonthBooking[];
    }
  | null;

function QuickCreateSubmitButton({ disabled, selectionCount }: { disabled: boolean; selectionCount: number }) {
  const { pending } = useFormStatus();
  const idleLabel = selectionCount > 1 ? `Prenota ${selectionCount} plance` : "Salva prenotazione";

  return (
    <button className="primary" disabled={pending || disabled} type="submit">
      {pending ? "Salvataggio..." : idleLabel}
    </button>
  );
}

type AssetSelectorSection = {
  kind: BillboardAssetKind;
  label: string;
  assets: FocusAsset[];
};

export function BillboardsWorkspace({
  assets,
  customers,
  customerPackages,
  initialAssetCode,
  initialBookingOpen,
  initialDayKey,
  initialDayView,
  initialFocus,
  initialKind,
  monthBookings,
  performanceBookings,
  yearBookings,
  monthDateKey,
  monthLabel,
  todayKey
}: BillboardsWorkspaceProps) {
  const [focus, setFocus] = useState<BillboardsFocus | null>(
    initialKind === "MONITOR"
      ? initialFocus
      : initialFocus === "day" || initialFocus === "bookings" || initialFocus === "free"
        ? initialFocus
        : null
  );
  const kind = initialKind;
  const [dayKey, setDayKey] = useState<string | null>(initialDayKey);
  const [dayView, setDayView] = useState<BillboardDayView>(initialDayView);
  const [bookingOpen, setBookingOpen] = useState(initialBookingOpen);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [selectedAssetCode, setSelectedAssetCode] = useState<string | null>(initialAssetCode);
  const [managedAssetCode, setManagedAssetCode] = useState<string | null>(initialAssetCode);
  const [bookingSeedStartKey, setBookingSeedStartKey] = useState<string>(initialDayKey || "");
  const [bookingSeedEndKey, setBookingSeedEndKey] = useState<string>(
    initialDayKey ? addDaysToDateKey(initialDayKey, BILLBOARD_MIN_BOOKING_DAYS - 1) : ""
  );
  const [plannerStartKey, setPlannerStartKey] = useState<string>(initialDayKey || todayKey);
  const [plannerEndKey, setPlannerEndKey] = useState<string>(
    initialDayKey ? addDaysToDateKey(initialDayKey, BILLBOARD_MIN_BOOKING_DAYS - 1) : addDaysToDateKey(todayKey, BILLBOARD_MIN_BOOKING_DAYS - 1)
  );
  const [assetSearchQuery, setAssetSearchQuery] = useState("");
  const [bookingSearchQuery, setBookingSearchQuery] = useState("");
  const [bookingSearchOpen, setBookingSearchOpen] = useState(false);
  const [customerFilterQuery, setCustomerFilterQuery] = useState("");
  const [selectedCustomerFilterId, setSelectedCustomerFilterId] = useState("");
  const [quickPricingMode, setQuickPricingMode] = useState<QuickPricingMode>("SINGLE");
  const [quickSelectedPackageId, setQuickSelectedPackageId] = useState("");
  const [quickSelectedAssetIds, setQuickSelectedAssetIds] = useState<string[]>([]);
  const [quickSelectedMonitorSlots, setQuickSelectedMonitorSlots] = useState<Record<string, number>>({});
  const [quickBasePriceInput, setQuickBasePriceInput] = useState(formatMoneyInput(getBillboardPresetMeta("SINGLE").unitPriceCents));
  const [quickDiscountInput, setQuickDiscountInput] = useState("");
  const [quickPaidInput, setQuickPaidInput] = useState("");
  const [quickNoteInput, setQuickNoteInput] = useState("");
  const [quickPackageUnitsInput, setQuickPackageUnitsInput] = useState(String(getSuggestedPackageUnits("SINGLE", 1)));
  const [quickPackageNoteInput, setQuickPackageNoteInput] = useState("");
  const [calendarHeight, setCalendarHeight] = useState<number | null>(null);
  const controlsRef = useRef<HTMLElement | null>(null);
  const calendarRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const bookingRef = useRef<HTMLElement | null>(null);
  const bookingSearchRef = useRef<HTMLElement | null>(null);
  const assetManagerRef = useRef<HTMLElement | null>(null);

  const monthDate = useMemo(() => parseDateKey(monthDateKey), [monthDateKey]);
  const today = useMemo(() => parseDateKey(todayKey), [todayKey]);
  const defaultBookingDate = isSameMonth(monthDate, today) ? today : monthDate;
  const defaultBookingDateKey = formatDateKey(defaultBookingDate);
  const performanceSeasonStartYear = monthDate.getMonth() >= 8 ? monthDate.getFullYear() : monthDate.getFullYear() - 1;
  const performanceSeasonLabel = `Set ${performanceSeasonStartYear} - Ago ${performanceSeasonStartYear + 1}`;
  const isBookingsFreeKind = kind === "BOOKINGS_FREE";
  const isMonitorKind = kind === "MONITOR";
  const isVelaKind = kind === "VELA_ITINERANTE";
  const isSpecialKind = isMonitorKind || isVelaKind || isBookingsFreeKind;
  const isGeneralKind = kind === "ALL" || kind === "CARTELLONE";
  const isSharedGeneralKind = isGeneralKind || isBookingsFreeKind;
  const hasValidPlannerRange = Boolean(plannerStartKey && plannerEndKey && plannerEndKey >= plannerStartKey);
  const plannerDurationDays = getDateRangeLength(plannerStartKey, plannerEndKey);
  const plannerIsBelowMinimum = plannerDurationDays > 0 && plannerDurationDays < BILLBOARD_MIN_BOOKING_DAYS;
  const selectedAsset = assets.find((asset) => asset.code === selectedAssetCode) || null;
  const managedAsset = assets.find((asset) => asset.code === managedAssetCode) || null;
  const editableBooking = useMemo(
    () => yearBookings.find((booking) => booking.id === editingBookingId) || null,
    [editingBookingId, yearBookings]
  );
  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerFilterId) || null;
  const standardAssets = useMemo(
    () => assets.filter((asset) => asset.kind !== "VELA_ITINERANTE"),
    [assets]
  );
  const visibleKindTabs = useMemo(
    () =>
      [
        { value: "ALL" as const, label: "Tutti" },
        { value: "CARTELLONE" as const, label: "Cartelloni" },
        { value: "MONITOR" as const, label: "Monitor" },
        { value: "VELA_ITINERANTE" as const, label: "Vela pubblicitaria" },
        { value: "BOOKINGS_FREE" as const, label: "Prenotazioni/Disponibili" }
      ],
    []
  );

  const assetsByKind = useMemo(
    () =>
      kind === "ALL"
        ? standardAssets
        : kind === "BOOKINGS_FREE"
          ? assets.filter((asset) => asset.kind === "CARTELLONE")
          : assets.filter((asset) => asset.kind === kind),
    [assets, kind, standardAssets]
  );
  const filteredAssets = useMemo(() => rankBillboardAssets(assetsByKind, assetSearchQuery), [assetSearchQuery, assetsByKind]);
  const filteredAssetIds = useMemo(() => new Set(filteredAssets.map((asset) => asset.id)), [filteredAssets]);
  const fallbackCalendarAsset = isVelaKind && filteredAssets.length === 1 ? filteredAssets[0] : null;
  const calendarAsset =
    selectedAsset && filteredAssets.some((asset) => asset.id === selectedAsset.id)
      ? selectedAsset
      : fallbackCalendarAsset;
  const filteredMonthBookings = useMemo(
    () =>
      monthBookings
        .filter((booking) => filteredAssetIds.has(booking.billboardAssetId))
        .sort(
          (left, right) =>
            toDayStamp(left.startsAt) - toDayStamp(right.startsAt) ||
            left.billboardAsset.sortOrder - right.billboardAsset.sortOrder
        ),
    [filteredAssetIds, monthBookings]
  );
  const filteredYearBookings = useMemo(
    () =>
      yearBookings
        .filter((booking) => filteredAssetIds.has(booking.billboardAssetId))
        .sort(
          (left, right) =>
            toDayStamp(left.startsAt) - toDayStamp(right.startsAt) ||
            left.billboardAsset.sortOrder - right.billboardAsset.sortOrder
        ),
    [filteredAssetIds, yearBookings]
  );
  const plannerScopedBookings = useMemo(
    () =>
      hasValidPlannerRange
        ? filteredYearBookings.filter((booking) => rangesOverlap(booking.startsAt, booking.endsAt, plannerStartKey, plannerEndKey))
        : filteredMonthBookings,
    [filteredMonthBookings, filteredYearBookings, hasValidPlannerRange, plannerEndKey, plannerStartKey]
  );
  const bookingBrowserItems = useMemo(() => {
    const normalizedQuery = bookingSearchQuery.trim().toLocaleLowerCase("it-IT");
    const baseBookings = selectedCustomerFilterId
      ? plannerScopedBookings.filter((booking) => booking.customer.id === selectedCustomerFilterId)
      : plannerScopedBookings;
    if (!normalizedQuery) {
      return baseBookings;
    }

    return baseBookings.filter((booking) => {
      const haystack = [
        booking.customer.name,
        booking.billboardAsset.code,
        booking.billboardAsset.name,
        booking.billboardAsset.location || "",
        booking.packageLabel || "",
        booking.note || ""
      ]
        .join(" ")
        .toLocaleLowerCase("it-IT");

      return haystack.includes(normalizedQuery);
    });
  }, [bookingSearchQuery, plannerScopedBookings, selectedCustomerFilterId]);
  const calendarAssets = useMemo(
    () => (calendarAsset ? filteredAssets.filter((asset) => asset.id === calendarAsset.id) : filteredAssets),
    [calendarAsset, filteredAssets]
  );
  const calendarMonthBookings = useMemo(
    () =>
      calendarAsset
        ? filteredMonthBookings.filter((booking) => booking.billboardAssetId === calendarAsset.id)
        : filteredMonthBookings,
    [calendarAsset, filteredMonthBookings]
  );
  const freeAssetsInRange = useMemo(
    () =>
      hasValidPlannerRange
        ? filteredAssets
            .map((asset) => getRangeAvailability(asset, plannerStartKey, plannerEndKey))
            .filter((result) => result.availableUnits > 0)
        : [],
    [filteredAssets, hasValidPlannerRange, plannerEndKey, plannerStartKey]
  );
  const plannerAvailableAssets = useMemo(() => freeAssetsInRange.map(({ asset }) => asset), [freeAssetsInRange]);
  const monthMatrix = useMemo(
    () =>
      buildMonthMatrix(
        calendarMonthBookings,
        monthDate,
        calendarAssets,
        todayKey,
        calendarAsset,
        plannerStartKey,
        plannerEndKey
      ),
    [calendarAsset, calendarAssets, calendarMonthBookings, monthDate, plannerEndKey, plannerStartKey, todayKey]
  );
  const biweekRows = useMemo(() => pairWeeks(monthMatrix), [monthMatrix]);
  const generalFocusContent = useMemo(
    () =>
      isSharedGeneralKind
        ? getGeneralFocusContent(focus, {
            assets: filteredAssets,
            yearBookings: filteredYearBookings,
            selectedAsset: calendarAsset,
            selectedDayKey: dayKey,
            todayKey
          })
        : null,
    [calendarAsset, dayKey, filteredAssets, filteredYearBookings, focus, isSharedGeneralKind, todayKey]
  );
  const generalDaySummaryContent = useMemo(
    () =>
      isSharedGeneralKind
        ? getGeneralFocusContent("day", {
            assets: filteredAssets,
            yearBookings: filteredYearBookings,
            selectedAsset: calendarAsset,
            selectedDayKey: dayKey,
            todayKey
          })
        : null,
    [calendarAsset, dayKey, filteredAssets, filteredYearBookings, isSharedGeneralKind, todayKey]
  );
  const isGeneralSummaryFocus = isGeneralKind && generalFocusContent?.kind === "day";
  const generalDayMetricMax = Math.max(
    1,
    calendarAsset ? getBillboardAssetCapacity(calendarAsset.kind) : calendarAssets.length
  );
  const monitorFocusContent = useMemo(
    () =>
      isMonitorKind
        ? getMonitorFocusContent(focus, {
            assets: filteredAssets,
            monthBookings: filteredMonthBookings,
            yearBookings: filteredYearBookings,
            selectedAsset: calendarAsset,
            selectedDayKey: dayKey,
            todayKey,
            dayView
          })
        : null,
    [
      calendarAsset,
      dayKey,
      dayView,
      filteredAssets,
      filteredMonthBookings,
      filteredYearBookings,
      focus,
      isMonitorKind,
      todayKey
    ]
  );
  const activeSpecialDayKey = dayKey || defaultBookingDateKey;
  const monitorBoardDate = parseDateKey(activeSpecialDayKey);
  const monitorBoardAssets = useMemo(
    () => (kind === "MONITOR" ? buildMonitorBoardAssets(calendarAssets, formatDateKey(monitorBoardDate)) : []),
    [calendarAssets, kind, monitorBoardDate]
  );
  const selectedCustomerBookings = useMemo(
    () =>
      selectedCustomerFilterId
        ? filteredYearBookings.filter((booking) => booking.customer.id === selectedCustomerFilterId)
        : [],
    [filteredYearBookings, selectedCustomerFilterId]
  );
  const selectedCustomerBookingGroups = useMemo(
    () => groupBookingsByAsset(selectedCustomerBookings),
    [selectedCustomerBookings]
  );
  const selectedCustomerPackageList = useMemo(
    () =>
      selectedCustomerFilterId
        ? customerPackages
            .filter((pkg) => pkg.customerId === selectedCustomerFilterId)
            .sort((left, right) => right.remainingUnits - left.remainingUnits || left.label.localeCompare(right.label, "it"))
        : [],
    [customerPackages, selectedCustomerFilterId]
  );
  const selectedCustomerQuickPackages = useMemo(
    () => selectedCustomerPackageList.filter((pkg) => pkg.remainingUnits > 0 || pkg.id === quickSelectedPackageId),
    [quickSelectedPackageId, selectedCustomerPackageList]
  );
  const selectedQuickPackage =
    selectedCustomerQuickPackages.find((pkg) => pkg.id === quickSelectedPackageId) || null;
  const quickSelectedTargets = useMemo(
    () =>
      quickSelectedAssetIds
        .map((targetId) => assets.find((asset) => asset.id === targetId) || null)
        .filter((asset): asset is PlainAsset => asset !== null),
    [assets, quickSelectedAssetIds]
  );
  const quickDiscountState = useMemo(() => parseFlexibleAdjustmentInput(quickDiscountInput, "AMOUNT"), [quickDiscountInput]);
  const quickResolvedBasePriceCents = selectedQuickPackage
    ? parseMoneyDraftToCents(quickBasePriceInput) || selectedQuickPackage.unitPriceCents
    : parseMoneyDraftToCents(quickBasePriceInput);
  const quickEffectiveUnitPriceCents = computeBillboardUnitPriceCents(
    quickResolvedBasePriceCents,
    quickDiscountState.mode,
    quickDiscountState.value
  );
  const quickPriceInput = formatMoneyInput(quickEffectiveUnitPriceCents);
  const quickPaidPreviewCents = parseMoneyDraftToCents(quickPaidInput);
  const quickTotalValuePreviewCents = quickEffectiveUnitPriceCents * quickSelectedTargets.length;
  const quickTotalPaidPreviewCents = quickPaidPreviewCents * quickSelectedTargets.length;
  const quickTotalBalancePreviewCents = Math.max(0, quickTotalValuePreviewCents - quickTotalPaidPreviewCents);
  const quickIsExistingPackageMode = quickPricingMode === "EXISTING_PACKAGE";
  const quickIsNewPackageMode = quickPricingMode !== "SINGLE" && !quickIsExistingPackageMode;
  const quickDraftedPackageUnits = parseQuickPackageUnitsInput(
    quickPackageUnitsInput,
    quickPricingMode,
    Math.max(1, quickSelectedTargets.length || 1)
  );
  const quickSelectedPackageRemainingAfterSelection = selectedQuickPackage
    ? selectedQuickPackage.remainingUnits - quickSelectedTargets.length
    : null;
  const quickNewPackageRemainingAfterSelection = quickIsNewPackageMode
    ? quickDraftedPackageUnits - quickSelectedTargets.length
    : null;
  const quickHasPackageCreditConflict = quickIsExistingPackageMode
    ? Boolean(
        selectedQuickPackage &&
          quickSelectedPackageRemainingAfterSelection !== null &&
          quickSelectedPackageRemainingAfterSelection < 0
      )
    : quickIsNewPackageMode
      ? quickNewPackageRemainingAfterSelection !== null && quickNewPackageRemainingAfterSelection < 0
      : false;
  const velaAsset = useMemo(
    () => (isVelaKind ? filteredAssets.find((asset) => asset.kind === "VELA_ITINERANTE") || null : null),
    [filteredAssets, isVelaKind]
  );
  const velaSnapshot = useMemo(() => {
    if (!velaAsset) {
      return null;
    }

    const activeBooking =
      velaAsset.bookings
        .filter((booking) => bookingIncludesDay(booking, activeSpecialDayKey))
        .sort((left, right) => toDayStamp(left.startsAt) - toDayStamp(right.startsAt))[0] || null;
    const nextBooking =
      velaAsset.bookings
        .filter((booking) => booking.startsAt > activeSpecialDayKey)
        .sort((left, right) => toDayStamp(left.startsAt) - toDayStamp(right.startsAt))[0] || null;
    const suggestedStartKey = activeBooking ? addDaysToDateKey(activeBooking.endsAt, 1) : activeSpecialDayKey;

    return {
      activeBooking,
      nextBooking,
      suggestedStartKey,
      statusLabel: activeBooking ? "Occupata" : nextBooking ? "Prossima prenotazione" : "Libera",
      customerLabel: activeBooking
        ? activeBooking.customer.name
        : nextBooking
          ? nextBooking.customer.name
          : "Nessuna prenotazione programmata",
      dateLabel: activeBooking
        ? `${formatCompactDate(parseDateKey(activeBooking.startsAt))} - ${formatCompactDate(parseDateKey(activeBooking.endsAt))}`
        : nextBooking
          ? `${formatCompactDate(parseDateKey(nextBooking.startsAt))} - ${formatCompactDate(parseDateKey(nextBooking.endsAt))}`
          : `Disponibile da ${formatCompactDate(parseDateKey(activeSpecialDayKey))}`
    };
  }, [activeSpecialDayKey, velaAsset]);
  const performanceSeries = useMemo(
    () => buildAssetPerformanceSeries(filteredAssets, performanceBookings, performanceSeasonStartYear),
    [filteredAssets, performanceBookings, performanceSeasonStartYear]
  );
  const bookingFormAsset = useMemo(() => {
    if (editableBooking) {
      return assets.find((asset) => asset.id === editableBooking.billboardAssetId) || null;
    }

    return selectedAsset;
  }, [assets, editableBooking, selectedAsset]);
  const existingBookings = useMemo(
    () =>
      assets.flatMap((asset) =>
        asset.bookings.map((booking) => ({
          id: booking.id,
          billboardAssetId: asset.id,
          customerName: booking.customer.name,
          monitorSlot: booking.monitorSlot,
          startsAt: booking.startsAt,
          endsAt: booking.endsAt
        }))
      ),
    [assets]
  );
  const quickBookingsByAsset = useMemo(() => {
    const map = new Map<string, typeof existingBookings>();
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
  const customerBookingDefaultEndKey = plannerStartKey
    ? addDaysToDateKey(plannerStartKey, BILLBOARD_MIN_BOOKING_DAYS - 1)
    : plannerEndKey;
  const hasFocusPanel = isMonitorKind ? Boolean(monitorFocusContent) : Boolean(generalFocusContent);
  const shouldShowQuickBooking = isGeneralKind && bookingOpen && !editableBooking;
  const shouldShowBookingForm = bookingOpen && (Boolean(editableBooking) || isSpecialKind);
  const shouldShowGeneralEditor = isGeneralKind && bookingOpen && Boolean(editableBooking);
  const shouldPersistBookingOpen = isSpecialKind ? bookingOpen : shouldShowQuickBooking;
  const overviewStyle = calendarHeight
    ? ({ ["--billboards-panel-height" as string]: `${calendarHeight}px` } as CSSProperties)
    : undefined;

  function getQuickOverlappingBookings(assetId: string, startKey = plannerStartKey, endKey = plannerEndKey) {
    if (!startKey || !endKey || endKey < startKey) {
      return [];
    }

    const bookings = quickBookingsByAsset.get(assetId) || [];
    return bookings
      .filter((booking) => rangesOverlap(booking.startsAt, booking.endsAt, startKey, endKey))
      .sort(
        (left, right) =>
          new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime() ||
          left.customerName.localeCompare(right.customerName, "it")
      );
  }

  function getQuickMonitorSlotMap(assetId: string, startKey = plannerStartKey, endKey = plannerEndKey) {
    const overlappingBookings = getQuickOverlappingBookings(assetId, startKey, endKey);
    const occupied = new Map<number, (typeof overlappingBookings)[number]>();
    const unassigned: typeof overlappingBookings = [];

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

  function getQuickAvailableMonitorSlots(assetId: string, startKey = plannerStartKey, endKey = plannerEndKey) {
    if (!startKey || !endKey || endKey < startKey) {
      return [1, 2, 3, 4, 5, 6];
    }

    const occupied = getQuickMonitorSlotMap(assetId, startKey, endKey);
    return [1, 2, 3, 4, 5, 6].filter((slot) => !occupied.has(slot));
  }

  function isQuickTargetBlocked(asset: PlainAsset, startKey = plannerStartKey, endKey = plannerEndKey) {
    if (!startKey || !endKey || endKey < startKey) {
      return false;
    }

    const overlappingBookings = getQuickOverlappingBookings(asset.id, startKey, endKey);
    if (asset.kind !== "MONITOR") {
      return overlappingBookings.length >= 1;
    }

    const availableSlots = getQuickAvailableMonitorSlots(asset.id, startKey, endKey);
    const chosenSlot = quickSelectedMonitorSlots[asset.id];

    if (!chosenSlot) {
      return availableSlots.length === 0;
    }

    return !availableSlots.includes(chosenSlot);
  }

  function buildQuickSlots(asset: PlainAsset) {
    if (asset.kind !== "MONITOR" || !hasValidPlannerRange) {
      return [];
    }

    const slotMap = getQuickMonitorSlotMap(asset.id);
    return Array.from({ length: 6 }, (_, index) => slotMap.get(index + 1) || null);
  }

  function applyQuickAssetSelection(asset: PlainAsset, startKey = plannerStartKey, endKey = plannerEndKey) {
    setQuickSelectedAssetIds((current) => (current.includes(asset.id) ? current : [...current, asset.id]));
    setQuickSelectedMonitorSlots((current) => {
      const next = { ...current };

      if (asset.kind === "MONITOR") {
        const availableSlots = getQuickAvailableMonitorSlots(asset.id, startKey, endKey);
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

  function removeQuickAssetSelection(assetId: string) {
    setQuickSelectedAssetIds((current) => current.filter((targetId) => targetId !== assetId));
    setQuickSelectedMonitorSlots((current) => {
      const next = { ...current };
      delete next[assetId];
      return next;
    });
  }

  function toggleQuickAssetSelection(asset: PlainAsset, startKey = plannerStartKey, endKey = plannerEndKey) {
    if (quickSelectedAssetIds.includes(asset.id)) {
      removeQuickAssetSelection(asset.id);
      return;
    }

    applyQuickAssetSelection(asset, startKey, endKey);
  }

  const quickConflictingTargetIds = new Set(
    hasValidPlannerRange ? quickSelectedTargets.filter((asset) => isQuickTargetBlocked(asset)).map((asset) => asset.id) : []
  );
  const quickHasBlockingTargetConflict = hasValidPlannerRange && quickConflictingTargetIds.size > 0;
  const quickHasSelectedExistingPackage = !quickIsExistingPackageMode || Boolean(quickSelectedPackageId);
  const quickCanSubmit = Boolean(selectedCustomerFilterId || customerFilterQuery.trim()) &&
    hasValidPlannerRange &&
    quickSelectedTargets.length > 0 &&
    quickHasSelectedExistingPackage &&
    !quickHasBlockingTargetConflict &&
    !quickHasPackageCreditConflict &&
    quickEffectiveUnitPriceCents > 0;

  useEffect(() => {
    if (!selectedAssetCode) {
      return;
    }

    const matchingAsset = filteredAssets.find((asset) => asset.code === selectedAssetCode) || null;
    if (!matchingAsset) {
      setSelectedAssetCode(null);
    }
  }, [filteredAssets, selectedAssetCode]);

  useEffect(() => {
    if (!managedAssetCode) {
      return;
    }

    const matchingAsset = assets.find((asset) => asset.code === managedAssetCode) || null;
    if (!matchingAsset) {
      setManagedAssetCode(null);
    }
  }, [assets, managedAssetCode]);

  useEffect(() => {
    if (selectedCustomerFilterId && !selectedCustomer) {
      setSelectedCustomerFilterId("");
    }
  }, [selectedCustomer, selectedCustomerFilterId]);

  useEffect(() => {
    if (!selectedCustomerFilterId) {
      setQuickSelectedPackageId("");
      if (quickPricingMode === "EXISTING_PACKAGE") {
        setQuickPricingMode("SINGLE");
      }
      return;
    }

    if (quickPricingMode !== "EXISTING_PACKAGE") {
      if (quickSelectedPackageId && !selectedCustomerQuickPackages.some((pkg) => pkg.id === quickSelectedPackageId)) {
        setQuickSelectedPackageId("");
      }
      return;
    }

    if (selectedCustomerQuickPackages.length === 0) {
      setQuickPricingMode("SINGLE");
      setQuickSelectedPackageId("");
      return;
    }

    if (!quickSelectedPackageId || !selectedCustomerQuickPackages.some((pkg) => pkg.id === quickSelectedPackageId)) {
      setQuickSelectedPackageId(selectedCustomerQuickPackages[0].id);
    }
  }, [quickPricingMode, quickSelectedPackageId, selectedCustomerFilterId, selectedCustomerQuickPackages]);

  useEffect(() => {
    if (quickPricingMode !== "EXISTING_PACKAGE" || !selectedQuickPackage) {
      return;
    }

    setQuickBasePriceInput(formatMoneyInput(selectedQuickPackage.unitPriceCents));
    setQuickPackageUnitsInput(String(selectedQuickPackage.purchasedUnits));
    setQuickPackageNoteInput(selectedQuickPackage.note || "");
  }, [quickPricingMode, selectedQuickPackage]);

  useEffect(() => {
    if (isMonitorKind) {
      return;
    }

    if (focus && focus !== "day" && focus !== "bookings" && focus !== "free") {
      setFocus(null);
    }

    if (dayView !== "bookings") {
      setDayView("bookings");
    }
  }, [dayView, focus, isMonitorKind]);

  useEffect(() => {
    if (!isVelaKind || !focus) {
      return;
    }

    setFocus(null);
  }, [focus, isVelaKind]);

  useEffect(() => {
    if (!isSpecialKind || !assetSearchQuery) {
      return;
    }

    setAssetSearchQuery("");
  }, [assetSearchQuery, isSpecialKind]);

  useEffect(() => {
    if (!bookingSearchOpen) {
      return;
    }

    const closeSearch = (event: MouseEvent) => {
      if (bookingSearchRef.current?.contains(event.target as Node)) {
        return;
      }

      setBookingSearchOpen(false);
    };

    document.addEventListener("mousedown", closeSearch);
    return () => document.removeEventListener("mousedown", closeSearch);
  }, [bookingSearchOpen]);

  useEffect(() => {
    const element = calendarRef.current;
    if (!element || typeof ResizeObserver === "undefined") {
      return;
    }

    const updateHeight = () => {
      setCalendarHeight(Math.ceil(element.getBoundingClientRect().height));
    };

    updateHeight();
    const observer = new ResizeObserver(() => updateHeight());
    observer.observe(element);
    return () => observer.disconnect();
  }, [focus, kind, monthDateKey, plannerEndKey, plannerStartKey]);

  useEffect(() => {
    const searchParams = new URLSearchParams({ date: monthDateKey });
    if (selectedAssetCode) {
      searchParams.set("asset", selectedAssetCode);
    }
    if (shouldPersistBookingOpen) {
      searchParams.set("booking", "new");
    }
    if (isMonitorKind ? focus : focus === "day" || focus === "bookings" || focus === "free") {
      searchParams.set("focus", focus || "day");
    }
    if (dayKey) {
      searchParams.set("day", dayKey);
    }
    if (isMonitorKind && dayView !== "bookings") {
      searchParams.set("dayView", dayView);
    }
    if (kind !== "ALL") {
      searchParams.set("kind", kind);
    }
    const anchor = shouldShowBookingForm
      ? "#new-billboard-booking"
      : shouldShowQuickBooking
        ? "#billboards-quick-booking"
        : hasFocusPanel
          ? "#billboards-focus-panel"
          : "";
    window.history.replaceState({}, "", `/billboards?${searchParams.toString()}${anchor}`);
  }, [
    bookingOpen,
    dayKey,
    dayView,
    focus,
    hasFocusPanel,
    isMonitorKind,
    isSpecialKind,
    kind,
    monthDateKey,
    selectedAssetCode,
    shouldShowBookingForm,
    shouldPersistBookingOpen,
    shouldShowQuickBooking
  ]);

  function scrollToTarget(target: "panel" | "booking" | "calendar" | "manager" | "controls") {
    requestAnimationFrame(() => {
      const element =
        target === "controls"
          ? controlsRef.current
          : target === "panel"
            ? panelRef.current
            : target === "booking"
              ? bookingRef.current
              : target === "manager"
                ? assetManagerRef.current
                : calendarRef.current;

      if (!element) {
        return;
      }

      element.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function openFocus(nextFocus: BillboardsFocus, nextDayKey?: string | null, nextDayView?: BillboardDayView) {
    setFocus(nextFocus);
    setDayKey(nextDayKey ?? null);
    setDayView(nextDayView ?? "bookings");
    scrollToTarget("panel");
  }

  function openAssetCalendar(assetCode: string) {
    setSelectedAssetCode(assetCode);
    setEditingBookingId(null);
    setBookingOpen(false);
    setFocus(null);
    setDayKey(null);
    setDayView("bookings");
    scrollToTarget("calendar");
  }

  function openAssetManager(assetCode: string) {
    setSelectedAssetCode(assetCode);
    setManagedAssetCode(assetCode);
    setFocus(null);
    setDayKey(null);
    setDayView("bookings");
    scrollToTarget("manager");
  }

  function openAssetBooking(assetCode: string, targetDayKey?: string) {
    const startKey = targetDayKey || plannerStartKey || defaultBookingDateKey;
    const endKey = targetDayKey
      ? addDaysToDateKey(targetDayKey, BILLBOARD_MIN_BOOKING_DAYS - 1)
      : plannerEndKey || addDaysToDateKey(startKey, BILLBOARD_MIN_BOOKING_DAYS - 1);
    openAssetBookingForRange(assetCode, startKey, endKey);
  }

  function openAssetBookingForRange(assetCode: string, startKey: string, endKey: string) {
    const asset = assets.find((entry) => entry.code === assetCode) || null;
    setSelectedAssetCode(assetCode);
    setEditingBookingId(null);
    setBookingSeedStartKey(startKey);
    setBookingSeedEndKey(endKey);
    setPlannerStartKey(startKey);
    setPlannerEndKey(endKey);
    setDayKey(startKey || null);
    setFocus(null);
    setDayView("bookings");
    if (isGeneralKind) {
      if (asset) {
        applyQuickAssetSelection(asset, startKey, endKey);
      }
      setAssetSearchQuery("");
      setBookingOpen(true);
      scrollToTarget("controls");
      return;
    }
    setBookingOpen(true);
    scrollToTarget("booking");
  }

  function openBookingEditor(bookingId: string) {
    const booking = yearBookings.find((entry) => entry.id === bookingId);
    if (!booking) {
      return;
    }

    setEditingBookingId(booking.id);
    setSelectedAssetCode(booking.billboardAsset.code);
    setManagedAssetCode(booking.billboardAsset.code);
    setBookingSeedStartKey(booking.startsAt);
    setBookingSeedEndKey(booking.endsAt);
    setBookingOpen(true);
    setFocus(null);
    setDayKey(booking.startsAt);
    setDayView("bookings");
    scrollToTarget("booking");
  }

  function closeBooking() {
    setBookingOpen(false);
    setEditingBookingId(null);
    setBookingSeedStartKey("");
    setBookingSeedEndKey("");
  }

  function closeFocus() {
    setFocus(null);
    setDayKey(null);
    setDayView("bookings");
  }

  function clearSelectedAsset() {
    setSelectedAssetCode(null);
    setManagedAssetCode(null);
    setDayKey(null);
    setDayView("bookings");
  }

  function findExactCustomerMatch(value: string) {
    const normalizedValue = value.trim().toLocaleLowerCase("it-IT");
    if (!normalizedValue) {
      return null;
    }

    return customers.find((customer) => customer.name.trim().toLocaleLowerCase("it-IT") === normalizedValue) || null;
  }

  function resetQuickCreateSelection() {
    setQuickSelectedAssetIds([]);
    setQuickSelectedMonitorSlots({});
    setAssetSearchQuery("");
    setQuickPaidInput("");
    setQuickNoteInput("");
    setFocus(null);
    setDayKey(null);
    setDayView("bookings");
  }

  function applyQuickPricingMode(nextMode: QuickPricingMode) {
    setQuickPricingMode(nextMode);

    if (nextMode === "SINGLE") {
      setQuickSelectedPackageId("");
      setQuickBasePriceInput(formatMoneyInput(getBillboardPresetMeta("SINGLE").unitPriceCents));
      setQuickDiscountInput("");
      setQuickPackageUnitsInput(String(Math.max(1, quickSelectedTargets.length || 1)));
      setQuickPackageNoteInput("");
      return;
    }

    if (nextMode === "EXISTING_PACKAGE") {
      const nextPackage = selectedCustomerQuickPackages[0] || null;
      setQuickSelectedPackageId(nextPackage?.id || "");
      setQuickBasePriceInput(formatMoneyInput(nextPackage?.unitPriceCents || getBillboardPresetMeta("SINGLE").unitPriceCents));
      setQuickDiscountInput("");
      setQuickPackageUnitsInput(String(nextPackage?.purchasedUnits || Math.max(1, quickSelectedTargets.length || 1)));
      setQuickPackageNoteInput(nextPackage?.note || "");
      return;
    }

    const meta = getBillboardPresetMeta(nextMode);
    setQuickSelectedPackageId("");
    setQuickBasePriceInput(formatMoneyInput(meta.unitPriceCents));
    setQuickDiscountInput("");
    setQuickPackageUnitsInput(String(getSuggestedPackageUnits(nextMode, Math.max(1, quickSelectedTargets.length || 1))));
    setQuickPackageNoteInput("");
  }

  function monthHref(targetMonth: Date) {
    const searchParams = new URLSearchParams({ date: formatDateKey(startOfMonth(targetMonth)) });
    if (selectedAssetCode) {
      searchParams.set("asset", selectedAssetCode);
    }
    if (shouldPersistBookingOpen) {
      searchParams.set("booking", "new");
    }
    if (isMonitorKind ? focus : focus === "day" || focus === "bookings" || focus === "free") {
      searchParams.set("focus", focus || "day");
    }
    if (dayKey) {
      searchParams.set("day", dayKey);
    }
    if (isMonitorKind && dayView !== "bookings") {
      searchParams.set("dayView", dayView);
    }
    if (kind !== "ALL") {
      searchParams.set("kind", kind);
    }

    return `/billboards?${searchParams.toString()}`;
  }

  function kindHref(targetKind: BillboardKindFilter) {
    const targetDayKey = dayKey || plannerStartKey || todayKey;
    const targetFocus =
      targetKind === "BOOKINGS_FREE"
        ? focus === "free"
          ? "free"
          : "bookings"
        : isBookingsFreeKind
          ? "day"
          : isMonitorKind
            ? focus || "day"
            : focus === "bookings" || focus === "free"
              ? "day"
              : focus;
    const searchParams = new URLSearchParams({ date: monthDateKey });
    if (selectedAssetCode && targetKind !== "BOOKINGS_FREE") {
      searchParams.set("asset", selectedAssetCode);
    }
    if (shouldPersistBookingOpen && (targetKind === "CARTELLONE" || targetKind === "MONITOR" || targetKind === "VELA_ITINERANTE" || targetKind === "BOOKINGS_FREE")) {
      searchParams.set("booking", "new");
    }
    if (targetFocus) {
      searchParams.set("focus", targetFocus);
    }
    if (targetDayKey && (targetKind === "BOOKINGS_FREE" || targetFocus === "day" || targetFocus === "bookings" || targetFocus === "free")) {
      searchParams.set("day", targetDayKey);
    }
    if (targetKind === "MONITOR" && dayView !== "bookings") {
      searchParams.set("dayView", dayView);
    }
    if (targetKind !== "ALL") {
      searchParams.set("kind", targetKind);
    }

    return `/billboards?${searchParams.toString()}`;
  }

  function dayFocusHref(targetDayKey: string, targetFocus: "day" | "bookings" | "free") {
    const searchParams = new URLSearchParams({ date: monthDateKey, day: targetDayKey, focus: targetFocus });
    if (selectedAssetCode) {
      searchParams.set("asset", selectedAssetCode);
    }
    const targetKind = targetFocus === "day" ? "CARTELLONE" : "BOOKINGS_FREE";
    searchParams.set("kind", targetKind);

    return `/billboards?${searchParams.toString()}#billboards-focus-panel`;
  }

  return (
    <div className="stack billboards-page-shell billboards-page-shell-v3 billboards-page-shell-v4">
      <PageHeader
        title="Cartelloni"
        action={isBookingsFreeKind ? undefined : (
          <div className="billboards-header-actions">
            {isGeneralKind ? (
              <button
                className={`button ${bookingOpen ? "ghost" : "primary"}`}
                onClick={() => {
                  if (bookingOpen) {
                    closeBooking();
                    return;
                  }

                  setEditingBookingId(null);
                  setFocus(null);
                  setDayView("bookings");
                  setBookingOpen(true);
                  scrollToTarget("controls");
                }}
                type="button"
              >
                {shouldShowGeneralEditor ? "Chiudi modifica" : shouldShowQuickBooking ? "Chiudi nuova prenotazione" : "Nuova prenotazione"}
              </button>
            ) : (
              <>
                {shouldShowBookingForm ? (
                  <button className="button ghost" onClick={closeBooking} type="button">
                    Chiudi
                  </button>
                ) : null}
                <button
                  className="button primary"
                  onClick={() => {
                    const nextStartKey =
                      isVelaKind && velaSnapshot ? velaSnapshot.suggestedStartKey : plannerStartKey || defaultBookingDateKey;
                    setEditingBookingId(null);
                    if (isVelaKind && velaAsset) {
                      setSelectedAssetCode(velaAsset.code);
                    }
                    setBookingSeedStartKey(nextStartKey);
                    setBookingSeedEndKey(addDaysToDateKey(nextStartKey, BILLBOARD_MIN_BOOKING_DAYS - 1));
                    setFocus(null);
                    setDayView("bookings");
                    setBookingOpen(true);
                    scrollToTarget("booking");
                  }}
                  type="button"
                >
                  Nuova prenotazione
                </button>
              </>
            )}
          </div>
        )}
      />

      <section className="billboards-kind-tabs" aria-label="Tipi di impianto">
        {visibleKindTabs.map((tab) => (
          <Link
            className={`billboards-kind-tab${kind === tab.value ? " is-active" : ""}`}
            href={kindHref(tab.value)}
            key={tab.value}
          >
            {tab.label}
          </Link>
        ))}
      </section>

      {isGeneralKind ? (
        <>
          {shouldShowQuickBooking ? (
            <form action={createBillboardBookingAction} className="billboards-quick-booking-form">
              {quickSelectedAssetIds.map((targetId) => (
                <input key={targetId} name="billboardAssetIds" type="hidden" value={targetId} />
              ))}
              <input name="customerId" type="hidden" value={selectedCustomerFilterId} />
              <input name="customerName" type="hidden" value={selectedCustomer?.name || customerFilterQuery.trim()} />
              <input name="customerType" type="hidden" value={selectedCustomer?.type || "PUBBLICO"} />
              <input name="monitorSlotsPayload" type="hidden" value={JSON.stringify(quickSelectedMonitorSlots)} />
              <input name="pricingMode" type="hidden" value={quickPricingMode} />
              <input name="billboardCustomerPackageId" type="hidden" value={quickPricingMode === "EXISTING_PACKAGE" ? quickSelectedPackageId : ""} />
              <input
                name="billboardPackageUnits"
                type="hidden"
                value={quickPricingMode === "PACK_3" ? "3" : quickPricingMode === "PACK_10" ? "10" : quickPackageUnitsInput}
              />
              <input name="billboardPackageNote" type="hidden" value={quickPackageNoteInput} />
              <input name="startsAt" type="hidden" value={plannerStartKey} />
              <input name="endsAt" type="hidden" value={plannerEndKey} />
              <input name="price" type="hidden" value={quickPriceInput} />
              <input name="paid" type="hidden" value={quickPaidInput} />
              <input name="note" type="hidden" value={quickNoteInput} />

              <section
                className="card card-pad billboards-control-deck"
                aria-label="Pianificazione cartelloni"
                id="billboards-quick-booking"
                ref={controlsRef}
              >
              <article className="mini-item billboards-control-card">
                <div className="billboards-control-card-head">
                  <div>
                    <span className="compact-kicker">Fase 1</span>
                    <h3>Periodo</h3>
                  </div>
                  <span className={`pill ${plannerIsBelowMinimum ? "warning" : "status"}`}>
                    {plannerDurationDays > 0 ? `${plannerDurationDays} giorni` : "Periodo"}
                  </span>
                </div>
                <div className="billboards-control-fields">
                  <label className="field">
                    <span>Data inizio</span>
                    <input
                      min={todayKey}
                      onChange={(event) => {
                        const nextStartKey = event.target.value;
                        setPlannerStartKey(nextStartKey);
                        if (plannerEndKey < nextStartKey) {
                          setPlannerEndKey(addDaysToDateKey(nextStartKey, BILLBOARD_MIN_BOOKING_DAYS - 1));
                        }
                      }}
                      type="date"
                      value={plannerStartKey}
                    />
                  </label>
                  <label className="field">
                    <span>Data fine</span>
                    <input
                      min={plannerStartKey || todayKey}
                      onChange={(event) => setPlannerEndKey(event.target.value)}
                      type="date"
                      value={plannerEndKey}
                    />
                  </label>
                </div>
                <div className="billboards-period-hint">
                  <strong>Help 14 giorni</strong>
                  <span>
                    {plannerStartKey
                      ? `${plannerStartKey} - ${addDaysToDateKey(plannerStartKey, BILLBOARD_MIN_BOOKING_DAYS - 1)}`
                      : "Seleziona una data iniziale"}
                  </span>
                </div>
                <div className="billboards-control-actions">
                  <button
                    className="button ghost"
                    onClick={() => setPlannerEndKey(addDaysToDateKey(plannerStartKey || todayKey, BILLBOARD_MIN_BOOKING_DAYS - 1))}
                    type="button"
                  >
                    Applica 14 giorni
                  </button>
                </div>
              </article>

              <article className="mini-item billboards-control-card">
                <div className="billboards-control-card-head">
                  <div>
                    <span className="compact-kicker">Fase 2</span>
                    <h3>Cliente</h3>
                  </div>
                </div>
                <CustomerAutocomplete
                  customers={customers.map((customer) => ({
                    ...customer,
                    type: customer.type
                  }))}
                  emptyMessage="Cliente non trovato."
                  label="Cerca cliente"
                  onQueryChange={(value) => {
                    const exactMatch = findExactCustomerMatch(value);
                    if (exactMatch) {
                      setSelectedCustomerFilterId(exactMatch.id);
                      setCustomerFilterQuery(exactMatch.name);
                      return;
                    }

                    setCustomerFilterQuery(value);
                    if (selectedCustomerFilterId) {
                      setSelectedCustomerFilterId("");
                    }
                  }}
                  onSelect={(customer) => {
                    setSelectedCustomerFilterId(customer.id);
                    setCustomerFilterQuery(customer.name);
                  }}
                  placeholder="Nome, telefono o email"
                  query={customerFilterQuery}
                  selectedCustomerId={selectedCustomerFilterId}
                />
                <div className="billboards-quick-pricing">
                  <div className="list-header">
                    <strong>Pacchetto e listino</strong>
                    <span className="pill status">
                      {selectedQuickPackage
                        ? selectedQuickPackage.label
                        : quickPricingMode === "PACK_3"
                          ? "Pack 3"
                          : quickPricingMode === "PACK_10"
                            ? "Pack 10"
                            : quickPricingMode === "RESELLER"
                              ? "Rivenditore"
                              : "Singola"}
                    </span>
                  </div>
                  <div className="billboard-pricing-mode-grid">
                    {[
                      { value: "SINGLE" as const, label: "Singola" },
                      { value: "PACK_3" as const, label: "Pack 3" },
                      { value: "PACK_10" as const, label: "Pack 10" },
                      { value: "RESELLER" as const, label: "Rivenditore" }
                    ].map((option) => (
                      <button
                        className={`billboard-pricing-mode-button${quickPricingMode === option.value ? " is-active" : ""}`}
                        key={option.value}
                        onClick={() => applyQuickPricingMode(option.value)}
                        type="button"
                      >
                        {option.label}
                      </button>
                    ))}
                    {selectedCustomerQuickPackages.length > 0 ? (
                      <button
                        className={`billboard-pricing-mode-button${quickPricingMode === "EXISTING_PACKAGE" ? " is-active" : ""}`}
                        onClick={() => applyQuickPricingMode("EXISTING_PACKAGE")}
                        type="button"
                      >
                        Pack cliente
                      </button>
                    ) : null}
                  </div>
                  {quickPricingMode === "EXISTING_PACKAGE" ? (
                    selectedCustomerQuickPackages.length > 0 ? (
                      <div className="billboard-customer-package-strip">
                        {selectedCustomerQuickPackages.map((pkg) => (
                          <button
                            className={`billboard-package-pill${quickSelectedPackageId === pkg.id ? " is-active" : ""}`}
                            key={pkg.id}
                            onClick={() => setQuickSelectedPackageId(pkg.id)}
                            type="button"
                          >
                            {pkg.label} • {pkg.remainingUnits} residui
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="hint">Seleziona un cliente con pacchetti disponibili.</p>
                    )
                  ) : null}
                </div>
                <div className="billboards-control-actions">
                  {selectedCustomerFilterId || customerFilterQuery ? (
                    <button
                      className="button ghost"
                      onClick={() => {
                        setCustomerFilterQuery("");
                        setSelectedCustomerFilterId("");
                      }}
                      type="button"
                    >
                      Pulisci
                    </button>
                  ) : null}
                </div>
              </article>

              <article className="mini-item billboards-control-card billboards-control-card-wide">
                <div className="billboards-control-card-head">
                  <div>
                    <span className="compact-kicker">Fase 3</span>
                    <h3>Impianti e plance</h3>
                  </div>
                  <span className="pill status">
                    {quickSelectedTargets.length} {quickSelectedTargets.length === 1 ? "plancia" : "plance"}
                  </span>
                </div>

                <div className="billboards-quick-booking-layout">
                  <div className="billboards-quick-booking-main">
                    <BillboardAssetAutocomplete
                      assets={plannerAvailableAssets}
                      disabled={!hasValidPlannerRange}
                      emptyMessage="Nessun impianto libero nel periodo selezionato."
                      label="Cerca impianto libero"
                      maxSuggestions={8}
                      onQueryChange={setAssetSearchQuery}
                      onSelect={(asset) => {
                        const matchingAsset = assets.find((candidate) => candidate.id === asset.id);
                        if (!matchingAsset) {
                          return;
                        }

                        applyQuickAssetSelection(matchingAsset);
                        setSelectedAssetCode(asset.code);
                        setAssetSearchQuery("");
                      }}
                      placeholder={hasValidPlannerRange ? "Codice, posizione, tipologia" : "Seleziona prima il periodo"}
                      query={assetSearchQuery}
                      showMeta={false}
                    />

                    <div className="billboard-selected-targets-card">
                      <div className="list-header">
                        <strong>Plance selezionate</strong>
                        <span className="pill status">{quickSelectedTargets.length}</span>
                      </div>

                      {quickSelectedTargets.length === 0 ? (
                        <div className="empty billboard-multi-select-empty billboards-quick-booking-empty">
                          Nessuna plancia selezionata.
                        </div>
                      ) : (
                        <div className="billboard-target-list billboard-target-list-v2">
                          {quickSelectedTargets.map((asset) => {
                            const overlappingBookings = getQuickOverlappingBookings(asset.id);
                            const isBlocked = quickConflictingTargetIds.has(asset.id);
                            const availableSlots = getQuickAvailableMonitorSlots(asset.id);
                            const chosenSlot = quickSelectedMonitorSlots[asset.id] || availableSlots[0] || 1;
                            const occupiedSlots =
                              asset.kind === "MONITOR"
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
                                  <button
                                    className="ghost"
                                    onClick={() => removeQuickAssetSelection(asset.id)}
                                    type="button"
                                  >
                                    Rimuovi
                                  </button>
                                </div>
                                <div className="subtle">{asset.location || "Luogo da definire"}</div>

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
                                        const slotBooking = buildQuickSlots(asset)[slot - 1];
                                        const isAvailable = !slotBooking;
                                        const isSelected = chosenSlot === slot;
                                        return (
                                          <button
                                            className={`billboard-monitor-slot-choice${isSelected ? " is-selected" : ""}${isAvailable ? "" : " is-disabled"}`}
                                            disabled={!isAvailable}
                                            key={`${asset.id}-slot-${slot}`}
                                            onClick={() => {
                                              if (!isAvailable) {
                                                return;
                                              }
                                              setQuickSelectedMonitorSlots((current) => ({ ...current, [asset.id]: slot }));
                                            }}
                                            type="button"
                                          >
                                            {slot}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <div className="billboard-monitor-slot-grid compact">
                                      {buildQuickSlots(asset).map((slot, index) => (
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
                  </div>

                  <aside className="billboards-quick-booking-side">
                    <div className="mini-item billboard-pricing-card">
                      <div className="list-header">
                        <div>
                          <strong>Prezzi e riepilogo</strong>
                        </div>
                        <span className="pill">{formatCurrency(quickEffectiveUnitPriceCents)}</span>
                      </div>

                      {quickPricingMode === "EXISTING_PACKAGE" ? (
                        <p className={`hint${quickHasPackageCreditConflict ? " is-error" : ""}`}>
                          {selectedQuickPackage
                            ? quickSelectedPackageRemainingAfterSelection !== null && quickSelectedPackageRemainingAfterSelection >= 0
                              ? `Dopo questa prenotazione resteranno ${quickSelectedPackageRemainingAfterSelection} crediti.`
                              : "Questo pacchetto non ha abbastanza crediti residui."
                            : "Seleziona un pacchetto cliente."}
                        </p>
                      ) : null}

                      <div className="billboard-booking-step-grid">
                        <div className="field">
                          <label htmlFor="quickPriceBase">Prezzo listino per impianto</label>
                          <input
                            className="currency-input"
                            id="quickPriceBase"
                            inputMode="decimal"
                            onChange={(event) => setQuickBasePriceInput(event.target.value)}
                            type="text"
                            value={quickBasePriceInput}
                          />
                        </div>

                        <div className="field">
                          <label htmlFor="quickPriceDiscount">Sconto</label>
                          <input
                            id="quickPriceDiscount"
                            inputMode="decimal"
                            onChange={(event) => setQuickDiscountInput(event.target.value)}
                            placeholder="Es. 50 oppure 20%"
                            type="text"
                            value={quickDiscountInput}
                          />
                        </div>

                        <div className="field">
                          <label htmlFor="quickPaid">Incassato per impianto</label>
                          <input
                            className="currency-input"
                            id="quickPaid"
                            inputMode="decimal"
                            onChange={(event) => setQuickPaidInput(event.target.value)}
                            type="text"
                            value={quickPaidInput}
                          />
                        </div>
                      </div>

                      {quickPricingMode !== "SINGLE" && quickPricingMode !== "EXISTING_PACKAGE" ? (
                        <div className="billboard-booking-step-grid">
                          <div className="field">
                            <label htmlFor="quickPackageUnits">Crediti acquistati</label>
                            <input
                              disabled={quickPricingMode === "PACK_3" || quickPricingMode === "PACK_10"}
                              id="quickPackageUnits"
                              min={1}
                              onChange={(event) => setQuickPackageUnitsInput(event.target.value)}
                              type="number"
                              value={quickPricingMode === "PACK_3" ? "3" : quickPricingMode === "PACK_10" ? "10" : quickPackageUnitsInput}
                            />
                          </div>
                          <div className="field wide">
                            <label htmlFor="quickPackageNote">Nota pacchetto</label>
                            <input
                              id="quickPackageNote"
                              onChange={(event) => setQuickPackageNoteInput(event.target.value)}
                              placeholder="Es. blocco autunno / rivenditore / campagna"
                              value={quickPackageNoteInput}
                            />
                          </div>
                          <div className="billboard-package-summary">
                            <span className="compact-kicker">Residuo stimato</span>
                            <strong>
                              {quickNewPackageRemainingAfterSelection !== null ? `${quickNewPackageRemainingAfterSelection} crediti` : "N/D"}
                            </strong>
                            <span>
                              {quickHasPackageCreditConflict
                                ? "Il pacchetto nuovo non copre le plance selezionate."
                                : "I crediti residui potranno essere usati anche in date future."}
                            </span>
                          </div>
                        </div>
                      ) : null}

                      <div className="mini-item billboard-booking-balance-card field full">
                        <div className="list-header">
                          <div>
                            <strong>Riepilogo economico</strong>
                          </div>
                          <span className={`pill ${quickTotalBalancePreviewCents > 0 ? "warning" : "status"}`}>
                            Saldo totale {formatCurrency(quickTotalBalancePreviewCents)}
                          </span>
                        </div>
                        <div className="billboard-booking-financials">
                          <span>Plance {quickSelectedTargets.length}</span>
                          <span>Prezzo finale {formatCurrency(quickEffectiveUnitPriceCents)}</span>
                          <span>Valore totale {formatCurrency(quickTotalValuePreviewCents)}</span>
                          <span>Incassato totale {formatCurrency(quickTotalPaidPreviewCents)}</span>
                          <span>Residuo totale {formatCurrency(quickTotalBalancePreviewCents)}</span>
                        </div>
                        {quickHasBlockingTargetConflict ? (
                          <div className="subtle">Una o piu plance non sono disponibili nel periodo selezionato.</div>
                        ) : null}
                        {quickHasPackageCreditConflict ? (
                          <div className="subtle">Il pacchetto scelto non copre il numero di plance selezionate.</div>
                        ) : null}
                      </div>

                      <div className="field full billboards-quick-booking-note">
                        <label htmlFor="quickNote">Note</label>
                        <textarea id="quickNote" onChange={(event) => setQuickNoteInput(event.target.value)} value={quickNoteInput} />
                      </div>

                      <div className="button-row billboards-quick-booking-submit">
                        <button className="ghost" onClick={resetQuickCreateSelection} type="button">
                          Pulisci plance
                        </button>
                        <QuickCreateSubmitButton disabled={!quickCanSubmit} selectionCount={quickSelectedTargets.length} />
                      </div>
                    </div>
                  </aside>
                </div>
              </article>
              </section>
            </form>
          ) : null}

          {selectedCustomer ? (
            <section className="card card-pad billboards-customer-vision-card">
              <div className="list-header">
                <div>
                  <span className="compact-kicker">Cliente</span>
                  <h3>{selectedCustomer.name}</h3>
                </div>
              </div>

              {selectedCustomerPackageList.length > 0 ? (
                <div className="billboards-customer-package-grid">
                  {selectedCustomerPackageList.map((pkg) => (
                    <article className="mini-item billboards-customer-package-card" key={pkg.id}>
                      <div className="list-header">
                        <strong>{pkg.label}</strong>
                        <span className="pill">{pkg.remainingUnits} residui</span>
                      </div>
                      <div className="billboards-customer-package-meta">
                        <span>{formatCurrency(pkg.unitPriceCents)} per plancia</span>
                        <span>{pkg.usedUnits}/{pkg.purchasedUnits} usati</span>
                        <span>{pkg.preset.replaceAll("_", " ")}</span>
                      </div>
                      {pkg.note ? <div className="subtle">{pkg.note}</div> : null}
                    </article>
                  ))}
                </div>
              ) : null}

              {selectedCustomerBookingGroups.length === 0 ? (
                <div className="empty">Nessuna prenotazione cartelloni per questo cliente nell'anno selezionato.</div>
              ) : (
                <div className="billboards-customer-groups-grid">
                  {selectedCustomerBookingGroups.map((group) => (
                    <article className="mini-item billboards-customer-group-card" key={group.asset.id}>
                      <div className="list-header">
                        <div>
                          <span className="billboard-asset-meta-label">{group.asset.code}</span>
                          <strong>{group.asset.name}</strong>
                          <div className="subtle">{simplifyBillboardLocation(group.asset.location)}</div>
                        </div>
                        <div className="billboards-inline-actions">
                          <button className="button secondary" onClick={() => openAssetCalendar(group.asset.code)} type="button">
                            Apri
                          </button>
                          <button className="button ghost" onClick={() => openAssetManager(group.asset.code)} type="button">
                            Gestisci
                          </button>
                        </div>
                      </div>
                      <div className="billboards-customer-period-list">
                        {group.bookings.map((booking) => (
                          <button
                            className="billboards-customer-period-chip"
                            key={booking.id}
                            onClick={() => openBookingEditor(booking.id)}
                            type="button"
                          >
                            <span>{formatCompactDate(parseDateKey(booking.startsAt))} - {formatCompactDate(parseDateKey(booking.endsAt))}</span>
                            <strong>{booking.packageLabel || formatCurrency(booking.priceCents)}</strong>
                          </button>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          <section
            className="billboards-booking-browser-search global-search-column global-search-column-records"
            ref={bookingSearchRef}
          >
            <label className="global-search-label" htmlFor="billboards-booking-search">
              Ricerca prenotazioni
            </label>
            <div className="global-search-field-shell">
              <svg aria-hidden="true" className="glyph global-search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="m20 20-3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <input
                aria-label="Cerca prenotazione"
                autoComplete="off"
                id="billboards-booking-search"
                onChange={(event) => setBookingSearchQuery(event.target.value)}
                onFocus={() => setBookingSearchOpen(true)}
                placeholder="Cerca prenotazione per cliente, impianto o nota"
                spellCheck={false}
                value={bookingSearchQuery}
              />
              {bookingSearchQuery ? (
                <button
                  aria-label="Pulisci ricerca prenotazioni"
                  className="global-search-clear"
                  onClick={() => {
                    setBookingSearchQuery("");
                    setBookingSearchOpen(true);
                  }}
                  type="button"
                >
                  <span />
                  <span />
                </button>
              ) : null}
            </div>

            {bookingSearchOpen ? (
              <div className="global-search-panel billboards-booking-browser-panel" onMouseDown={(event) => event.stopPropagation()}>
                {bookingBrowserItems.length === 0 ? (
                  <div className="mini-item global-search-empty">
                    <strong>Nessuna prenotazione</strong>
                    <span className="subtle">Non ci sono risultati nel periodo selezionato.</span>
                  </div>
                ) : (
                  <div className="billboards-booking-browser-list">
                    {bookingBrowserItems.map((booking) => {
                      const isActive = editingBookingId === booking.id;
                      const isCurrent = bookingIncludesDay(booking, todayKey);
                      return (
                        <button
                          className={`billboards-booking-browser-item${isActive ? " is-active" : ""}`}
                          key={booking.id}
                          onClick={() => {
                            setBookingSearchOpen(false);
                            openBookingEditor(booking.id);
                          }}
                          onMouseDown={(event) => event.preventDefault()}
                          type="button"
                        >
                          <div className="billboards-booking-browser-head">
                            <div>
                              <span className="billboard-asset-meta-label">{booking.billboardAsset.code}</span>
                              <strong>{booking.customer.name}</strong>
                            </div>
                            <div className="billboards-inline-actions">
                              {booking.monitorSlot ? <span className="pill">Slot {booking.monitorSlot}</span> : null}
                              <span className={`pill ${isCurrent ? "warning" : "status"}`}>
                                {isCurrent ? "In corso" : "Apri"}
                              </span>
                            </div>
                          </div>
                          <div className="billboards-booking-browser-meta">
                            <span>{booking.billboardAsset.name}</span>
                            <span>
                              {formatCompactDate(parseDateKey(booking.startsAt))} - {formatCompactDate(parseDateKey(booking.endsAt))}
                            </span>
                            <span>{booking.packageLabel || formatCurrency(booking.priceCents)}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
          </section>
        </>
      ) : null}

      {shouldShowBookingForm ? (
        <section
          className={`card card-pad billboards-booking-card-v2 billboards-booking-card-v4${isMonitorKind || isVelaKind ? " billboards-booking-card-special" : ""}`}
          id="new-billboard-booking"
          ref={bookingRef}
        >
          <div className="list-header">
            <div>
              <h3>{editableBooking ? "Modifica prenotazione" : "Nuova prenotazione"}</h3>
            </div>
            {bookingFormAsset ? <span className="pill status">{bookingFormAsset.code}</span> : null}
          </div>
          <BillboardBookingForm
            assets={assets.map((asset) => ({
              id: asset.id,
              code: asset.code,
              name: asset.name,
              kind: asset.kind,
              location: asset.location
            }))}
            customerPackages={customerPackages}
            customers={customers.map((customer) => ({
              ...customer,
              type: customer.type
            }))}
            defaultAsset={
              bookingFormAsset
                ? {
                    id: bookingFormAsset.id,
                    code: bookingFormAsset.code,
                    name: bookingFormAsset.name,
                    kind: bookingFormAsset.kind,
                    location: bookingFormAsset.location
                  }
                : null
            }
	            defaultBooking={
              editableBooking
                ? {
                    id: editableBooking.id,
                    billboardAssetId: editableBooking.billboardAssetId,
                    billboardCustomerPackageId: editableBooking.billboardCustomerPackageId,
                    customerId: editableBooking.customer.id,
                    customerName: editableBooking.customer.name,
                    monitorSlot: editableBooking.monitorSlot,
                    startsAt: editableBooking.startsAt,
                    endsAt: editableBooking.endsAt,
                    priceInput: formatMoneyInput(editableBooking.priceCents),
                    paidInput: formatMoneyInput(editableBooking.paidCents),
                    note: editableBooking.note || ""
                  }
                : null
            }
	            defaultCustomerId={selectedCustomerFilterId}
	            defaultCustomerName={selectedCustomer?.name || customerFilterQuery}
	            defaultPricingMode={quickPricingMode}
	            defaultSelectedPackageId={quickPricingMode === "EXISTING_PACKAGE" ? quickSelectedPackageId : ""}
            fixedKind={isMonitorKind ? "MONITOR" : isVelaKind ? "VELA_ITINERANTE" : null}
	            defaultEndDate={editableBooking ? editableBooking.endsAt : bookingSeedEndKey || customerBookingDefaultEndKey}
	            defaultStartDate={editableBooking ? editableBooking.startsAt : bookingSeedStartKey || plannerStartKey}
	            existingBookings={existingBookings}
            key={`${editingBookingId || "create"}-${bookingFormAsset?.id || "none"}-${bookingSeedStartKey}-${bookingSeedEndKey}-${monthDateKey}-${selectedCustomerFilterId}`}
            mode={editableBooking ? "update" : "create"}
          />
        </section>
      ) : null}

      {managedAsset ? (
        <section className="card card-pad billboards-asset-manager-card" ref={assetManagerRef}>
          <div className="list-header">
            <div>
              <span className="compact-kicker">Gestione impianto</span>
              <h3>{managedAsset.name}</h3>
            </div>
            <span className="pill status">{managedAsset.code}</span>
          </div>

          <div className="billboards-asset-manager-layout">
            <BillboardAssetManagerForm
              asset={{
                id: managedAsset.id,
                code: managedAsset.code,
                name: managedAsset.name,
                kind: managedAsset.kind,
                location: managedAsset.location,
                sortOrder: managedAsset.sortOrder,
                bookingCount: yearBookings.filter((booking) => booking.billboardAssetId === managedAsset.id).length
              }}
              returnDate={monthDateKey}
            />

            <div className="mini-item billboards-asset-manager-history">
              <div className="list-header">
                <strong>Prenotazioni impianto</strong>
                <span className="pill">{managedAsset.bookings.length}</span>
              </div>
              <div className="billboards-asset-manager-bookings">
                {managedAsset.bookings.length === 0 ? (
                  <div className="empty">Nessuna prenotazione futura collegata.</div>
                ) : (
                  managedAsset.bookings.map((booking) => (
                    <button
                      className="billboards-asset-manager-booking"
                      key={booking.id}
                      onClick={() => openBookingEditor(booking.id)}
                      type="button"
                    >
                      <strong>{booking.customer.name}</strong>
                      <span>{formatDate(parseDateKey(booking.startsAt))} - {formatDate(parseDateKey(booking.endsAt))}</span>
                      <span>{booking.packageLabel || formatCurrency(booking.priceCents)}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {isVelaKind && velaAsset && velaSnapshot ? (
        <section className="billboards-vela-workspace" id="billboards-vela-board">
          <article className="card card-pad billboards-vela-status-card">
            <div className="list-header">
              <div>
                <h3>{velaAsset.name}</h3>
                {velaAsset.location ? <div className="subtle">{simplifyBillboardLocation(velaAsset.location)}</div> : null}
              </div>
              <span className={`pill ${velaSnapshot.activeBooking ? "warning" : "status"}`}>{velaSnapshot.statusLabel}</span>
            </div>

            <div className="billboards-vela-status-body">
              <span className="billboard-asset-meta-label">{velaAsset.code}</span>
              <strong>{velaSnapshot.customerLabel}</strong>
              <span>{velaSnapshot.dateLabel}</span>
            </div>

            <div className="billboards-inline-actions">
              {velaSnapshot.activeBooking || velaSnapshot.nextBooking ? (
                <button
                  className="button secondary"
                  onClick={() => openBookingEditor((velaSnapshot.activeBooking || velaSnapshot.nextBooking)!.id)}
                  type="button"
                >
                  Apri prenotazione
                </button>
              ) : null}
              <button className="button ghost" onClick={() => openAssetManager(velaAsset.code)} type="button">
                Gestisci impianto
              </button>
            </div>
          </article>

          <section className="card card-pad calendar-shell billboards-calendar-card-v3 billboards-calendar-card-v4 billboards-vela-calendar-card" ref={calendarRef}>
            <div className="calendar-nav">
              <div>
                <span className="compact-kicker">Disponibilita vela</span>
                <h3>{monthLabel}</h3>
                <div className="subtle">{velaAsset.code} • {velaAsset.name}</div>
              </div>
              <div className="calendar-nav-actions">
                <Link className="button secondary" href={monthHref(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))} scroll={false}>
                  Precedente
                </Link>
                <Link className="button ghost" href={monthHref(new Date())} scroll={false}>
                  Oggi
                </Link>
                <Link className="button secondary" href={monthHref(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))} scroll={false}>
                  Successivo
                </Link>
              </div>
            </div>

            <div className="billboards-biweek-list">
              {biweekRows.map((days, index) => (
                <div
                  className="billboards-biweek-row"
                  key={`vela-biweek-${index}`}
                  style={{ ["--billboards-biweek-columns" as string]: String(days.length) }}
                >
                  {days.map((day) => {
                    const isFocusMonth = day.date.getMonth() === monthDate.getMonth();
                    const activeBooking = day.entries[0] || null;
                    return (
                      <button
                        className={`billboards-biweek-day${isFocusMonth ? "" : " is-muted"}${day.isToday ? " is-today" : ""}${activeBooking ? " is-occupied" : " is-available"}${day.isFullyOccupied ? " is-full" : ""}${day.isInHighlightedRange ? " is-highlighted" : ""}${day.isRangeStart ? " is-range-start" : ""}${day.isRangeEnd ? " is-range-end" : ""}`}
                        key={day.key}
                        onClick={() => {
                          if (activeBooking) {
                            openBookingEditor(activeBooking.id);
                            return;
                          }

                          openAssetBooking(velaAsset.code, day.key);
                        }}
                        title={getCalendarDayTitle(day, velaAsset)}
                        type="button"
                      >
                        <div className="billboards-biweek-day-head">
                          <span>{formatWeekdayLabel(day.date, "compact")}</span>
                          <strong>{day.date.getDate()}</strong>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
        </section>
      ) : null}

      {isMonitorKind && monitorBoardAssets.length > 0 ? (
        <section className="card card-pad billboards-monitor-board" id="billboards-monitor-board">
          <div className="list-header">
            <div>
              <h3>Plancia monitor</h3>
              <div className="subtle">Slot del {formatDate(monitorBoardDate)}</div>
            </div>
          </div>
          <div className="billboards-monitor-board-grid">
            {monitorBoardAssets.map((asset) => (
              <article className="mini-item billboards-monitor-board-card" key={asset.id}>
                <div className="list-header">
                  <div>
                    <strong>{asset.name}</strong>
                    <div className="subtle">{asset.code}</div>
                  </div>
                  <span className={`pill ${asset.occupiedCount > 0 ? "warning" : "status"}`}>{asset.occupiedCount}/6</span>
                </div>
                <div className="billboard-monitor-slot-grid">
                  {asset.slots.map((slot) => (
                    <button
                      className={`billboard-monitor-slot${slot.booking ? " is-occupied" : " is-free"}`}
                      key={`${asset.id}-board-${slot.index}`}
                      onClick={() => {
                        setSelectedAssetCode(asset.code);
                        openFocus("day", formatDateKey(monitorBoardDate), slot.booking ? "bookings" : "free");
                      }}
                      type="button"
                    >
                      <span className="billboard-monitor-slot-index">Slot {slot.index}</span>
                      <strong>{slot.booking ? slot.booking.customer.name : "Libero"}</strong>
                    </button>
                  ))}
                </div>
                <div className="billboards-inline-actions">
                  <button
                    className="button secondary"
                    onClick={() => {
                      setSelectedAssetCode(asset.code);
                      openFocus("day", formatDateKey(monitorBoardDate), "bookings");
                    }}
                    type="button"
                  >
                    Apri giorno
                  </button>
                  <button className="button ghost" onClick={() => openAssetManager(asset.code)} type="button">
                    Gestisci
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {isMonitorKind ? (
        <section className={`billboards-overview-grid${monitorFocusContent ? " has-focus" : ""}`} style={overviewStyle}>
          <section
            className={`card card-pad calendar-shell billboards-calendar-card-v3${monitorFocusContent ? " is-compressed" : ""}`}
            ref={calendarRef}
          >
            <div className="calendar-nav">
              <div>
                <span className="compact-kicker">{calendarAsset ? "Monitor selezionato" : "Monitor"}</span>
                <h3>{monthLabel}</h3>
                {calendarAsset ? <div className="subtle">{calendarAsset.code} • {calendarAsset.name}</div> : null}
              </div>
              <div className="calendar-nav-actions">
                {calendarAsset ? (
                  <button className="button ghost" onClick={clearSelectedAsset} type="button">
                    Tutti i monitor
                  </button>
                ) : null}
                <Link className="button secondary" href={monthHref(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))} scroll={false}>
                  Precedente
                </Link>
                <Link className="button ghost" href={monthHref(new Date())} scroll={false}>
                  Oggi
                </Link>
                <Link className="button secondary" href={monthHref(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))} scroll={false}>
                  Successivo
                </Link>
              </div>
            </div>

            <div className="calendar-month-wrap">
              <div className="calendar-month-weekdays">
                {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((weekday) => (
                  <span key={weekday}>{weekday}</span>
                ))}
              </div>
              <div className="calendar-month-grid">
                {monthMatrix.flat().map((day) => {
                  const isFocusMonth = day.date.getMonth() === monthDate.getMonth();
                  const canBookSelectedAssetDay = Boolean(calendarAsset && day.freeCount > 0);
                  return (
                    <div
                      className={`calendar-month-cell billboard-day-cell-v2${isFocusMonth ? "" : " muted"}${day.isToday ? " today" : ""}${day.isFullyOccupied ? " is-fully-occupied" : ""}`}
                      key={day.key}
                    >
                      <div className="calendar-month-head">
                        <button
                          className="billboard-day-head-link"
                          onClick={() => {
                            if (calendarAsset && day.freeCount > 0) {
                              openAssetBooking(calendarAsset.code, day.key);
                              return;
                            }

                            openFocus("day", day.key, "bookings");
                          }}
                          type="button"
                        >
                          <strong>{day.date.getDate()}</strong>
                          <span>{day.entries.length}</span>
                        </button>
                      </div>
                      <div className="billboard-day-stats">
                        <button
                          className="billboard-day-stat billboard-day-stat-occupied"
                          onClick={() => openFocus("day", day.key, calendarAsset ? "bookings" : "occupied")}
                          type="button"
                        >
                          <em>Occ.</em>
                          <strong>{day.occupiedCount}</strong>
                        </button>
                        <button
                          className="billboard-day-stat billboard-day-stat-free"
                          onClick={() => {
                            if (calendarAsset && day.freeCount > 0) {
                              openAssetBooking(calendarAsset.code, day.key);
                              return;
                            }

                            openFocus("day", day.key, "free");
                          }}
                          type="button"
                        >
                          <em>{canBookSelectedAssetDay ? "Pren." : "Lib."}</em>
                          <strong>{day.freeCount}</strong>
                        </button>
                      </div>
                      {!calendarAsset && day.topAssets.length > 0 ? (
                        <div className="billboard-day-assets">
                          {day.topAssets.map((assetCode) => (
                            <span className="pill" key={assetCode}>
                              {assetCode}
                            </span>
                          ))}
                          {day.hiddenAssetsCount > 0 ? <span className="pill">+{day.hiddenAssetsCount}</span> : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {monitorFocusContent ? (
            <aside className="card card-pad billboards-focus-panel-v2" id="billboards-focus-panel" ref={panelRef}>
              <div className="list-header">
                <div>
                  <h3>{monitorFocusContent.title}</h3>
                </div>
                <div className="billboards-focus-actions">
                  <span className="pill">{monitorFocusContent.count}</span>
                  <button className="button ghost" onClick={closeFocus} type="button">
                    Chiudi
                  </button>
                </div>
              </div>

              <div className="billboards-focus-panel-body">
                {monitorFocusContent.kind === "assets" ? (
                  <div className="billboard-focus-assets-list">
                    {monitorFocusContent.assets.length === 0 ? (
                      <div className="empty">Nessun monitor in questo gruppo.</div>
                    ) : (
                      monitorFocusContent.assets.map((asset) => (
                        <article
                          className={`billboard-asset-card-v2${asset.isOccupied ? " is-occupied" : ""}${selectedAssetCode === asset.code ? " is-selected" : ""}`}
                          key={asset.id}
                        >
                          <div className="list-header">
                            <div>
                              <strong>{asset.name}</strong>
                              <div className="subtle">{billboardAssetKindLabels[asset.kind]}</div>
                            </div>
                            <span className={`pill ${asset.monitorOccupancy > 0 ? "warning" : "status"}`}>
                              {asset.monitorOccupancy}/6
                            </span>
                          </div>
                          <div className="billboard-asset-body-v2">
                            <span className="billboard-asset-meta-label">{asset.code}</span>
                            <span className="billboard-asset-meta-value">{asset.customerLabel}</span>
                            <span>{asset.dateLabel}</span>
                            <span>{asset.locationLabel}</span>
                          </div>
                          <div className="billboards-inline-actions">
                            <button className="button secondary" onClick={() => openAssetCalendar(asset.code)} type="button">
                              Apri
                            </button>
                            {dayView === "free" ? (
                              <button
                                className="button primary"
                                onClick={() => openAssetBooking(asset.code, dayKey || todayKey)}
                                type="button"
                              >
                                Prenota
                              </button>
                            ) : null}
                            <button className="button ghost" onClick={() => openAssetManager(asset.code)} type="button">
                              Gestisci
                            </button>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="compact-order-list billboard-focus-bookings-list">
                    {monitorFocusContent.bookings.length === 0 ? (
                      <div className="empty">Nessuna prenotazione in questo gruppo.</div>
                    ) : (
                      monitorFocusContent.bookings.map((booking) => (
                        <BookingFocusCard
                          booking={booking}
                          key={booking.id}
                          onEdit={() => openBookingEditor(booking.id)}
                          todayKey={todayKey}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            </aside>
          ) : null}
        </section>
      ) : null}

      {isGeneralKind ? (
        <>
          <section
            className={`billboards-overview-grid${isGeneralSummaryFocus ? " has-focus has-day-summary" : ""}`}
            style={overviewStyle}
          >
            <section
              className={`card card-pad calendar-shell billboards-calendar-card-v3 billboards-calendar-card-v4${isGeneralSummaryFocus ? " is-compressed" : ""}`}
              ref={calendarRef}
            >
              <div className="calendar-nav">
                <div>
                  <span className="compact-kicker">{calendarAsset ? "Disponibilita impianto" : "Disponibilita"}</span>
                  <h3>{monthLabel}</h3>
                  {calendarAsset ? <div className="subtle">{calendarAsset.code} • {calendarAsset.name}</div> : null}
                </div>
                <div className="calendar-nav-actions">
                  {calendarAsset ? (
                    <button className="button ghost" onClick={clearSelectedAsset} type="button">
                      Tutti gli impianti
                    </button>
                  ) : null}
                  <Link className="button secondary" href={monthHref(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))} scroll={false}>
                    Precedente
                  </Link>
                  <Link className="button ghost" href={monthHref(new Date())} scroll={false}>
                    Oggi
                  </Link>
                  <Link className="button secondary" href={monthHref(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))} scroll={false}>
                    Successivo
                  </Link>
                </div>
              </div>

              <div className="billboards-biweek-list">
                {biweekRows.map((days, index) => (
                  <div
                    className="billboards-biweek-row"
                    key={`biweek-${index}`}
                    style={{ ["--billboards-biweek-columns" as string]: String(days.length) }}
                  >
                    {days.map((day) => {
                      const isFocusMonth = day.date.getMonth() === monthDate.getMonth();
                      const canBookSelectedAssetDay = Boolean(calendarAsset && day.freeCount > 0);
                      const occupiedHeight = Math.max(10, Math.round((day.occupiedCount / generalDayMetricMax) * 100));
                      const freeHeight = Math.max(10, Math.round((day.freeCount / generalDayMetricMax) * 100));
                      return (
                        <button
                          className={`billboards-biweek-day${isFocusMonth ? "" : " is-muted"}${day.isToday ? " is-today" : ""}${day.isFullyOccupied ? " is-full" : ""}${day.isInHighlightedRange ? " is-highlighted" : ""}${day.isRangeStart ? " is-range-start" : ""}${day.isRangeEnd ? " is-range-end" : ""}`}
                          key={day.key}
                          onClick={() => {
                            if (calendarAsset && canBookSelectedAssetDay) {
                              openAssetBooking(calendarAsset.code, day.key);
                              return;
                            }
                            openFocus("day", day.key);
                          }}
                          title={getCalendarDayTitle(day, calendarAsset)}
                          type="button"
                        >
                          <div className="billboards-biweek-day-head">
                            <span>{formatWeekdayLabel(day.date, "compact")}</span>
                            <strong>{day.date.getDate()}</strong>
                          </div>
                          <div className="billboards-biweek-day-chart" aria-hidden="true">
                            <div className="billboards-biweek-day-chart-column">
                              <div className="billboards-biweek-day-chart-bar">
                                <div
                                  className="billboards-biweek-day-chart-fill is-occupied"
                                  style={{ height: `${day.occupiedCount === 0 ? 0 : occupiedHeight}%` }}
                                />
                              </div>
                            </div>
                            <div className="billboards-biweek-day-chart-column">
                              <div className="billboards-biweek-day-chart-bar">
                                <div
                                  className="billboards-biweek-day-chart-fill is-free"
                                  style={{ height: `${day.freeCount === 0 ? 0 : freeHeight}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>

            {generalFocusContent?.kind === "day" ? (
              <aside className="card card-pad billboards-focus-panel-v2 billboards-focus-panel-v4 billboards-asset-selector-panel billboards-day-summary-panel" id="billboards-focus-panel" ref={panelRef}>
                <div className="list-header">
                  <div>
                    <span className="compact-kicker">
                      Giorno
                    </span>
                    <h3>{generalFocusContent.title}</h3>
                  </div>
                  <div className="billboards-inline-actions">
                    <button className="button ghost" onClick={closeFocus} type="button">
                      Chiudi
                    </button>
                  </div>
                </div>

                <div className="billboards-focus-panel-body">
                  <div className="billboards-day-summary">
                    <Link className="billboards-day-summary-button is-bookings" href={dayFocusHref(generalFocusContent.dayKey, "bookings")}>
                      <span>Prenotazioni</span>
                      <strong>{generalFocusContent.bookingCount}</strong>
                    </Link>
                    <Link className="billboards-day-summary-button is-free" href={dayFocusHref(generalFocusContent.dayKey, "free")}>
                      <span>Disponibili</span>
                      <strong>{generalFocusContent.availableCount}</strong>
                    </Link>
                  </div>
                </div>
              </aside>
            ) : null}
          </section>

          <section className="card card-pad billboards-performance-card">
            <div className="list-header">
              <div>
                <span className="compact-kicker">Andamento impianti</span>
                <h3>{performanceSeasonLabel}</h3>
              </div>
            </div>
            {performanceSeries.length === 0 ? (
              <div className="empty">Nessun dato disponibile per il grafico.</div>
            ) : (
              <div className="billboards-performance-stack">
                {performanceSeries.map((asset) => (
                  <article className="billboards-performance-row" key={asset.asset.id}>
                    <div className="billboards-performance-row-label">
                      <span className="billboard-asset-meta-label">{asset.asset.code}</span>
                      <strong>{asset.asset.name}</strong>
                    </div>
                    <div className="billboards-performance-row-chart">
                      <div className="billboards-performance-axis">
                        <span>{asset.maxMonthValue.toFixed(1)}</span>
                        <span>0</span>
                      </div>
                      <div className="billboards-performance-month-strip">
                        {BILLBOARD_PERFORMANCE_MONTHS.map((month, monthIndex) => {
                          const value = asset.months[monthIndex] || 0;
                          return (
                            <div className="billboards-performance-month-column" key={`${asset.asset.id}-${month.label}`}>
                              <div className="billboards-performance-month-bar-shell">
                                <div
                                  className="billboards-performance-month-bar"
                                  style={{
                                    height: value > 0 ? `${Math.max(10, (value / asset.maxMonthValue) * 100)}%` : "0%",
                                    backgroundColor: asset.color
                                  }}
                                  title={`${asset.asset.code} • ${month.label} • ${value.toFixed(1)} settimane`}
                                />
                              </div>
                              <span>{month.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}

      {isBookingsFreeKind ? (
        <section className="card card-pad billboards-day-detail-panel billboards-bookings-free-page" id="billboards-focus-panel" ref={panelRef}>
          <div className="list-header">
            <div>
              <span className="compact-kicker">Prenotazioni/Disponibili</span>
              <h3>
                {generalFocusContent?.kind === "available"
                  ? generalFocusContent.title
                  : generalFocusContent?.kind === "bookings"
                    ? generalFocusContent.title
                    : "Seleziona un giorno"}
              </h3>
            </div>
            <div className="billboards-inline-actions">
              <Link className="button ghost" href={dayKey ? dayFocusHref(dayKey, "day") : kindHref("CARTELLONE")}>
                Torna a Cartelloni
              </Link>
            </div>
          </div>

          {dayKey ? (
            <div className="billboards-day-summary">
              <Link
                className={`billboards-day-summary-button is-bookings${generalFocusContent?.kind === "bookings" ? " is-active" : ""}`}
                href={dayFocusHref(dayKey, "bookings")}
              >
                <span>Prenotazioni</span>
                <strong>{generalDaySummaryContent?.kind === "day" ? generalDaySummaryContent.bookingCount : 0}</strong>
              </Link>
              <Link
                className={`billboards-day-summary-button is-free${generalFocusContent?.kind === "available" ? " is-active" : ""}`}
                href={dayFocusHref(dayKey, "free")}
              >
                <span>Disponibili</span>
                <strong>{generalDaySummaryContent?.kind === "day" ? generalDaySummaryContent.availableCount : 0}</strong>
              </Link>
            </div>
          ) : null}

          {generalFocusContent?.kind === "bookings" ? (
            <section className="billboards-day-section">
              <div className="billboards-day-section-head">
                <div>
                  <h4>Plance con prenotazione</h4>
                </div>
                <span className="pill warning">{generalFocusContent.bookings.length}</span>
              </div>
              <div className="compact-order-list billboard-focus-bookings-list billboards-day-detail-list">
                {generalFocusContent.bookings.length === 0 ? (
                  <div className="empty">Nessuna prenotazione.</div>
                ) : (
                  generalFocusContent.bookings.map((booking) => (
                    <BookingFocusCard
                      booking={booking}
                      key={booking.id}
                      onEdit={() => openBookingEditor(booking.id)}
                      todayKey={todayKey}
                    />
                  ))
                )}
              </div>
            </section>
          ) : null}

          {generalFocusContent?.kind === "available" ? (
            <section className="billboards-day-section">
              <div className="billboards-day-section-head">
                <div>
                  <h4>Plance disponibili</h4>
                </div>
                <span className="pill status">{generalFocusContent.availableAssets.length}</span>
              </div>
              <div className="billboards-day-available-list billboards-day-available-list-open billboards-day-detail-list">
                {generalFocusContent.availableAssets.length === 0 ? (
                  <div className="empty">Nessun impianto disponibile in questa data.</div>
                ) : (
                  generalFocusContent.availableAssets.map((item) => (
                    <AvailabilityFocusCard
                      item={item}
                      key={item.asset.id}
                      onManage={() => openAssetManager(item.asset.code)}
                      onOpen={() => openAssetBooking(item.asset.code, generalFocusContent.dayKey)}
                      tone="free"
                    />
                  ))
                )}
              </div>
            </section>
          ) : null}

          {!generalFocusContent ? (
            <div className="empty">Apri un giorno dai cartelloni per vedere prenotazioni o plance disponibili.</div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function BookingFocusCard({
  booking,
  onEdit,
  todayKey
}: {
  booking: PlainMonthBooking;
  onEdit: () => void;
  todayKey: string;
}) {
  const isActiveToday = bookingIncludesDay(booking, todayKey);

  return (
    <article className="compact-order-item billboard-focus-booking-card billboards-day-booking-item">
      <div className="billboards-day-booking-main">
        <div className="billboard-focus-booking-head">
          <span className="billboard-asset-meta-label">{booking.billboardAsset.code}</span>
          <strong className="billboard-focus-booking-title">{booking.billboardAsset.name}</strong>
          <span className="billboard-focus-booking-customer">{booking.customer.name}</span>
        </div>
        <div className="subtle billboard-focus-booking-dates">
          {formatDate(parseDateKey(booking.startsAt))} - {formatDate(parseDateKey(booking.endsAt))}
        </div>
        {booking.packageLabel ? <div className="subtle billboards-day-booking-package">{booking.packageLabel}</div> : null}
        {booking.note ? <div className="billboard-focus-booking-note">{booking.note}</div> : null}
        <div className="billboard-booking-financials">
          <span>{formatCurrency(booking.priceCents)}</span>
          <span>{`Pagato ${formatCurrency(booking.paidCents)}`}</span>
          <span className={booking.balanceDueCents > 0 ? "is-open" : ""}>{`Residuo ${formatCurrency(booking.balanceDueCents)}`}</span>
        </div>
      </div>
      <div className="billboards-day-booking-actions">
        <div className="billboards-day-booking-badges">
          <span className={`pill billboards-day-booking-pill${isActiveToday ? " is-active" : ""}`}>
            {isActiveToday ? "In corso" : "Programmato"}
          </span>
          {booking.monitorSlot ? <span className="pill billboards-day-booking-pill is-slot">{`Slot ${booking.monitorSlot}`}</span> : null}
        </div>
        <button className="button secondary billboard-focus-booking-edit" onClick={onEdit} type="button">
          Modifica
        </button>
      </div>
    </article>
  );
}

function AvailabilityFocusCard({
  item,
  tone,
  onOpen,
  onManage
}: {
  item: RangeAvailability;
  tone: "free" | "occupied";
  onOpen: () => void;
  onManage: () => void;
}) {
  return (
    <article className={`billboards-day-available-item is-${tone}`}>
      <div>
        <span className="billboard-asset-meta-label">{item.asset.code}</span>
        <strong>{item.asset.name}</strong>
        <span className="subtle">{simplifyBillboardLocation(item.asset.location)}</span>
        {item.overlappingBookings.length > 0 ? (
          <span className="subtle">
            {item.overlappingBookings
              .slice(0, 2)
              .map((booking) => `${booking.customer.name} (${formatCompactDate(parseDateKey(booking.startsAt))} - ${formatCompactDate(parseDateKey(booking.endsAt))})`)
              .join(" • ")}
          </span>
        ) : null}
      </div>
      <div className="billboards-day-available-actions">
        <span className={`pill ${tone === "free" ? "status" : "warning"}`}>
          {item.capacity > 1
            ? tone === "free"
              ? `${item.availableUnits} slot`
              : `${item.overlappingBookings.length} occupazioni`
            : tone === "free"
              ? "Libero"
              : "Occupato"}
        </span>
        <div className="billboards-inline-actions">
          <button className="button secondary" onClick={onManage} type="button">
            Gestisci
          </button>
          <button className="button primary" onClick={onOpen} type="button">
            {tone === "free" ? "Prenota" : "Apri"}
          </button>
        </div>
      </div>
    </article>
  );
}

function getGeneralFocusContent(
  focus: BillboardsFocus | null,
  input: {
    assets: PlainAsset[];
    yearBookings: PlainMonthBooking[];
    selectedAsset: PlainAsset | null;
    todayKey: string;
    selectedDayKey: string | null;
  }
): FocusContent {
  if (!focus || (focus !== "day" && focus !== "bookings" && focus !== "free")) {
    return null;
  }

  const dayKey = input.selectedDayKey || input.todayKey;
  const dayDate = parseDateKey(dayKey);
  const selectedAssetId = input.selectedAsset?.id || null;
  const scopedAssets = selectedAssetId ? input.assets.filter((asset) => asset.id === selectedAssetId) : input.assets;
  const scopedAssetIds = new Set(scopedAssets.map((asset) => asset.id));
  const dayBookings = input.yearBookings.filter((booking) => {
    if (!bookingIncludesDay(booking, dayKey)) {
      return false;
    }

    return scopedAssetIds.has(booking.billboardAssetId);
  });
  const availableAssets = scopedAssets
    .map((asset) =>
      getRangeAvailability(
        asset,
        dayKey,
        dayKey,
        dayBookings.filter((booking) => booking.billboardAssetId === asset.id)
      )
    )
    .filter((result) => result.availableUnits > 0);

  if (focus === "bookings") {
    return {
      kind: "bookings",
      title: `Prenotazioni ${formatDate(dayDate)}`,
      dayKey,
      bookings: dayBookings
    };
  }

  if (focus === "free") {
    return {
      kind: "available",
      title: `Disponibili ${formatDate(dayDate)}`,
      dayKey,
      availableAssets
    };
  }

  return {
    kind: "day",
    title: formatDate(dayDate),
    dayKey,
    bookingCount: dayBookings.length,
    availableCount: availableAssets.length,
    occupiedAssetCount: new Set(dayBookings.map((booking) => booking.billboardAssetId)).size,
    openBalanceCents: dayBookings.reduce((total, booking) => total + booking.balanceDueCents, 0)
  };
}

function getMonitorFocusContent(
  focus: BillboardsFocus | null,
  input: {
    assets: PlainAsset[];
    monthBookings: PlainMonthBooking[];
    yearBookings: PlainMonthBooking[];
    selectedAsset: PlainAsset | null;
    todayKey: string;
    selectedDayKey: string | null;
    dayView: BillboardDayView;
  }
): MonitorFocusContent {
  if (!focus) {
    return null;
  }

  if (focus === "bookings") {
    return {
      kind: "bookings",
      title: "Prenotazioni del mese",
      count: input.monthBookings.length,
      bookings: input.monthBookings
    };
  }

  if (focus === "day") {
    const dayKey = input.selectedDayKey || input.todayKey;
    const dayDate = parseDateKey(dayKey);
    const selectedAssetId = input.selectedAsset?.id || null;
    const scopedAssets = selectedAssetId ? input.assets.filter((asset) => asset.id === selectedAssetId) : input.assets;
    const scopedAssetIds = new Set(scopedAssets.map((asset) => asset.id));
    const dayBookings = input.yearBookings.filter((booking) => {
      if (!bookingIncludesDay(booking, dayKey)) {
        return false;
      }

      return scopedAssetIds.has(booking.billboardAssetId);
    });
    const dayFreeAssets = scopedAssets.filter((asset) => {
      const occupancy = asset.bookings.filter((booking) => bookingIncludesDay(booking, dayKey)).length;
      return occupancy < getBillboardAssetCapacity(asset.kind);
    });
    const dayOccupiedAssets = scopedAssets.filter((asset) =>
      asset.bookings.some((booking) => bookingIncludesDay(booking, dayKey))
    );

    if (input.dayView === "free" || input.dayView === "occupied") {
      const assets = input.dayView === "free" ? dayFreeAssets : dayOccupiedAssets;
      return {
        kind: "assets",
        title: `${input.dayView === "free" ? "Liberi" : "Occupati"} ${formatDate(dayDate)}`,
        count: assets.length,
        assets: assets.map((asset) => buildFocusAsset(asset, dayKey, dayKey))
      };
    }

    return {
      kind: "bookings",
      title: `Prenotazioni ${formatDate(dayDate)}`,
      count: dayBookings.length,
      bookings: dayBookings
    };
  }

  const dayKey = input.todayKey;
  const allAssets = input.assets.map((asset) => buildFocusAsset(asset, dayKey, dayKey));
  const assets =
    focus === "occupied"
      ? allAssets.filter((asset) => asset.isOccupied)
      : focus === "free"
        ? allAssets.filter((asset) => !asset.isOccupied || asset.monitorOccupancy < getBillboardAssetCapacity(asset.kind))
        : allAssets;

  return {
    kind: "assets",
    title:
      focus === "occupied"
        ? "Monitor occupati oggi"
        : focus === "free"
          ? "Monitor liberi oggi"
          : "Tutti i monitor",
    count: assets.length,
    assets
  };
}

function getRangeAvailability(
  asset: PlainAsset,
  startKey: string,
  endKey: string,
  sourceBookings: PlainAssetBooking[] = asset.bookings
): RangeAvailability {
  const overlappingBookings = sourceBookings.filter((booking) =>
    rangesOverlap(booking.startsAt, booking.endsAt, startKey, endKey)
  );
  const capacity = getBillboardAssetCapacity(asset.kind);

  if (asset.kind !== "MONITOR") {
    return {
      asset,
      availableUnits: overlappingBookings.length === 0 ? 1 : 0,
      capacity,
      overlappingBookings
    };
  }

  const occupiedSlots = new Set<number>();
  let unassignedBookings = 0;
  for (const booking of overlappingBookings) {
    if (booking.monitorSlot && booking.monitorSlot >= 1 && booking.monitorSlot <= capacity) {
      occupiedSlots.add(booking.monitorSlot);
    } else {
      unassignedBookings += 1;
    }
  }

  const occupiedUnits = Math.min(capacity, occupiedSlots.size + unassignedBookings);
  return {
    asset,
    availableUnits: Math.max(0, capacity - occupiedUnits),
    capacity,
    overlappingBookings
  };
}

function buildFocusAsset(asset: PlainAsset, startKey: string, endKey: string): FocusAsset {
  const rangeBookings = asset.bookings.filter((booking) => rangesOverlap(booking.startsAt, booking.endsAt, startKey, endKey));
  const activeBooking = rangeBookings[0];
  const nextBooking = asset.bookings
    .filter((booking) => booking.startsAt >= endKey)
    .sort((left, right) => toDayStamp(left.startsAt) - toDayStamp(right.startsAt))[0];
  const monitorOccupancy = asset.kind === "MONITOR" ? rangeBookings.length : activeBooking ? 1 : 0;

  return {
    ...asset,
    isOccupied: rangeBookings.length > 0,
    monitorOccupancy,
    bookingCountInRange: rangeBookings.length,
    customerLabel:
      asset.kind === "MONITOR"
        ? rangeBookings.length > 0
          ? rangeBookings
              .slice(0, 3)
              .map((booking) => booking.customer.name)
              .join(" • ")
          : "Libero"
        : activeBooking
          ? activeBooking.customer.name
          : "Libero",
    dateLabel:
      asset.kind === "MONITOR"
        ? rangeBookings.length > 0
          ? `Slot liberi ${Math.max(0, 6 - rangeBookings.length)}`
          : "6 slot disponibili"
        : activeBooking
          ? `${formatCompactDate(parseDateKey(activeBooking.startsAt))} - ${formatCompactDate(parseDateKey(activeBooking.endsAt))}`
          : nextBooking
            ? `Prossima ${formatCompactDate(parseDateKey(nextBooking.startsAt))} - ${formatCompactDate(parseDateKey(nextBooking.endsAt))}`
            : "Nessuna prenotazione",
    locationLabel: simplifyBillboardLocation(asset.location)
  };
}

function buildAssetSelectorSections(assets: FocusAsset[]): AssetSelectorSection[] {
  const sectionOrder: Array<{ kind: BillboardAssetKind; label: string }> = [
    { kind: "CARTELLONE", label: "Cartelloni" },
    { kind: "MONITOR", label: "Monitor" }
  ];

  return sectionOrder
    .map((section) => ({
      ...section,
      assets: assets.filter((asset) => asset.kind === section.kind)
    }))
    .filter((section) => section.assets.length > 0);
}

function simplifyBillboardLocation(location: string | null) {
  if (!location) {
    return "Luogo da definire";
  }

  return location.replace(/\s*-\s*-?\d+\.\d+\s*,\s*-?\d+\.\d+\s*$/, "").trim();
}

function formatMoneyInput(cents: number) {
  if (!cents) {
    return "";
  }

  return (cents / 100).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function buildMonthMatrix(
  bookings: PlainMonthBooking[],
  focusDate: Date,
  assets: PlainAsset[],
  todayKey: string,
  selectedAsset: PlainAsset | null,
  highlightStartKey: string,
  highlightEndKey: string
) {
  const first = startOfMonth(focusDate);
  const last = endOfMonth(focusDate);
  const gridStart = startOfWeek(first);
  let gridEnd = addDays(startOfWeek(last), 6);
  const visibleWeeks = ((startOfDay(gridEnd).getTime() - startOfDay(gridStart).getTime()) / 86_400_000 + 1) / 7;
  if (visibleWeeks % 2 !== 0) {
    gridEnd = addDays(gridEnd, 7);
  }
  const days: CalendarDay[] = [];

  for (let cursor = gridStart; cursor <= gridEnd; cursor = addDays(cursor, 1)) {
    const date = startOfDay(cursor);
    const dayKey = formatDateKey(date);
    const entries = bookings
      .filter((booking) => bookingIncludesDay(booking, dayKey))
      .sort(
        (left, right) =>
          left.billboardAsset.sortOrder - right.billboardAsset.sortOrder ||
          left.customer.name.localeCompare(right.customer.name, "it")
      );
    const occupancyByAssetId = new Map<string, number>();

    for (const booking of entries) {
      occupancyByAssetId.set(booking.billboardAssetId, (occupancyByAssetId.get(booking.billboardAssetId) || 0) + 1);
    }

    const occupiedAssetCodes = Array.from(new Set(entries.map((booking) => booking.billboardAsset.code)));
    const occupiedCount = selectedAsset
      ? occupancyByAssetId.get(selectedAsset.id) || 0
      : assets.filter((asset) => (occupancyByAssetId.get(asset.id) || 0) > 0).length;
    const freeCount = selectedAsset
      ? Math.max(0, getBillboardAssetCapacity(selectedAsset.kind) - (occupancyByAssetId.get(selectedAsset.id) || 0))
      : assets.filter((asset) => (occupancyByAssetId.get(asset.id) || 0) < getBillboardAssetCapacity(asset.kind)).length;

    days.push({
      key: dayKey,
      date,
      entries,
      occupiedCount,
      freeCount,
      isFullyOccupied: Boolean(selectedAsset && freeCount === 0),
      topAssets: occupiedAssetCodes.slice(0, 2),
      hiddenAssetsCount: Math.max(0, occupiedAssetCodes.length - 2),
      isToday: dayKey === todayKey,
      isInHighlightedRange: rangesOverlap(dayKey, dayKey, highlightStartKey, highlightEndKey),
      isRangeStart: dayKey === highlightStartKey,
      isRangeEnd: dayKey === highlightEndKey
    });
  }

  const weeks = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }

  return weeks;
}

function pairWeeks(weeks: CalendarDay[][]) {
  const rows: CalendarDay[][] = [];
  for (let index = 0; index < weeks.length; index += 2) {
    rows.push([...(weeks[index] || []), ...(weeks[index + 1] || [])]);
  }
  return rows;
}

function buildMonitorBoardAssets(assets: PlainAsset[], dayKey: string): MonitorBoardAsset[] {
  return assets
    .filter((asset) => asset.kind === "MONITOR")
    .map((asset) => {
      const overlappingBookings = asset.bookings.filter((booking) => bookingIncludesDay(booking, dayKey));
      const slotMap = new Map<number, PlainAssetBooking>();
      const unassigned: PlainAssetBooking[] = [];

      for (const booking of overlappingBookings) {
        if (booking.monitorSlot && booking.monitorSlot >= 1 && booking.monitorSlot <= 6 && !slotMap.has(booking.monitorSlot)) {
          slotMap.set(booking.monitorSlot, booking);
        } else {
          unassigned.push(booking);
        }
      }

      for (const booking of unassigned) {
        const firstFreeSlot = [1, 2, 3, 4, 5, 6].find((slot) => !slotMap.has(slot));
        if (!firstFreeSlot) {
          break;
        }
        slotMap.set(firstFreeSlot, booking);
      }

      return {
        ...asset,
        occupiedCount: overlappingBookings.length,
        slots: Array.from({ length: 6 }, (_, index) => ({
          index: index + 1,
          booking: slotMap.get(index + 1) || null
        }))
      };
    });
}

function groupBookingsByAsset(bookings: PlainMonthBooking[]) {
  const byAsset = new Map<string, { asset: PlainAsset; bookings: PlainMonthBooking[] }>();

  for (const booking of bookings) {
    const existing = byAsset.get(booking.billboardAssetId);
    if (existing) {
      existing.bookings.push(booking);
      continue;
    }

    byAsset.set(booking.billboardAssetId, {
      asset: {
        id: booking.billboardAsset.id,
        code: booking.billboardAsset.code,
        name: booking.billboardAsset.name,
        kind: booking.billboardAsset.kind,
        location: booking.billboardAsset.location || null,
        sortOrder: booking.billboardAsset.sortOrder,
        bookings: []
      },
      bookings: [booking]
    });
  }

  return Array.from(byAsset.values())
    .map((group) => ({
      ...group,
      bookings: group.bookings.sort((left, right) => toDayStamp(left.startsAt) - toDayStamp(right.startsAt))
    }))
    .sort((left, right) => left.asset.sortOrder - right.asset.sortOrder);
}

function buildAssetPerformanceSeries(
  assets: PlainAsset[],
  bookings: PlainMonthBooking[],
  seasonStartYear: number
) {
  const assetPalette = ["#2456c4", "#2d8f62", "#d97706", "#9333ea", "#0f766e", "#d9485f", "#4f46e5", "#8b5cf6"];
  const assetRows = assets.map((asset) => {
    const assetBookings = bookings.filter((booking) => booking.billboardAssetId === asset.id);
    const months = BILLBOARD_PERFORMANCE_MONTHS.map((month) =>
      computeAssetOccupiedWeeksForMonth(assetBookings, seasonStartYear + month.yearOffset, month.index)
    );

    return {
      asset,
      months,
      total: months.reduce((sum, value) => sum + value, 0)
    };
  });

  const ranked = assetRows.sort((left, right) => left.asset.sortOrder - right.asset.sortOrder);

  const maxValue = Math.max(...ranked.flatMap((entry) => entry.months), 1);

  return ranked.map((entry, index) => ({
    ...entry,
    color: assetPalette[index % assetPalette.length],
    maxMonthValue: maxValue
  }));
}

function computeAssetOccupiedWeeksForMonth(bookings: PlainMonthBooking[], year: number, monthIndex: number) {
  const monthStart = new Date(year, monthIndex, 1, 12, 0, 0);
  const monthEnd = new Date(year, monthIndex + 1, 0, 12, 0, 0);
  const occupiedDays = new Set<string>();

  for (const booking of bookings) {
    const bookingStart = parseDateKey(booking.startsAt);
    const bookingEnd = parseDateKey(booking.endsAt);
    const cursorStart = bookingStart > monthStart ? bookingStart : monthStart;
    const cursorEnd = bookingEnd < monthEnd ? bookingEnd : monthEnd;

    if (cursorEnd < monthStart || cursorStart > monthEnd) {
      continue;
    }

    for (let cursor = cursorStart; cursor <= cursorEnd; cursor = addDays(cursor, 1)) {
      occupiedDays.add(formatDateKey(cursor));
    }
  }

  return Math.round((occupiedDays.size / 7) * 10) / 10;
}

function getCalendarDayTitle(day: CalendarDay, selectedAsset: PlainAsset | null) {
  if (selectedAsset) {
    return `${formatDate(day.date)} • ${day.freeCount > 0 ? `${day.freeCount} slot liberi` : "Pieno"}`;
  }

  return `${formatDate(day.date)} • ${day.occupiedCount} occupati • ${day.freeCount} disponibili`;
}

function parseDateKey(value: string) {
  return new Date(`${value}T12:00:00`);
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

function parseQuickPackageUnitsInput(value: string, pricingMode: QuickPricingMode, fallback: number) {
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

function bookingIncludesDay(booking: { startsAt: string; endsAt: string }, dayKey: string) {
  return booking.startsAt <= dayKey && booking.endsAt >= dayKey;
}

function rangesOverlap(leftStart: string, leftEnd: string, rightStart: string, rightEnd: string) {
  return leftStart <= rightEnd && leftEnd >= rightStart;
}

function getBillboardAssetCapacity(kind: BillboardAssetKind) {
  return kind === "MONITOR" ? 6 : 1;
}

function getDateRangeLength(startKey: string, endKey: string) {
  if (!startKey || !endKey || endKey < startKey) {
    return 0;
  }

  const start = parseDateKey(startKey);
  const end = parseDateKey(endKey);
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / dayMs) + 1;
}

function toDayStamp(value: string) {
  return new Date(`${value}T12:00:00`).getTime();
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 12, 0, 0);
}

function startOfWeek(date: Date) {
  const next = startOfDay(date);
  const day = next.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(next, offset);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return startOfDay(next);
}

function isSameMonth(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

const BILLBOARD_PERFORMANCE_MONTHS = [
  { label: "Set", index: 8, yearOffset: 0 },
  { label: "Ott", index: 9, yearOffset: 0 },
  { label: "Nov", index: 10, yearOffset: 0 },
  { label: "Dic", index: 11, yearOffset: 0 },
  { label: "Gen", index: 0, yearOffset: 1 },
  { label: "Feb", index: 1, yearOffset: 1 },
  { label: "Mar", index: 2, yearOffset: 1 },
  { label: "Apr", index: 3, yearOffset: 1 },
  { label: "Mag", index: 4, yearOffset: 1 },
  { label: "Giu", index: 5, yearOffset: 1 },
  { label: "Lug", index: 6, yearOffset: 1 },
  { label: "Ago", index: 7, yearOffset: 1 }
] as const;
