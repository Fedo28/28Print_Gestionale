"use client";

import Link from "next/link";
import { BillboardAssetKind, CustomerType } from "@prisma/client";
import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { BillboardBookingForm } from "@/components/billboard-booking-form";
import { PageHeader } from "@/components/page-header";
import { billboardAssetKindLabels } from "@/lib/constants";
import { formatCurrency, formatDate, formatDateKey } from "@/lib/format";

type BillboardsFocus = "assets" | "occupied" | "free" | "bookings" | "day";
type BillboardKindFilter = "ALL" | BillboardAssetKind;

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
    sortOrder: number;
  };
};

type FocusAsset = PlainAsset & {
  isOccupied: boolean;
  monitorOccupancy: number;
  customerLabel: string;
  dateLabel: string;
  locationLabel: string;
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

type BillboardsWorkspaceProps = {
  assets: PlainAsset[];
  customers: CustomerOption[];
  initialAssetCode: string | null;
  initialBookingOpen: boolean;
  initialDayKey: string | null;
  initialFocus: BillboardsFocus | null;
  initialKind: BillboardKindFilter;
  monthBookings: PlainMonthBooking[];
  monthDateKey: string;
  monthLabel: string;
  todayKey: string;
};

export function BillboardsWorkspace({
  assets,
  customers,
  initialAssetCode,
  initialBookingOpen,
  initialDayKey,
  initialFocus,
  initialKind,
  monthBookings,
  monthDateKey,
  monthLabel,
  todayKey
}: BillboardsWorkspaceProps) {
  const [focus, setFocus] = useState<BillboardsFocus | null>(initialFocus);
  const [kind, setKind] = useState<BillboardKindFilter>(initialKind);
  const [dayKey, setDayKey] = useState<string | null>(initialDayKey);
  const [bookingOpen, setBookingOpen] = useState(initialBookingOpen);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [selectedAssetCode, setSelectedAssetCode] = useState<string | null>(initialAssetCode);
  const [bookingSeedStartKey, setBookingSeedStartKey] = useState<string>(initialDayKey || "");
  const [bookingSeedEndKey, setBookingSeedEndKey] = useState<string>(initialDayKey || "");
  const [availabilityStartKey, setAvailabilityStartKey] = useState(todayKey);
  const [availabilityEndKey, setAvailabilityEndKey] = useState(todayKey);
  const [calendarHeight, setCalendarHeight] = useState<number | null>(null);
  const calendarRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const bookingRef = useRef<HTMLElement | null>(null);

  const monthDate = useMemo(() => parseDateKey(monthDateKey), [monthDateKey]);
  const today = useMemo(() => parseDateKey(todayKey), [todayKey]);
  const defaultBookingDate = isSameMonth(monthDate, today) ? today : monthDate;
  const defaultBookingDateKey = formatDateKey(defaultBookingDate);
  const selectedAsset = assets.find((asset) => asset.code === selectedAssetCode) || null;
  const editableBooking = useMemo(
    () => monthBookings.find((booking) => booking.id === editingBookingId) || null,
    [editingBookingId, monthBookings]
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

  const filteredAssets = useMemo(
    () => (kind === "ALL" ? assets : assets.filter((asset) => asset.kind === kind)),
    [assets, kind]
  );
  const isImplicitSingleAssetView = !selectedAssetCode && filteredAssets.length === 1;
  const calendarAsset =
    selectedAsset && filteredAssets.some((asset) => asset.id === selectedAsset.id)
      ? selectedAsset
      : isImplicitSingleAssetView
        ? filteredAssets[0]
        : null;
  const filteredAssetIds = useMemo(() => new Set(filteredAssets.map((asset) => asset.id)), [filteredAssets]);
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
  const occupiedAssetsToday = useMemo(
    () => filteredAssets.filter((asset) => asset.bookings.some((booking) => bookingIncludesDay(booking, todayKey))),
    [filteredAssets, todayKey]
  );
  const freeAssetsToday = useMemo(
    () =>
      filteredAssets.filter((asset) => {
        const occupancy = asset.bookings.filter((booking) => bookingIncludesDay(booking, todayKey)).length;
        return occupancy < getBillboardAssetCapacity(asset.kind);
      }),
    [filteredAssets, todayKey]
  );
  const hasValidAvailabilityRange = Boolean(
    availabilityStartKey && availabilityEndKey && availabilityEndKey >= availabilityStartKey
  );
  const availabilityResults = useMemo(
    () =>
      hasValidAvailabilityRange
        ? filteredAssets
            .map((asset) => getRangeAvailability(asset, availabilityStartKey, availabilityEndKey))
            .filter((result) => result.availableUnits > 0)
        : [],
    [availabilityEndKey, availabilityStartKey, filteredAssets, hasValidAvailabilityRange]
  );
  const unavailableAssetsCount = hasValidAvailabilityRange
    ? filteredAssets.length - availabilityResults.length
    : 0;
  const monthMatrix = useMemo(
    () => buildMonthMatrix(calendarMonthBookings, monthDate, calendarAssets, todayKey, calendarAsset),
    [calendarAsset, calendarAssets, calendarMonthBookings, monthDate, todayKey]
  );
  const focusContent = useMemo(
    () =>
      getFocusContent(focus, {
        assets: filteredAssets,
        freeAssetsToday,
        monthBookings: filteredMonthBookings,
        occupiedAssetsToday,
        selectedAsset: calendarAsset,
        selectedDayKey: dayKey,
        todayKey
      }),
    [calendarAsset, dayKey, filteredAssets, filteredMonthBookings, focus, freeAssetsToday, occupiedAssetsToday, todayKey]
  );
  const monitorBoardDate = dayKey ? parseDateKey(dayKey) : today;
  const monitorBoardAssets = useMemo(
    () => (kind === "MONITOR" ? buildMonitorBoardAssets(calendarAssets, formatDateKey(monitorBoardDate)) : []),
    [calendarAssets, kind, monitorBoardDate]
  );

  useEffect(() => {
    if (!selectedAssetCode) {
      return;
    }

    const matchingAsset = assets.find((asset) => asset.code === selectedAssetCode) || null;
    if (!matchingAsset || (kind !== "ALL" && matchingAsset.kind !== kind)) {
      setSelectedAssetCode(null);
    }
  }, [assets, kind, selectedAssetCode]);
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
  }, [focus, kind, monthDateKey]);

  const overviewStyle = calendarHeight
    ? ({ ["--billboards-panel-height" as string]: `${calendarHeight}px` } as CSSProperties)
    : undefined;

  useEffect(() => {
    const searchParams = new URLSearchParams({ date: monthDateKey });
    if (selectedAssetCode) {
      searchParams.set("asset", selectedAssetCode);
    }
    if (bookingOpen) {
      searchParams.set("booking", "new");
    }
    if (focus) {
      searchParams.set("focus", focus);
    }
    if (dayKey) {
      searchParams.set("day", dayKey);
    }
    if (kind !== "ALL") {
      searchParams.set("kind", kind);
    }
    const anchor = bookingOpen ? "#new-billboard-booking" : focus ? "#billboards-focus-panel" : "";
    window.history.replaceState({}, "", `/billboards?${searchParams.toString()}${anchor}`);
  }, [bookingOpen, dayKey, focus, kind, monthDateKey, selectedAssetCode]);

  function scrollToTarget(target: "panel" | "booking" | "calendar") {
    const element = target === "panel" ? panelRef.current : target === "booking" ? bookingRef.current : calendarRef.current;
    if (!element) {
      return;
    }

    requestAnimationFrame(() => {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function openFocus(nextFocus: BillboardsFocus, nextDayKey?: string | null) {
    setFocus(nextFocus);
    setDayKey(nextDayKey ?? null);
    scrollToTarget("panel");
  }

  function toggleSummary(nextFocus: Exclude<BillboardsFocus, "day">) {
    if (focus === nextFocus) {
      setFocus(null);
      setDayKey(null);
      return;
    }
    openFocus(nextFocus);
  }

  function openAssetCalendar(assetCode: string) {
    setSelectedAssetCode(assetCode);
    setEditingBookingId(null);
    setBookingOpen(false);
    setFocus(null);
    setDayKey(null);
    scrollToTarget("calendar");
  }

  function openAssetBooking(assetCode: string, targetDayKey?: string) {
    const targetDateKey = targetDayKey || defaultBookingDateKey;
    openAssetBookingForRange(assetCode, targetDateKey, targetDateKey);
  }

  function openAssetBookingForRange(assetCode: string, startKey: string, endKey: string) {
    setSelectedAssetCode(assetCode);
    setEditingBookingId(null);
    setBookingSeedStartKey(startKey);
    setBookingSeedEndKey(endKey);
    setDayKey(startKey || null);
    setFocus(null);
    setBookingOpen(true);
    scrollToTarget("booking");
  }

  function openBookingEditor(bookingId: string) {
    const booking = monthBookings.find((entry) => entry.id === bookingId);
    if (!booking) {
      return;
    }

    setEditingBookingId(booking.id);
    setSelectedAssetCode(booking.billboardAsset.code);
    setBookingSeedStartKey(booking.startsAt);
    setBookingSeedEndKey(booking.endsAt);
    setBookingOpen(true);
    setFocus(null);
    setDayKey(booking.startsAt);
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
  }

  function clearSelectedAsset() {
    setSelectedAssetCode(null);
    setDayKey(null);
    if (isImplicitSingleAssetView) {
      setKind("ALL");
    }
  }

  function monthHref(targetMonth: Date) {
    const searchParams = new URLSearchParams({ date: formatDateKey(startOfMonth(targetMonth)) });
    if (selectedAssetCode) {
      searchParams.set("asset", selectedAssetCode);
    }
    if (bookingOpen) {
      searchParams.set("booking", "new");
    }
    if (focus) {
      searchParams.set("focus", focus);
    }
    if (dayKey) {
      searchParams.set("day", dayKey);
    }
    if (kind !== "ALL") {
      searchParams.set("kind", kind);
    }

    return `/billboards?${searchParams.toString()}`;
  }

  return (
    <div className="stack billboards-page-shell billboards-page-shell-v3">
      <PageHeader
        title="Cartelloni"
        action={
          <div className="billboards-header-actions">
            {bookingOpen ? (
              <button className="button ghost" onClick={closeBooking} type="button">
                Chiudi
              </button>
            ) : null}
            <button
              className="button primary"
              onClick={() => {
                setEditingBookingId(null);
                setSelectedAssetCode(null);
                setBookingSeedStartKey("");
                setBookingSeedEndKey("");
                setFocus(null);
                setBookingOpen(true);
                scrollToTarget("booking");
              }}
              type="button"
            >
              Nuova prenotazione
            </button>
          </div>
        }
      />

      <section className="card card-pad billboards-filter-card" aria-label="Filtri cartelloni">
        <div className="list-header billboards-filter-head">
          <div>
            <h3>Impianti</h3>
          </div>
          <span className="pill">{filteredAssets.length} visibili</span>
        </div>
        <nav className="billboards-kind-tabs" aria-label="Tipi di impianto">
          {[
            { value: "ALL" as const, label: "Tutti" },
            { value: "CARTELLONE" as const, label: "Cartelloni" },
            { value: "MONITOR" as const, label: "Monitor" },
            { value: "VELA_ITINERANTE" as const, label: "Vela pubblicitaria" }
          ].map((tab) => (
            <button
              className={`billboards-kind-tab${kind === tab.value ? " is-active" : ""}`}
              key={tab.value}
              onClick={() => setKind(tab.value)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </section>

      <section className="card card-pad billboards-availability-card" aria-label="Ricerca disponibilita">
        <div className="list-header billboards-availability-head">
          <div>
            <h3>Disponibilita</h3>
          </div>
          {hasValidAvailabilityRange ? (
            <div className="billboards-availability-totals">
              <span className="pill status">{availabilityResults.length} disponibili</span>
              {unavailableAssetsCount > 0 ? <span className="pill warning">{unavailableAssetsCount} pieni</span> : null}
            </div>
          ) : null}
        </div>

        <div className="billboards-availability-controls">
          <label className="field">
            <span>Data inizio</span>
            <input
              min={todayKey}
              onChange={(event) => {
                const nextStartKey = event.target.value;
                setAvailabilityStartKey(nextStartKey);
                if (availabilityEndKey && availabilityEndKey < nextStartKey) {
                  setAvailabilityEndKey(nextStartKey);
                }
              }}
              type="date"
              value={availabilityStartKey}
            />
          </label>
          <label className="field">
            <span>Data fine</span>
            <input
              min={availabilityStartKey || todayKey}
              onChange={(event) => setAvailabilityEndKey(event.target.value)}
              type="date"
              value={availabilityEndKey}
            />
          </label>
          <div className="billboards-availability-period-copy">
            <span className="compact-kicker">Periodo selezionato</span>
            <strong>
              {hasValidAvailabilityRange
                ? `${formatDate(parseDateKey(availabilityStartKey))} - ${formatDate(parseDateKey(availabilityEndKey))}`
                : "Completa entrambe le date"}
            </strong>
          </div>
        </div>

        {hasValidAvailabilityRange ? (
          availabilityResults.length > 0 ? (
            <div className="billboards-availability-grid">
              {availabilityResults.map(({ asset, availableUnits, capacity }) => (
                <article className="billboards-availability-result" key={asset.id}>
                  <div className="billboards-availability-result-head">
                    <div>
                      <span className="billboard-asset-meta-label">{asset.code}</span>
                      <strong>{asset.name}</strong>
                    </div>
                    <span className="pill status">
                      {capacity > 1 ? `${availableUnits} slot liberi` : "Libero"}
                    </span>
                  </div>
                  <div className="subtle">{simplifyBillboardLocation(asset.location)}</div>
                  <div className="billboards-availability-result-actions">
                    <span>{billboardAssetKindLabels[asset.kind]}</span>
                    <button
                      className="button primary"
                      onClick={() => openAssetBookingForRange(asset.code, availabilityStartKey, availabilityEndKey)}
                      type="button"
                    >
                      Prenota
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty billboards-availability-empty">
              Nessun impianto libero nel periodo selezionato.
            </div>
          )
        ) : null}
      </section>

      {calendarAsset ? (
        <section className="mini-item billboards-selected-asset-banner">
          <div>
            <span className="compact-kicker">Impianto selezionato</span>
            <strong>{calendarAsset.name}</strong>
          </div>
          <div className="billboards-selected-asset-banner-actions">
            <span className="pill status">{billboardAssetKindLabels[calendarAsset.kind]}</span>
            <button className="button ghost" onClick={clearSelectedAsset} type="button">
              Torna a tutti
            </button>
          </div>
        </section>
      ) : null}

      <section className="grid billboards-summary-grid-v3">
        <SummaryActionCard
          isActive={focus === "assets"}
          label="Impianti"
          onClick={() => toggleSummary("assets")}
          tone="neutral"
          value={filteredAssets.length}
        />
        <SummaryActionCard
          isActive={focus === "occupied"}
          label="Occupati oggi"
          onClick={() => toggleSummary("occupied")}
          tone="warning"
          value={occupiedAssetsToday.length}
        />
        <SummaryActionCard
          isActive={focus === "free"}
          label="Liberi oggi"
          onClick={() => toggleSummary("free")}
          tone="success"
          value={freeAssetsToday.length}
        />
        <SummaryActionCard
          isActive={focus === "bookings"}
          label="Prenotazioni mese"
          onClick={() => toggleSummary("bookings")}
          tone="brand"
          value={filteredMonthBookings.length}
        />
      </section>

      {bookingOpen ? (
        <section className="card card-pad billboards-booking-card-v2" id="new-billboard-booking" ref={bookingRef}>
          <div className="list-header">
            <div>
              <h3>{editableBooking ? "Modifica plancia" : "Nuova prenotazione"}</h3>
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
            defaultEndDate={editableBooking ? editableBooking.endsAt : bookingSeedEndKey}
            defaultStartDate={editableBooking ? editableBooking.startsAt : bookingSeedStartKey}
            existingBookings={existingBookings}
            key={`${editingBookingId || "create"}-${bookingFormAsset?.id || "none"}-${bookingSeedStartKey}-${bookingSeedEndKey}-${monthDateKey}`}
            mode={editableBooking ? "update" : "create"}
          />
        </section>
      ) : null}

      {kind === "MONITOR" && monitorBoardAssets.length > 0 ? (
        <section className="card card-pad billboards-monitor-board" id="billboards-monitor-board">
          <div className="list-header">
            <div>
              <h3>Plancia giorno</h3>
              <div className="subtle">Slot del {formatDate(monitorBoardDate)}</div>
            </div>
            <span className="pill status">{monitorBoardAssets.length} monitor</span>
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
                  {asset.slots.map((slot) =>
                    slot.booking ? (
                      <button
                        className="billboard-monitor-slot is-occupied"
                        key={`${asset.id}-board-${slot.index}`}
                        onClick={() => openAssetCalendar(asset.code)}
                        type="button"
                      >
                        <span className="billboard-monitor-slot-index">Slot {slot.index}</span>
                        <strong>{slot.booking.customer.name}</strong>
                      </button>
                    ) : (
                      <button
                        className="billboard-monitor-slot is-free"
                        key={`${asset.id}-board-${slot.index}`}
                        onClick={() => openAssetCalendar(asset.code)}
                        type="button"
                      >
                        <span className="billboard-monitor-slot-index">Slot {slot.index}</span>
                        <strong>Libero</strong>
                      </button>
                    )
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className={`billboards-overview-grid${focus ? " has-focus" : ""}`} style={overviewStyle}>
        <section
          className={`card card-pad calendar-shell billboards-calendar-card-v3${focus ? " is-compressed" : ""}`}
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
              <Link className="button secondary" href={monthHref(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}>
                Precedente
              </Link>
              <Link className="button ghost" href={monthHref(new Date())}>
                Oggi
              </Link>
              <Link className="button secondary" href={monthHref(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}>
                Successivo
              </Link>
            </div>
          </div>

          <div className="calendar-month-wrap">
            <div className="calendar-month-weekdays">
              {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="calendar-month-grid">
              {monthMatrix.flat().map((day) => {
                const isFocusMonth = day.date.getMonth() === monthDate.getMonth();
                const canBookSelectedAssetDay = Boolean(calendarAsset && day.freeCount > 0);
                return (
                  <div
                    className={`calendar-month-cell billboard-day-cell-v2${isFocusMonth ? "" : " muted"}${day.isToday ? " today" : ""}${day.entries.length === 0 ? " is-empty" : ""}${day.isFullyOccupied ? " is-fully-occupied" : ""}`}
                    key={day.key}
                  >
                    <div className="calendar-month-head">
                      <button
                        className="billboard-day-head-link"
                        onClick={() => {
                          if (calendarAsset && day.entries.length === 0 && day.freeCount > 0) {
                            openAssetBooking(calendarAsset.code, day.key);
                            return;
                          }

                          openFocus("day", day.key);
                        }}
                        type="button"
                      >
                        <strong>{day.date.getDate()}</strong>
                        {day.entries.length > 0 ? <span>{day.entries.length}</span> : null}
                      </button>
                    </div>
                    {day.entries.length === 0 ? (
                      <button
                        className={`billboard-day-empty-state${calendarAsset ? " is-bookable" : ""}`}
                        onClick={() => {
                          if (calendarAsset) {
                            openAssetBooking(calendarAsset.code, day.key);
                            return;
                          }

                          openFocus("day", day.key);
                        }}
                        type="button"
                      >
                        <strong>{calendarAsset ? "Prenota" : "Tutti liberi"}</strong>
                        <span>
                          {calendarAsset
                            ? calendarAsset.kind === "MONITOR"
                              ? `${day.freeCount} slot disponibili`
                              : "Impianto disponibile"
                            : `${day.freeCount} impianti`}
                        </span>
                      </button>
                    ) : (
                      <>
                        <div className="billboard-day-stats">
                          <button
                            className="billboard-day-stat billboard-day-stat-occupied"
                            onClick={() => openFocus("day", day.key)}
                            type="button"
                          >
                            <em>Occupati</em>
                            <strong>{day.occupiedCount}</strong>
                          </button>
                          <button
                            className="billboard-day-stat billboard-day-stat-free"
                            onClick={() => {
                              if (canBookSelectedAssetDay && calendarAsset) {
                                openAssetBooking(calendarAsset.code, day.key);
                                return;
                              }

                              openFocus("day", day.key);
                            }}
                            type="button"
                          >
                            <em>{canBookSelectedAssetDay ? "Prenota" : "Liberi"}</em>
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
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {focusContent ? (
          <aside className="card card-pad billboards-focus-panel-v2" id="billboards-focus-panel" ref={panelRef}>
            <div className="list-header">
              <div>
                <span className="compact-kicker">{focusContent.kind === "day" ? "Dettaglio giorno" : "Vista attiva"}</span>
                <h3>{focusContent.title}</h3>
              </div>
              <div className="billboards-focus-actions">
                <span className="pill">
                  {focusContent.kind === "day" ? `${focusContent.count} prenotazioni` : focusContent.count}
                </span>
                <button className="button ghost" onClick={closeFocus} type="button">
                  Chiudi
                </button>
              </div>
            </div>

            <div className="billboards-focus-panel-body">
              {focusContent.kind === "day" ? (
                <div className="billboards-day-detail">
                  <div className="billboards-day-metrics">
                    <div>
                      <span>Prenotazioni</span>
                      <strong>{focusContent.bookings.length}</strong>
                    </div>
                    <div>
                      <span>Impianti occupati</span>
                      <strong>{focusContent.occupiedAssetCount}</strong>
                    </div>
                    <div>
                      <span>Disponibili</span>
                      <strong>{focusContent.availableAssets.length}</strong>
                    </div>
                    <div>
                      <span>Residuo aperto</span>
                      <strong>{formatCurrency(focusContent.openBalanceCents)}</strong>
                    </div>
                  </div>

                  <section className="billboards-day-section">
                    <div className="billboards-day-section-head">
                      <div>
                        <h4>Clienti e lavorazioni</h4>
                      </div>
                      <span className="pill warning">{focusContent.bookings.length}</span>
                    </div>
                    <div className="compact-order-list billboard-focus-bookings-list">
                      {focusContent.bookings.length === 0 ? (
                        <div className="empty">Nessuna prenotazione.</div>
                      ) : (
                        focusContent.bookings.map((booking) => (
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

                  <details className="billboards-day-available" open={focusContent.bookings.length === 0}>
                    <summary>
                      <span>Impianti disponibili</span>
                      <strong>{focusContent.availableAssets.length}</strong>
                    </summary>
                    <div className="billboards-day-available-list">
                      {focusContent.availableAssets.length === 0 ? (
                        <div className="empty">Nessun impianto disponibile in questa data.</div>
                      ) : (
                        focusContent.availableAssets.map(({ asset, availableUnits, capacity }) => (
                          <article className="billboards-day-available-item" key={asset.id}>
                            <div>
                              <span className="billboard-asset-meta-label">{asset.code}</span>
                              <strong>{asset.name}</strong>
                              <span className="subtle">{simplifyBillboardLocation(asset.location)}</span>
                            </div>
                            <div className="billboards-day-available-actions">
                              <span className="pill status">
                                {capacity > 1 ? `${availableUnits} slot` : "Libero"}
                              </span>
                              <button
                                className="button primary"
                                onClick={() => openAssetBooking(asset.code, focusContent.dayKey)}
                                type="button"
                              >
                                Prenota
                              </button>
                            </div>
                          </article>
                        ))
                      )}
                    </div>
                  </details>
                </div>
              ) : focusContent.kind === "assets" ? (
                <div className="billboard-focus-assets-list">
                  {focusContent.assets.length === 0 ? (
                    <div className="empty">Nessun impianto in questo gruppo.</div>
                  ) : (
                    focusContent.assets.map((asset) => (
                      <button
                        className={`billboard-asset-card-v2${asset.isOccupied ? " is-occupied" : ""}${selectedAssetCode === asset.code ? " is-selected" : ""}`}
                        key={asset.id}
                        onClick={() => openAssetCalendar(asset.code)}
                        type="button"
                      >
                        <div className="list-header">
                          <div>
                            <strong>{asset.name}</strong>
                            <div className="subtle">{billboardAssetKindLabels[asset.kind]}</div>
                          </div>
                          {asset.kind === "MONITOR" ? (
                            <span className={`pill ${asset.monitorOccupancy > 0 ? "warning" : "status"}`}>
                              {asset.monitorOccupancy}/6 occupati
                            </span>
                          ) : (
                            <span className={`pill ${asset.isOccupied ? "warning" : "status"}`}>
                              {asset.isOccupied ? "Occupato" : "Libero"}
                            </span>
                          )}
                        </div>
                        <div className="billboard-asset-body-v2">
                          <span className="billboard-asset-meta-label">{asset.code}</span>
                          <span className="billboard-asset-meta-value">{asset.customerLabel}</span>
                          <span>{asset.dateLabel}</span>
                          <span>{asset.locationLabel}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              ) : (
                <div className="compact-order-list billboard-focus-bookings-list">
                  {focusContent.bookings.length === 0 ? (
                    <div className="empty">Nessuna prenotazione in questo gruppo.</div>
                  ) : (
                    focusContent.bookings.map((booking) => (
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
    </div>
  );
}

function SummaryActionCard({
  label,
  value,
  tone,
  isActive,
  onClick
}: {
  label: string;
  value: number | string;
  tone: "neutral" | "warning" | "success" | "brand";
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`billboards-summary-card-v3 tone-${tone}${isActive ? " is-active" : ""}`} onClick={onClick} type="button">
      <span className="billboards-summary-label-v2">{label}</span>
      <strong>{value}</strong>
    </button>
  );
}

function BookingFocusCard({
  booking,
  todayKey,
  onEdit
}: {
  booking: PlainMonthBooking;
  todayKey: string;
  onEdit: () => void;
}) {
  const isActive = bookingIncludesDay(booking, todayKey);
  const isCompleted = booking.endsAt < todayKey;

  return (
    <article className="compact-order-item billboard-focus-booking-card">
      <div className="compact-order-main">
        <div className="billboard-focus-booking-head">
          <span className="billboard-asset-meta-label">{booking.billboardAsset.code}</span>
          <strong className="billboard-focus-booking-title">{booking.billboardAsset.name}</strong>
          <span className="billboard-focus-booking-customer">{booking.customer.name}</span>
        </div>
        <div className="subtle billboard-focus-booking-dates">
          {formatDate(parseDateKey(booking.startsAt))} - {formatDate(parseDateKey(booking.endsAt))}
        </div>
        {booking.note ? <div className="billboard-focus-booking-note">{booking.note}</div> : null}
        <div className="billboard-booking-financials">
          {booking.billboardAsset.kind === "MONITOR" && booking.monitorSlot ? <span>Slot {booking.monitorSlot}</span> : null}
          <span>Valore {formatCurrency(booking.priceCents)}</span>
          <span>Incassato {formatCurrency(booking.paidCents)}</span>
          <span className={booking.balanceDueCents > 0 ? "is-open" : ""}>
            Residuo {formatCurrency(booking.balanceDueCents)}
          </span>
        </div>
      </div>
      <div className="billboard-upcoming-side-v2">
        <span className={`pill ${isActive ? "warning" : "status"}`}>
          {isActive ? "In corso" : isCompleted ? "Terminata" : "Prenotata"}
        </span>
        <button className="button ghost billboard-focus-booking-edit" onClick={onEdit} type="button">
          Modifica
        </button>
      </div>
    </article>
  );
}

function getFocusContent(
  focus: BillboardsFocus | null,
  input: {
    assets: PlainAsset[];
    occupiedAssetsToday: PlainAsset[];
    freeAssetsToday: PlainAsset[];
    monthBookings: PlainMonthBooking[];
    selectedAsset: PlainAsset | null;
    todayKey: string;
    selectedDayKey: string | null;
  }
):
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
  | {
      kind: "day";
      title: string;
      count: number;
      dayKey: string;
      bookings: PlainMonthBooking[];
      availableAssets: RangeAvailability[];
      occupiedAssetCount: number;
      openBalanceCents: number;
    }
  | null {
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
    const scopedAssets = input.selectedAsset ? input.assets.filter((asset) => asset.id === input.selectedAsset?.id) : input.assets;
    const scopedAssetIds = new Set(scopedAssets.map((asset) => asset.id));
    const dayBookings = input.monthBookings.filter((booking) => {
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

    return {
      kind: "day",
      title: formatDate(dayDate),
      count: dayBookings.length,
      dayKey,
      bookings: dayBookings,
      availableAssets,
      occupiedAssetCount: new Set(dayBookings.map((booking) => booking.billboardAssetId)).size,
      openBalanceCents: dayBookings.reduce((total, booking) => total + booking.balanceDueCents, 0)
    };
  }

  const assets =
    focus === "occupied" ? input.occupiedAssetsToday : focus === "free" ? input.freeAssetsToday : input.assets;

  return {
    kind: "assets",
    title:
      focus === "occupied"
        ? "Impianti occupati oggi"
        : focus === "free"
          ? "Impianti liberi oggi"
          : "Tutti gli impianti",
    count: assets.length,
    assets: assets.map((asset) => buildFocusAsset(asset, input.todayKey))
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

function buildFocusAsset(asset: PlainAsset, dayKey: string): FocusAsset {
  const activeBookings = asset.bookings.filter((booking) => bookingIncludesDay(booking, dayKey));
  const activeBooking = activeBookings[0];
  const nextBooking = asset.bookings
    .filter((booking) => booking.startsAt >= dayKey)
    .sort((left, right) => toDayStamp(left.startsAt) - toDayStamp(right.startsAt))[0];
  const monitorOccupancy = asset.kind === "MONITOR" ? activeBookings.length : activeBooking ? 1 : 0;

  return {
    ...asset,
    isOccupied: Boolean(activeBooking),
    monitorOccupancy,
    customerLabel:
      asset.kind === "MONITOR"
        ? activeBookings.length > 0
          ? activeBookings
              .slice(0, 3)
              .map((booking) => booking.customer.name)
              .join(" • ")
          : "Libero"
        : activeBooking
          ? activeBooking.customer.name
          : "Libero",
    dateLabel:
      asset.kind === "MONITOR"
        ? activeBookings.length > 0
          ? `Slot liberi ${Math.max(0, 6 - activeBookings.length)}`
          : "6 slot disponibili"
        : activeBooking
          ? `${formatDate(parseDateKey(activeBooking.startsAt))} - ${formatDate(parseDateKey(activeBooking.endsAt))}`
          : nextBooking
            ? `Prossima ${formatDate(parseDateKey(nextBooking.startsAt))} - ${formatDate(parseDateKey(nextBooking.endsAt))}`
            : "Nessuna prenotazione",
    locationLabel: simplifyBillboardLocation(asset.location)
  };
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
  selectedAsset: PlainAsset | null
) {
  const first = startOfMonth(focusDate);
  const last = endOfMonth(focusDate);
  const gridStart = startOfWeek(first);
  const gridEnd = addDays(startOfWeek(last), 6);
  const days: Array<{
    key: string;
    date: Date;
    entries: PlainMonthBooking[];
    occupiedCount: number;
    freeCount: number;
    isFullyOccupied: boolean;
    topAssets: string[];
    hiddenAssetsCount: number;
    isToday: boolean;
  }> = [];

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
      isToday: dayKey === todayKey
    });
  }

  const weeks = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }

  return weeks;
}

function defaultDateKeyFromMonth(todayKey: string, monthDateKey: string) {
  const monthDate = parseDateKey(monthDateKey);
  const todayDate = parseDateKey(todayKey);
  return formatDateKey(isSameMonth(monthDate, todayDate) ? todayDate : monthDate);
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

function parseDateKey(value: string) {
  return new Date(`${value}T12:00:00`);
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
