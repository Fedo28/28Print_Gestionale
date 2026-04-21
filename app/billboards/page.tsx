import { BillboardBookingStatus } from "@prisma/client";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { BillboardBookingForm } from "@/components/billboard-booking-form";
import {
  billboardAssetKindLabels,
  billboardBookingStatusLabels
} from "@/lib/constants";
import { requireAuth } from "@/lib/auth";
import { bookingIncludesDate, getBillboardSurface } from "@/lib/billboards";
import { formatCurrency, formatDate, formatDateKey } from "@/lib/format";
import { getCustomers } from "@/lib/orders";
import { computeAutomaticPriority, getPriorityToneClass } from "@/lib/priorities";

export const dynamic = "force-dynamic";

type BillboardPageProps = {
  searchParams?: {
    date?: string;
    asset?: string;
  };
};

type BillboardSurface = Awaited<ReturnType<typeof getBillboardSurface>>;

export default async function BillboardsPage({ searchParams }: BillboardPageProps) {
  await requireAuth();

  const focusDate = parseDateParam(searchParams?.date);
  const selectedAssetCode = (searchParams?.asset || "").trim();
  const [customers, surface] = await Promise.all([getCustomers(), getBillboardSurface(focusDate)]);
  const monthMatrix = buildMonthMatrix(surface.monthBookings, focusDate);
  const today = startOfDay(new Date());
  const selectedAsset = surface.assets.find((asset) => asset.code === selectedAssetCode) || null;
  const selectedAssetMonthBookings = selectedAsset
    ? surface.monthBookings.filter((booking) => booking.billboardAsset.code === selectedAsset.code)
    : [];
  const selectedAssetUpcomingBookings = selectedAsset
    ? surface.upcomingBookings.filter((booking) => booking.billboardAsset.code === selectedAsset.code)
    : [];
  const selectedAssetHistoryBookings = selectedAsset
    ? surface.historyBookings.filter((booking) => booking.billboardAsset.code === selectedAsset.code)
    : [];
  const selectedAssetMonthMatrix = selectedAsset ? buildMonthMatrix(selectedAssetMonthBookings, focusDate) : [];
  const selectedAssetActiveBooking = selectedAssetUpcomingBookings.find((booking) => bookingIncludesDate(booking, today));
  const selectedAssetNextBooking = selectedAssetUpcomingBookings.find(
    (booking) => new Date(booking.startsAt).getTime() >= today.getTime()
  );
  const occupiedToday = surface.assets.filter((asset) => asset.bookings.some((booking) => bookingIncludesDate(booking, today))).length;
  const optionCount = surface.upcomingBookings.filter((booking) => booking.status === "OPZIONATO").length;
  const confirmedThisMonth = surface.monthBookings.filter((booking) => booking.status === "CONFERMATO").length;
  const monthValueCents = surface.monthBookings.reduce((sum, booking) => sum + booking.priceCents, 0);
  const openBalanceCents = surface.upcomingBookings.reduce((sum, booking) => sum + booking.balanceDueCents, 0);
  const monthLabel = getMonthLabel(focusDate);

  return (
    <div className="stack billboards-page-shell">
      <PageHeader
        title="Cartelloni"
        description="Prenotazioni pubblicitarie su cartelloni, monitor e vela itinerante con stato campagna, importi e storico clienti nello stesso spazio operativo."
      />

      <section className="grid billboard-summary-grid">
        <MetricCard hint="24 cartelloni, 1 monitor, 1 vela" label="Impianti attivi" tone="neutral" value={surface.assets.length} />
        <MetricCard hint="Occupati nel giorno corrente" label="Occupati oggi" tone="warning" value={occupiedToday} />
        <MetricCard hint="Prenotazioni ancora da confermare" label="Opzioni aperte" tone="brand" value={optionCount} />
        <MetricCard hint={monthLabel} label="Confermati nel mese" tone="success" value={confirmedThisMonth} />
        <MetricCard hint="Somma di tutte le campagne nel mese" label="Valore campagne" tone="brand" value={formatCurrency(monthValueCents)} />
        <MetricCard hint="Residui ancora da incassare sulle campagne attive" label="Da incassare" tone="warning" value={formatCurrency(openBalanceCents)} />
      </section>

      <div className="grid grid-2 billboard-top-grid">
        <section className="card card-pad billboards-booking-card">
          <div className="list-header">
            <div>
              <h3>Nuova prenotazione</h3>
              <p className="card-muted">
                Seleziona cliente e impianto con ricerca rapida, imposta periodo, stato commerciale e importi della campagna.
              </p>
            </div>
          </div>
          <BillboardBookingForm
            assets={surface.assets.map((asset) => ({
              id: asset.id,
              code: asset.code,
              name: asset.name,
              kind: asset.kind,
              location: asset.location
            }))}
            customers={customers.map((customer) => ({
              id: customer.id,
              name: customer.name,
              phone: customer.phone,
              whatsapp: customer.whatsapp,
              email: customer.email,
              pec: customer.pec,
              taxCode: customer.taxCode,
              vatNumber: customer.vatNumber,
              uniqueCode: customer.uniqueCode,
              type: customer.type,
              orderCount: customer.orders.length
            }))}
            defaultEndDate={formatDateKey(focusDate)}
            defaultStartDate={formatDateKey(focusDate)}
          />
        </section>

        <section className="card card-pad billboard-assets-panel billboards-assets-card">
          <div className="list-header">
            <div>
              <h3>Impianti</h3>
              <p className="card-muted">Clicca un impianto per aprire calendario e prenotazioni relative solo a quel cartellone.</p>
            </div>
            <span className="pill">{surface.assets.length}</span>
          </div>
          <div className="billboard-asset-grid">
            {surface.assets.map((asset) => {
              const activeBooking = asset.bookings.find((booking) => bookingIncludesDate(booking, today));
              const nextBooking = asset.bookings.find((booking) => new Date(booking.startsAt).getTime() >= today.getTime());
              const queuedCount = Math.max(0, asset.bookings.length - (activeBooking ? 1 : nextBooking ? 1 : 0));
              const isSelected = selectedAsset?.id === asset.id;

              return (
                <Link
                  className={`billboard-asset-card${activeBooking ? " occupied" : ""}${isSelected ? " selected" : ""}`}
                  href={buildAssetHref(focusDate, asset.code)}
                  key={asset.id}
                >
                  <div className="list-header">
                    <div>
                      <strong>{asset.name}</strong>
                      <div className="subtle">
                        {billboardAssetKindLabels[asset.kind]}
                        {asset.location ? ` • ${asset.location}` : " • Luogo da definire"}
                      </div>
                    </div>
                    <span className={`pill ${activeBooking ? getBillboardStatusPillClass(activeBooking.status) : "status"}`}>
                      {activeBooking ? billboardBookingStatusLabels[activeBooking.status] : "Libero"}
                    </span>
                  </div>

                  {activeBooking ? (
                    <div className="compact-stack">
                      <div className="subtle">{activeBooking.customer.name}</div>
                      <div className="hint">
                        Dal {formatDate(activeBooking.startsAt)} al {formatDate(activeBooking.endsAt)}
                      </div>
                      <div className="billboard-booking-financials">
                        <span>Valore {formatCurrency(activeBooking.priceCents)}</span>
                        <span>Residuo {formatCurrency(activeBooking.balanceDueCents)}</span>
                      </div>
                    </div>
                  ) : nextBooking ? (
                    <div className="compact-stack">
                      <div className="subtle">
                        Prossimo: {nextBooking.customer.name} • {billboardBookingStatusLabels[nextBooking.status]}
                      </div>
                      <div className="hint">
                        Dal {formatDate(nextBooking.startsAt)} al {formatDate(nextBooking.endsAt)}
                      </div>
                      <div className="billboard-booking-financials">
                        <span>Valore {formatCurrency(nextBooking.priceCents)}</span>
                        <span>Residuo {formatCurrency(nextBooking.balanceDueCents)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="hint">Nessuna prenotazione imminente.</div>
                  )}

                  <div className="billboard-asset-footer">
                    <span className="pill">{asset.code}</span>
                    <span className="hint">{queuedCount > 0 ? `+${queuedCount} altre campagne in coda` : "Apri calendario impianto"}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      {selectedAsset ? (
        <section className="card card-pad calendar-shell billboard-detail-shell billboards-selected-card" id="selected-billboard">
          <div className="calendar-nav">
            <div>
              <span className="compact-kicker">Impianto selezionato</span>
              <h3>{selectedAsset.name}</h3>
              <p className="card-muted">
                {billboardAssetKindLabels[selectedAsset.kind]}
                {selectedAsset.location ? ` • ${selectedAsset.location}` : " • Luogo da definire"}
              </p>
            </div>
            <div className="calendar-nav-actions">
              <Link className="button secondary" href={buildAssetHref(new Date(focusDate.getFullYear(), focusDate.getMonth() - 1, 1), selectedAsset.code)}>
                Precedente
              </Link>
              <Link className="button ghost" href={buildAssetHref(new Date(), selectedAsset.code)}>
                Oggi
              </Link>
              <Link className="button secondary" href={buildAssetHref(new Date(focusDate.getFullYear(), focusDate.getMonth() + 1, 1), selectedAsset.code)}>
                Successivo
              </Link>
              <Link className="button ghost" href={buildMonthHref(focusDate)}>
                Chiudi
              </Link>
            </div>
          </div>

          <section className="grid billboard-detail-summary-grid">
            <MetricCard
              hint={selectedAssetActiveBooking ? `Occupato da ${selectedAssetActiveBooking.customer.name}` : "Nessuna campagna attiva oggi"}
              label="Stato oggi"
              tone={selectedAssetActiveBooking ? "warning" : "neutral"}
              value={selectedAssetActiveBooking ? billboardBookingStatusLabels[selectedAssetActiveBooking.status] : "Libero"}
            />
            <MetricCard
              hint="Prenotazioni registrate su questo impianto"
              label="Campagne totali"
              tone="brand"
              value={selectedAssetHistoryBookings.length}
            />
            <MetricCard
              hint={monthLabel}
              label="Nel mese"
              tone="success"
              value={selectedAssetMonthBookings.length}
            />
            <MetricCard
              hint={selectedAssetNextBooking ? `Dal ${formatDate(selectedAssetNextBooking.startsAt)}` : "Nessuna campagna futura"}
              label="Prossima"
              tone="neutral"
              value={selectedAssetNextBooking ? selectedAssetNextBooking.customer.name : "Nessuna"}
            />
          </section>

          <div className="calendar-month-wrap">
            <div className="calendar-month-weekdays">
              {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="calendar-month-grid">
              {selectedAssetMonthMatrix.flat().map((day) => {
                const isFocusMonth = day.date.getMonth() === focusDate.getMonth();
                return (
                  <article
                    className={`calendar-month-cell${isFocusMonth ? "" : " muted"}${day.isToday ? " today" : ""}`}
                    key={`asset-${selectedAsset.id}-${day.key}`}
                  >
                    <div className="calendar-month-head">
                      <strong>{day.date.getDate()}</strong>
                      <span>{day.entries.length > 0 ? `${day.entries.length} pren.` : "Libero"}</span>
                    </div>
                    <div className="calendar-month-events">
                      {day.entries.slice(0, 3).map((booking) => (
                        <div
                          className={`billboard-booking-chip billboard-booking-chip-${booking.status.toLowerCase()} ${getBillboardBookingPriorityToneClass(booking.endsAt)}`}
                          key={booking.id}
                        >
                          <div className="billboard-booking-chip-head">
                            <strong>{booking.customer.name}</strong>
                            <span className={`pill ${getBillboardStatusPillClass(booking.status)}`}>
                              {billboardBookingStatusLabels[booking.status]}
                            </span>
                          </div>
                          <span>
                            Dal {formatDate(booking.startsAt)} al {formatDate(booking.endsAt)}
                          </span>
                          {booking.note ? <span className="billboard-booking-note">{booking.note}</span> : null}
                        </div>
                      ))}
                      {!day.inMonth && day.entries.length === 0 ? <span className="calendar-slot-empty"> </span> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="list-header">
            <div>
              <h3>Prenotazioni di questo impianto</h3>
              <p className="card-muted">Storico e campagne future riferite solo a {selectedAsset.code}.</p>
            </div>
            <span className="pill">{selectedAssetHistoryBookings.length}</span>
          </div>
          <div className="compact-order-list">
            {selectedAssetHistoryBookings.length === 0 ? (
              <div className="empty">Nessuna prenotazione registrata su questo cartellone.</div>
            ) : (
              selectedAssetHistoryBookings.map((booking) => (
                <article className="compact-order-item" key={booking.id}>
                  <div className="compact-order-main">
                    <div className="compact-order-head">
                      <strong>{booking.customer.name}</strong>
                      <span className="compact-order-aside">{billboardBookingStatusLabels[booking.status]}</span>
                    </div>
                    <div className="subtle">
                      Dal {formatDate(booking.startsAt)} al {formatDate(booking.endsAt)}
                    </div>
                    <div className="hint">
                      {booking.note ? booking.note : "Nessuna nota aggiuntiva"}
                    </div>
                    <div className="billboard-booking-financials">
                      <span>Valore {formatCurrency(booking.priceCents)}</span>
                      <span>Incassato {formatCurrency(booking.paidCents)}</span>
                      <span>Residuo {formatCurrency(booking.balanceDueCents)}</span>
                    </div>
                  </div>
                  <div className="billboard-booking-side">
                    <span className={`pill ${getBillboardStatusPillClass(booking.status)}`}>
                      {billboardBookingStatusLabels[booking.status]}
                    </span>
                    {booking.pdfFilePath ? (
                      <a className="pill" href={booking.pdfFilePath} rel="noreferrer" target="_blank">
                        PDF
                      </a>
                    ) : (
                      <span className="pill">Senza PDF</span>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      ) : null}

      <section className="card card-pad calendar-shell billboards-calendar-card">
        <div className="calendar-nav">
          <div>
            <span className="compact-kicker">Prenotazioni</span>
            <h3>{monthLabel}</h3>
            <p className="card-muted">Calendario mensile con copertura giornaliera, stato commerciale e cliente della campagna.</p>
          </div>
          <div className="calendar-nav-actions">
            <Link className="button secondary" href={buildMonthHref(new Date(focusDate.getFullYear(), focusDate.getMonth() - 1, 1), selectedAsset?.code)}>
              Precedente
            </Link>
            <Link className="button ghost" href={buildMonthHref(new Date(), selectedAsset?.code)}>
              Oggi
            </Link>
            <Link className="button secondary" href={buildMonthHref(new Date(focusDate.getFullYear(), focusDate.getMonth() + 1, 1), selectedAsset?.code)}>
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
              const isFocusMonth = day.date.getMonth() === focusDate.getMonth();
              return (
                <article
                  className={`calendar-month-cell${isFocusMonth ? "" : " muted"}${day.isToday ? " today" : ""}`}
                  key={day.key}
                >
                  <div className="calendar-month-head">
                    <strong>{day.date.getDate()}</strong>
                    <span>{day.entries.length}/{surface.assets.length}</span>
                  </div>
                  <div className="calendar-month-events">
                    {day.entries.slice(0, 3).map((booking) => (
                      <div
                        className={`billboard-booking-chip billboard-booking-chip-${booking.status.toLowerCase()} ${getBillboardBookingPriorityToneClass(booking.endsAt)}`}
                        key={booking.id}
                      >
                        <div className="billboard-booking-chip-head">
                          <strong>{booking.billboardAsset.name}</strong>
                          <span className={`pill ${getBillboardStatusPillClass(booking.status)}`}>
                            {billboardBookingStatusLabels[booking.status]}
                          </span>
                        </div>
                        <span>{booking.customer.name}</span>
                        {booking.note ? <span className="billboard-booking-note">{booking.note}</span> : null}
                      </div>
                    ))}
                    {day.entries.length > 3 ? <span className="calendar-more">+{day.entries.length - 3} altri</span> : null}
                    {!day.inMonth && day.entries.length === 0 ? <span className="calendar-slot-empty"> </span> : null}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="card card-pad billboards-upcoming-card">
        <div className="list-header">
          <div>
            <h3>Prenotazioni in programma</h3>
            <p className="card-muted">Le campagne attive o future con stato, valori economici e allegato PDF a portata di click.</p>
          </div>
        </div>
        <div className="compact-order-list">
          {surface.upcomingBookings.length === 0 ? (
            <div className="empty">Nessuna prenotazione registrata.</div>
          ) : (
            surface.upcomingBookings.map((booking) => (
              <article className="compact-order-item" key={booking.id}>
                <div className="compact-order-main">
                  <div className="compact-order-head">
                    <strong>{booking.billboardAsset.name}</strong>
                    <span className="compact-order-aside">{booking.customer.name}</span>
                  </div>
                  <div className="subtle">
                    Dal {formatDate(booking.startsAt)} al {formatDate(booking.endsAt)}
                  </div>
                  <div className="hint">
                    {billboardAssetKindLabels[booking.billboardAsset.kind]}
                    {booking.billboardAsset.location ? ` • ${booking.billboardAsset.location}` : " • Luogo da definire"}
                    {booking.note ? ` • ${booking.note}` : ""}
                  </div>
                  <div className="billboard-booking-financials">
                    <span>Valore {formatCurrency(booking.priceCents)}</span>
                    <span>Incassato {formatCurrency(booking.paidCents)}</span>
                    <span>Residuo {formatCurrency(booking.balanceDueCents)}</span>
                  </div>
                </div>
                <div className="billboard-booking-side">
                  <span className={`pill ${getBillboardStatusPillClass(booking.status)}`}>
                    {billboardBookingStatusLabels[booking.status]}
                  </span>
                  {booking.pdfFilePath ? (
                    <a className="pill" href={booking.pdfFilePath} rel="noreferrer" target="_blank">
                      PDF
                    </a>
                  ) : (
                    <span className="pill">Senza PDF</span>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="card card-pad billboards-history-card">
        <div className="list-header">
          <div>
            <h3>Storico campagne cliente</h3>
            <p className="card-muted">Vista commerciale rapida per capire chi ha gia prenotato, quanto vale e quali impianti usa di piu.</p>
          </div>
        </div>
        <div className="compact-order-list">
          {surface.customerHistory.length === 0 ? (
            <div className="empty">Nessuno storico campagne disponibile.</div>
          ) : (
            surface.customerHistory.slice(0, 16).map((entry) => (
              <article className="compact-order-item" key={entry.customer.id}>
                <div className="compact-order-main">
                  <div className="compact-order-head">
                    <strong>{entry.customer.name}</strong>
                    <span className="compact-order-aside">{entry.bookingCount} campagne</span>
                  </div>
                  <div className="subtle">
                    Ultima campagna dal {formatDate(entry.latestStartsAt)} al {formatDate(entry.latestEndsAt)}
                  </div>
                  <div className="hint">
                    {entry.latestAssets.join(" • ")}
                    {entry.customer.phone ? ` • ${entry.customer.phone}` : ""}
                  </div>
                </div>
                <div className="billboard-history-metrics">
                  <span className="pill status">Confermate {entry.confirmedCount}</span>
                  <span className="pill warning">Opzioni {entry.optionCount}</span>
                  <strong>{formatCurrency(entry.totalValueCents)}</strong>
                  <span className="subtle">Residuo {formatCurrency(entry.totalBalanceDueCents)}</span>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  tone
}: {
  label: string;
  value: number | string;
  hint: string;
  tone: "neutral" | "warning" | "success" | "brand";
}) {
  return (
    <article className={`card card-pad compact-metric compact-metric-${tone}`}>
      <div className="compact-metric-top">
        <span className="compact-metric-label">{label}</span>
      </div>
      <strong>{value}</strong>
      <span className="hint">{hint}</span>
    </article>
  );
}

function parseDateParam(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return startOfMonth(new Date());
  }

  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return startOfMonth(new Date());
  }

  return startOfMonth(parsed);
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

function getMonthLabel(date: Date) {
  const label = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function buildMonthHref(date: Date, assetCode?: string) {
  const searchParams = new URLSearchParams({
    date: formatDateKey(startOfMonth(date))
  });

  if (assetCode) {
    searchParams.set("asset", assetCode);
  }

  return `/billboards?${searchParams.toString()}`;
}

function buildAssetHref(date: Date, assetCode: string) {
  return `${buildMonthHref(date, assetCode)}#selected-billboard`;
}

function buildMonthMatrix(bookings: BillboardSurface["monthBookings"], focusDate: Date) {
  const first = startOfMonth(focusDate);
  const last = endOfMonth(focusDate);
  const gridStart = startOfWeek(first);
  const gridEnd = addDays(startOfWeek(last), 6);
  const today = startOfDay(new Date());
  const days: Array<{
    key: string;
    date: Date;
    inMonth: boolean;
    isToday: boolean;
    entries: BillboardSurface["monthBookings"];
  }> = [];

  for (let cursor = gridStart; cursor <= gridEnd; cursor = addDays(cursor, 1)) {
    const date = startOfDay(cursor);
    days.push({
      key: formatDateKey(date),
      date,
      inMonth: date.getMonth() === focusDate.getMonth(),
      isToday: formatDateKey(date) === formatDateKey(today),
      entries: bookings
        .filter((booking) => bookingIncludesDate(booking, date))
        .sort(
          (left, right) =>
            left.billboardAsset.sortOrder - right.billboardAsset.sortOrder ||
            left.customer.name.localeCompare(right.customer.name, "it")
        )
    });
  }

  const weeks = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }

  return weeks;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return startOfDay(next);
}

function startOfWeek(date: Date) {
  const next = startOfDay(date);
  const day = next.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(next, offset);
}

function getBillboardStatusPillClass(status: BillboardBookingStatus) {
  switch (status) {
    case "OPZIONATO":
      return "warning";
    case "SCADUTO":
      return "danger";
    default:
      return "status";
  }
}

function getBillboardBookingPriorityToneClass(deliveryAt: Date | string) {
  return getPriorityToneClass(computeAutomaticPriority(deliveryAt));
}
