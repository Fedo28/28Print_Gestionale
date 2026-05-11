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
type BillboardDayView = "bookings" | "occupied" | "free";

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
  priceCents: number;
  paidCents: number;
  balanceDueCents: number;
  monitorSlot: number | null;
  customer: {
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

type BillboardsWorkspaceProps = {
  assets: PlainAsset[];
  customers: CustomerOption[];
  initialAssetCode: string | null;
  initialBookingOpen: boolean;
  initialDayKey: string | null;
  initialDayView: BillboardDayView;
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
  initialDayView,
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
  const [dayView, setDayView] = useState<BillboardDayView>(initialDayView);
  const [bookingOpen, setBookingOpen] = useState(initialBookingOpen);
  const [selectedAssetCode, setSelectedAssetCode] = useState<string | null>(initialAssetCode);
  const [calendarHeight, setCalendarHeight] = useState<number | null>(null);
  const calendarRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const bookingRef = useRef<HTMLElement | null>(null);

  const monthDate = useMemo(() => parseDateKey(monthDateKey), [monthDateKey]);
  const today = useMemo(() => parseDateKey(todayKey), [todayKey]);
  const defaultBookingDate = isSameMonth(monthDate, today) ? today : monthDate;
  const defaultBookingDateKey = formatDateKey(defaultBookingDate);
  const selectedAsset = assets.find((asset) => asset.code === selectedAssetCode) || null;
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
  const monthMatrix = useMemo(
    () => buildMonthMatrix(filteredMonthBookings, monthDate, filteredAssets, todayKey),
    [filteredAssets, filteredMonthBookings, monthDate, todayKey]
  );
  const focusContent = useMemo(
    () =>
      getFocusContent(focus, {
    assets: filteredAssets,
        freeAssetsToday,
        monthBookings: filteredMonthBookings,
        occupiedAssetsToday,
        selectedDayKey: dayKey,
        todayKey,
        dayView
      }),
    [dayKey, dayView, filteredAssets, filteredMonthBookings, focus, freeAssetsToday, monthDate, occupiedAssetsToday, todayKey]
  );
  const monitorBoardDate = dayKey ? parseDateKey(dayKey) : today;
  const monitorBoardAssets = useMemo(
    () => (kind === "MONITOR" ? buildMonitorBoardAssets(filteredAssets, formatDateKey(monitorBoardDate)) : []),
    [filteredAssets, kind, monitorBoardDate]
  );
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
    if (dayView !== "bookings") {
      searchParams.set("dayView", dayView);
    }
    if (kind !== "ALL") {
      searchParams.set("kind", kind);
    }
    const anchor = bookingOpen ? "#new-billboard-booking" : focus ? "#billboards-focus-panel" : "";
    window.history.replaceState({}, "", `/billboards?${searchParams.toString()}${anchor}`);
  }, [bookingOpen, dayKey, dayView, focus, kind, monthDateKey, selectedAssetCode]);

  function scrollToTarget(target: "panel" | "booking") {
    const element = target === "panel" ? panelRef.current : bookingRef.current;
    if (!element) {
      return;
    }

    requestAnimationFrame(() => {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function openFocus(nextFocus: BillboardsFocus, nextDayKey?: string | null, nextDayView?: BillboardDayView) {
    setFocus(nextFocus);
    setDayKey(nextDayKey ?? null);
    setDayView(nextDayView ?? "bookings");
    scrollToTarget("panel");
  }

  function toggleSummary(nextFocus: Exclude<BillboardsFocus, "day">) {
    if (focus === nextFocus) {
      setFocus(null);
      setDayKey(null);
      setDayView("bookings");
      return;
    }
    openFocus(nextFocus);
  }

  function openAssetBooking(assetCode: string) {
    setSelectedAssetCode(assetCode);
    setBookingOpen(true);
    scrollToTarget("booking");
  }

  function closeBooking() {
    setBookingOpen(false);
  }

  function closeFocus() {
    setFocus(null);
    setDayKey(null);
    setDayView("bookings");
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
    if (dayView !== "bookings") {
      searchParams.set("dayView", dayView);
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
                setSelectedAssetCode(null);
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

      <section className="billboards-kind-tabs" aria-label="Tipi di impianto">
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
      </section>

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
              <h3>Nuova prenotazione</h3>
            </div>
            {selectedAsset ? <span className="pill status">{selectedAsset.code}</span> : null}
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
              selectedAsset
                ? {
                    id: selectedAsset.id,
                    code: selectedAsset.code,
                    name: selectedAsset.name,
                    kind: selectedAsset.kind,
                    location: selectedAsset.location
                  }
                : null
            }
            defaultEndDate={defaultBookingDateKey}
            defaultStartDate={defaultBookingDateKey}
            existingBookings={existingBookings}
            key={`${selectedAsset?.id || "none"}-${monthDateKey}`}
          />
        </section>
      ) : null}

      {kind === "MONITOR" && monitorBoardAssets.length > 0 ? (
        <section className="card card-pad billboards-monitor-board" id="billboards-monitor-board">
          <div className="list-header">
            <div>
              <h3>Plancia monitor</h3>
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
                      <div className="billboard-monitor-slot is-occupied" key={`${asset.id}-board-${slot.index}`}>
                        <span className="billboard-monitor-slot-index">Slot {slot.index}</span>
                        <strong>{slot.booking.customer.name}</strong>
                      </div>
                    ) : (
                      <button
                        className="billboard-monitor-slot is-free"
                        key={`${asset.id}-board-${slot.index}`}
                        onClick={() => openAssetBooking(asset.code)}
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
              <span className="compact-kicker">Disponibilita</span>
              <h3>{monthLabel}</h3>
            </div>
            <div className="calendar-nav-actions">
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
                return (
                  <div
                    className={`calendar-month-cell billboard-day-cell-v2${isFocusMonth ? "" : " muted"}${day.isToday ? " today" : ""}`}
                    key={day.key}
                  >
                    <div className="calendar-month-head">
                      <button
                        className="billboard-day-head-link"
                        onClick={() => openFocus("day", day.key, "bookings")}
                        type="button"
                      >
                        <strong>{day.date.getDate()}</strong>
                        <span>{day.entries.length}</span>
                      </button>
                    </div>
                    <div className="billboard-day-stats">
                      <button
                        className="billboard-day-stat billboard-day-stat-occupied"
                        onClick={() => openFocus("day", day.key, "occupied")}
                        type="button"
                      >
                        <em>Occ.</em>
                        <strong>{day.occupiedCount}</strong>
                      </button>
                      <button
                        className="billboard-day-stat billboard-day-stat-free"
                        onClick={() => openFocus("day", day.key, "free")}
                        type="button"
                      >
                        <em>Lib.</em>
                        <strong>{day.freeCount}</strong>
                      </button>
                    </div>
                    {day.topAssets.length > 0 ? (
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

        {focusContent ? (
          <aside className="card card-pad billboards-focus-panel-v2" id="billboards-focus-panel" ref={panelRef}>
            <div className="list-header">
              <div>
                <h3>{focusContent.title}</h3>
              </div>
              <div className="billboards-focus-actions">
                <span className="pill">{focusContent.count}</span>
                <button className="button ghost" onClick={closeFocus} type="button">
                  Chiudi
                </button>
              </div>
            </div>

            <div className="billboards-focus-panel-body">
              {focusContent.kind === "assets" ? (
                <div className="billboard-focus-assets-list">
                  {focusContent.assets.length === 0 ? (
                    <div className="empty">Nessun impianto in questo gruppo.</div>
                  ) : (
                    focusContent.assets.map((asset) => (
                      <button
                        className={`billboard-asset-card-v2${asset.isOccupied ? " is-occupied" : ""}`}
                        key={asset.id}
                        onClick={() => openAssetBooking(asset.code)}
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
                      <article className="compact-order-item billboard-focus-booking-card" key={booking.id}>
                        <div className="compact-order-main">
                          <div className="billboard-focus-booking-head">
                            <strong className="billboard-focus-booking-title">{booking.billboardAsset.name}</strong>
                            <span className="billboard-focus-booking-customer">{booking.customer.name}</span>
                          </div>
                          <div className="subtle billboard-focus-booking-dates">
                            {formatDate(parseDateKey(booking.startsAt))} - {formatDate(parseDateKey(booking.endsAt))}
                          </div>
                          <div className="billboard-booking-financials">
                            {booking.billboardAsset.kind === "MONITOR" && booking.monitorSlot ? (
                              <span>Slot {booking.monitorSlot}</span>
                            ) : null}
                            <span>Valore {formatCurrency(booking.priceCents)}</span>
                            <span>Incassato {formatCurrency(booking.paidCents)}</span>
                            <span>Residuo {formatCurrency(booking.balanceDueCents)}</span>
                          </div>
                        </div>
                        <div className="billboard-upcoming-side-v2">
                          <span className={`pill ${bookingIncludesDay(booking, todayKey) ? "warning" : "status"}`}>
                            {bookingIncludesDay(booking, todayKey) ? "In corso" : "Prenotata"}
                          </span>
                        </div>
                      </article>
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

function getFocusContent(
  focus: BillboardsFocus | null,
  input: {
    assets: PlainAsset[];
    occupiedAssetsToday: PlainAsset[];
    freeAssetsToday: PlainAsset[];
    monthBookings: PlainMonthBooking[];
    todayKey: string;
    selectedDayKey: string | null;
    dayView: BillboardDayView;
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
    const dayBookings = input.monthBookings.filter((booking) => bookingIncludesDay(booking, dayKey));
    const dayFreeAssets = input.assets.filter((asset) => {
      const occupancy = asset.bookings.filter((booking) => bookingIncludesDay(booking, dayKey)).length;
      return occupancy < getBillboardAssetCapacity(asset.kind);
    });
    const dayOccupiedAssets = input.assets.filter((asset) =>
      asset.bookings.some((booking) => bookingIncludesDay(booking, dayKey))
    );

    if (input.dayView === "free" || input.dayView === "occupied") {
      const assets = input.dayView === "free" ? dayFreeAssets : dayOccupiedAssets;
      return {
        kind: "assets",
        title: `${input.dayView === "free" ? "Liberi" : "Occupati"} ${formatDate(dayDate)}`,
        count: assets.length,
        assets: assets.map((asset) => buildFocusAsset(asset, dayKey))
      };
    }

    return {
      kind: "bookings",
      title: `Prenotazioni ${formatDate(dayDate)}`,
      count: dayBookings.length,
      bookings: dayBookings
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

function buildMonthMatrix(bookings: PlainMonthBooking[], focusDate: Date, assets: PlainAsset[], todayKey: string) {
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
    const occupiedCount = assets.filter((asset) => (occupancyByAssetId.get(asset.id) || 0) > 0).length;
    const freeCount = assets.filter(
      (asset) => (occupancyByAssetId.get(asset.id) || 0) < getBillboardAssetCapacity(asset.kind)
    ).length;

    days.push({
      key: dayKey,
      date,
      entries,
      occupiedCount,
      freeCount,
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
