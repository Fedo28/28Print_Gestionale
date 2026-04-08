import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { BillboardBookingForm } from "@/components/billboard-booking-form";
import { requireAuth } from "@/lib/auth";
import { bookingIncludesDate, getBillboardKindLabel, getBillboardSurface } from "@/lib/billboards";
import { formatDate, formatDateKey } from "@/lib/format";
import { getCustomers } from "@/lib/orders";

export const dynamic = "force-dynamic";

type BillboardPageProps = {
  searchParams?: {
    date?: string;
  };
};

export default async function BillboardsPage({ searchParams }: BillboardPageProps) {
  await requireAuth();

  const focusDate = parseDateParam(searchParams?.date);
  const [customers, surface] = await Promise.all([getCustomers(), getBillboardSurface(focusDate)]);
  const monthMatrix = buildMonthMatrix(surface.monthBookings, focusDate);
  const today = startOfDay(new Date());
  const occupiedToday = surface.assets.filter((asset) => asset.bookings.some((booking) => bookingIncludesDate(booking, today))).length;
  const upcomingStartsThisWeek = surface.upcomingBookings.filter((booking) => {
    const diff = startOfDay(new Date(booking.startsAt)).getTime() - today.getTime();
    return diff >= 0 && diff <= 6 * DAY_IN_MS;
  }).length;
  const monthLabel = getMonthLabel(focusDate);

  return (
    <div className="stack">
      <PageHeader
        title="Cartelloni"
        description="Prenotazioni pubblicitarie su cartelloni, monitor e vela itinerante. In questa prima versione calendario e inserimento stanno insieme sulla stessa pagina."
      />

      <section className="grid billboard-summary-grid">
        <MetricCard hint="24 cartelloni, 1 monitor, 1 vela" label="Impianti attivi" tone="neutral" value={surface.assets.length} />
        <MetricCard hint="Occupati nel giorno corrente" label="Occupati oggi" tone="warning" value={occupiedToday} />
        <MetricCard hint="Ancora disponibili oggi" label="Liberi oggi" tone="success" value={surface.assets.length - occupiedToday} />
        <MetricCard hint={monthLabel} label="Prenotazioni nel mese" tone="brand" value={surface.monthBookings.length} />
        <MetricCard hint="Nuove partenze nei prossimi 7 giorni" label="Partenze vicine" tone="neutral" value={upcomingStartsThisWeek} />
      </section>

      <div className="grid grid-2">
        <section className="card card-pad">
          <div className="list-header">
            <div>
              <h3>Nuova prenotazione</h3>
              <p className="card-muted">Seleziona cliente, impianto, periodo e allega eventualmente il PDF della campagna.</p>
            </div>
          </div>
          <BillboardBookingForm
            assets={surface.assets.map((asset) => ({
              id: asset.id,
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
              taxCode: customer.taxCode,
              vatNumber: customer.vatNumber,
              type: customer.type,
              orderCount: customer.orders.length
            }))}
            defaultEndDate={formatDateKey(focusDate)}
            defaultStartDate={formatDateKey(focusDate)}
          />
        </section>

        <section className="card card-pad">
          <div className="list-header">
            <div>
              <h3>Impianti</h3>
              <p className="card-muted">Inventario iniziale generato automaticamente, pronto da personalizzare con i luoghi reali.</p>
            </div>
            <span className="pill">{surface.assets.length}</span>
          </div>
          <div className="billboard-asset-grid">
            {surface.assets.map((asset) => {
              const activeBooking = asset.bookings.find((booking) => bookingIncludesDate(booking, today));
              const nextBooking = asset.bookings.find((booking) => new Date(booking.startsAt).getTime() >= today.getTime());

              return (
                <article className={`billboard-asset-card${activeBooking ? " occupied" : ""}`} key={asset.id}>
                  <div className="list-header">
                    <div>
                      <strong>{asset.name}</strong>
                      <div className="subtle">
                        {getBillboardKindLabel(asset.kind)}
                        {asset.location ? ` • ${asset.location}` : ""}
                      </div>
                    </div>
                    <span className={`pill ${activeBooking ? "warning" : "status"}`}>{activeBooking ? "Occupato" : "Libero"}</span>
                  </div>

                  {activeBooking ? (
                    <div className="compact-stack">
                      <div className="subtle">{activeBooking.customer.name}</div>
                      <div className="hint">
                        Dal {formatDate(activeBooking.startsAt)} al {formatDate(activeBooking.endsAt)}
                      </div>
                    </div>
                  ) : nextBooking ? (
                    <div className="compact-stack">
                      <div className="subtle">Prossimo: {nextBooking.customer.name}</div>
                      <div className="hint">
                        Dal {formatDate(nextBooking.startsAt)} al {formatDate(nextBooking.endsAt)}
                      </div>
                    </div>
                  ) : (
                    <div className="hint">Nessuna prenotazione imminente.</div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <section className="card card-pad calendar-shell">
        <div className="calendar-nav">
          <div>
            <span className="compact-kicker">Prenotazioni</span>
            <h3>{monthLabel}</h3>
            <p className="card-muted">Calendario mensile con la copertura giornaliera degli impianti pubblicitari.</p>
          </div>
          <div className="calendar-nav-actions">
            <Link className="button secondary" href={buildMonthHref(new Date(focusDate.getFullYear(), focusDate.getMonth() - 1, 1))}>
              Mese precedente
            </Link>
            <Link className="button ghost" href={buildMonthHref(new Date())}>
              Oggi
            </Link>
            <Link className="button secondary" href={buildMonthHref(new Date(focusDate.getFullYear(), focusDate.getMonth() + 1, 1))}>
              Mese successivo
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
                      <div className="billboard-booking-chip" key={booking.id}>
                        <strong>{booking.billboardAsset.name}</strong>
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

      <section className="card card-pad">
        <div className="list-header">
          <div>
            <h3>Prenotazioni in programma</h3>
            <p className="card-muted">Le prossime campagne attive o future, con eventuali PDF allegati.</p>
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
                    {getBillboardKindLabel(booking.billboardAsset.kind)}
                    {booking.billboardAsset.location ? ` • ${booking.billboardAsset.location}` : ""}
                    {booking.note ? ` • ${booking.note}` : ""}
                  </div>
                </div>
                {booking.pdfFilePath ? (
                  <a className="pill" href={booking.pdfFilePath} rel="noreferrer" target="_blank">
                    PDF
                  </a>
                ) : (
                  <span className="pill">Senza PDF</span>
                )}
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
  value: number;
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

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function getMonthLabel(date: Date) {
  const label = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function buildMonthHref(date: Date) {
  return `/billboards?date=${formatDateKey(startOfMonth(date))}`;
}

function buildMonthMatrix(
  bookings: Awaited<ReturnType<typeof getBillboardSurface>>["monthBookings"],
  focusDate: Date
) {
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
    entries: typeof bookings;
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
