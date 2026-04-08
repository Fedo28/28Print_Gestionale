import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { QuickOrderControls } from "@/components/quick-order-controls";
import { StatusPills } from "@/components/status-pills";
import { requireAuth } from "@/lib/auth";
import { formatCurrency, formatDate, formatDateKey, formatDateTime } from "@/lib/format";
import { getCalendarOrders, getMonthlyAgendaOrders } from "@/lib/orders";

export const dynamic = "force-dynamic";

type CalendarView = "day" | "week" | "month";

type CalendarPageProps = {
  searchParams?: {
    view?: string;
    date?: string;
  };
};

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  await requireAuth();

  const view = normalizeView(searchParams?.view);
  const focusDate = parseDateParam(searchParams?.date);
  const orders = await getCalendarOrders();
  const monthlyAgendaOrders = getMonthlyAgendaOrders(orders);

  const dayEntries = getDayEntries(orders, focusDate);
  const weekDays = getWeekDays(orders, focusDate);
  const monthMatrix = getMonthMatrix(monthlyAgendaOrders, focusDate);
  const navigation = getNavigation(view, focusDate);
  const viewLabel = {
    day: "Vista giorno",
    week: "Vista settimana",
    month: "Vista mese"
  }[view];

  return (
    <div className="stack">
      <PageHeader
        title="Calendario"
        description="Programmazione interna basata sugli appuntamenti e sulle lavorazioni pianificate."
        action={
          <div className="calendar-toolbar">
            <nav className="calendar-view-switch" aria-label="Selettore vista calendario">
              <CalendarSwitchLink current={view} href={buildCalendarHref("day", focusDate)}>
                Giorno
              </CalendarSwitchLink>
              <CalendarSwitchLink current={view} href={buildCalendarHref("week", focusDate)}>
                Settimana
              </CalendarSwitchLink>
              <CalendarSwitchLink current={view} href={buildCalendarHref("month", focusDate)}>
                Mese
              </CalendarSwitchLink>
            </nav>
          </div>
        }
      />

      <section className="card card-pad calendar-shell">
        <div className="calendar-nav">
          <div>
            <span className="compact-kicker">{viewLabel}</span>
            <h3>{navigation.title}</h3>
            <p className="card-muted">{navigation.subtitle}</p>
          </div>
          <div className="calendar-nav-actions">
            <Link className="button secondary" href={navigation.prevHref}>
              Indietro
            </Link>
            <Link className="button ghost" href={navigation.todayHref}>
              Oggi
            </Link>
            <Link className="button secondary" href={navigation.nextHref}>
              Avanti
            </Link>
          </div>
        </div>

        {view === "day" ? <DayCalendar entries={dayEntries} /> : null}
        {view === "week" ? <WeekCalendar days={weekDays} /> : null}
        {view === "month" ? <MonthCalendar weeks={monthMatrix} focusDate={focusDate} /> : null}
      </section>
    </div>
  );
}

function CalendarSwitchLink({
  href,
  current,
  children
}: {
  href: string;
  current: CalendarView;
  children: ReactNode;
}) {
  const isActive = href.includes(`view=${current}`);
  return (
    <Link className={`calendar-switch-link${isActive ? " active" : ""}`} href={href}>
      {children}
    </Link>
  );
}

function DayCalendar({ entries }: { entries: Awaited<ReturnType<typeof getCalendarOrders>> }) {
  return (
    <div className="calendar-day-list">
      {entries.length === 0 ? (
        <div className="empty">Nessun appuntamento programmato per questa giornata.</div>
      ) : (
        entries.map((order) => (
          <article className="calendar-event-card" key={order.id}>
            <div className="calendar-event-main">
              <div className="list-header order-inline-head">
                <QuickOrderControls
                  align="start"
                  hasWhatsapp={Boolean((order.customer.whatsapp || order.customer.phone || "").replace(/[^\d+]/g, ""))}
                  orderId={order.id}
                  phase={order.mainPhase}
                  status={order.operationalStatus}
                />
                <Link className="order-code" href={`/orders/${order.id}`} prefetch={false}>
                  {order.orderCode}
                </Link>
                <strong>{formatCurrency(order.totalCents)}</strong>
              </div>
              <div className="subtle">
                {order.customer.name} • {formatDateTime(order.appointmentAt || order.deliveryAt)}
              </div>
              <div className="hint">Consegna prevista {formatDateTime(order.deliveryAt)}</div>
            </div>
            <StatusPills phase={order.mainPhase} status={order.operationalStatus} payment={order.paymentStatus} />
          </article>
        ))
      )}
    </div>
  );
}

function WeekCalendar({
  days
}: {
  days: Array<{
    key: string;
    date: Date;
    entries: Awaited<ReturnType<typeof getCalendarOrders>>;
  }>;
}) {
  return (
    <div className="calendar-week-grid">
      {days.map((day) => (
        <article className="calendar-column" key={day.key}>
          <div className="calendar-column-head">
            <strong>{weekdayLabel(day.date)}</strong>
            <span className="subtle">{formatDate(day.date)}</span>
          </div>
          <div className="calendar-column-body">
            {day.entries.length === 0 ? (
              <div className="calendar-slot-empty">Libero</div>
            ) : (
              day.entries.map((order) => (
                <div className="calendar-mini-event-row" key={order.id}>
                  <QuickOrderControls
                    align="start"
                    hasWhatsapp={Boolean((order.customer.whatsapp || order.customer.phone || "").replace(/[^\d+]/g, ""))}
                    orderId={order.id}
                    phase={order.mainPhase}
                    status={order.operationalStatus}
                  />
                  <Link className="calendar-mini-event" href={`/orders/${order.id}`} prefetch={false}>
                    <strong>{order.orderCode}</strong>
                    <span>{order.customer.name}</span>
                    <span>{timeLabel(order.appointmentAt || order.deliveryAt)}</span>
                  </Link>
                </div>
              ))
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function MonthCalendar({
  weeks,
  focusDate
}: {
  weeks: Array<
    Array<{
      key: string;
      date: Date;
      inMonth: boolean;
      isToday: boolean;
      entries: Awaited<ReturnType<typeof getCalendarOrders>>;
    }>
  >;
  focusDate: Date;
}) {
  const monthKey = `${focusDate.getFullYear()}-${focusDate.getMonth()}`;

  return (
    <div className="calendar-month-wrap">
      <div className="calendar-month-weekdays">
        {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="calendar-month-grid">
        {weeks.flat().map((day) => {
          const isFocusMonth = `${day.date.getFullYear()}-${day.date.getMonth()}` === monthKey;
          return (
            <article
              className={`calendar-month-cell${isFocusMonth ? "" : " muted"}${day.isToday ? " today" : ""}`}
              key={day.key}
            >
              <div className="calendar-month-head">
                <strong>{day.date.getDate()}</strong>
                <span>{day.entries.length}</span>
              </div>
              <div className="calendar-month-events">
                {day.entries.slice(0, 3).map((order) => (
                  <Link className="calendar-month-event" href={`/orders/${order.id}`} key={order.id} prefetch={false}>
                    <span>{timeLabel(order.appointmentAt || order.deliveryAt)}</span>
                    <strong>{order.customer.name}</strong>
                    <span>{order.title}</span>
                    {order.appointmentNote ? <span className="calendar-month-note">{order.appointmentNote}</span> : null}
                  </Link>
                ))}
                {day.entries.length > 3 ? <span className="calendar-more">+{day.entries.length - 3} altri</span> : null}
                {!day.inMonth && day.entries.length === 0 ? <span className="calendar-slot-empty"> </span> : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function normalizeView(value?: string): CalendarView {
  if (value === "day" || value === "week" || value === "month") {
    return value;
  }

  return "week";
}

function parseDateParam(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return startOfDay(new Date());
  }

  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return startOfDay(new Date());
  }

  return startOfDay(parsed);
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
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

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function isSameDay(left: Date | string, right: Date) {
  return formatDateKey(new Date(left)) === formatDateKey(right);
}

function getDayEntries(orders: Awaited<ReturnType<typeof getCalendarOrders>>, focusDate: Date) {
  return orders.filter((order) => order.appointmentAt && isSameDay(order.appointmentAt, focusDate));
}

function getWeekDays(orders: Awaited<ReturnType<typeof getCalendarOrders>>, focusDate: Date) {
  const weekStart = startOfWeek(focusDate);

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    return {
      key: formatDateKey(date),
      date,
      entries: orders.filter((order) => order.appointmentAt && isSameDay(order.appointmentAt, date))
    };
  });
}

function getMonthMatrix(orders: Awaited<ReturnType<typeof getCalendarOrders>>, focusDate: Date) {
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
    entries: Awaited<ReturnType<typeof getCalendarOrders>>;
  }> = [];

  for (let cursor = gridStart; cursor <= gridEnd; cursor = addDays(cursor, 1)) {
    const date = startOfDay(cursor);
    days.push({
      key: formatDateKey(date),
      date,
      inMonth: date.getMonth() === focusDate.getMonth(),
      isToday: formatDateKey(date) === formatDateKey(today),
      entries: orders
        .filter((order) => order.appointmentAt && isSameDay(order.appointmentAt, date))
        .sort(
          (left, right) =>
            new Date(left.appointmentAt || left.deliveryAt).getTime() - new Date(right.appointmentAt || right.deliveryAt).getTime()
        )
    });
  }

  const weeks = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }

  return weeks;
}

function getNavigation(view: CalendarView, focusDate: Date) {
  if (view === "day") {
    return {
      title: formatDate(focusDate),
      subtitle: "Appuntamenti e lavorazioni programmati nella giornata selezionata.",
      prevHref: buildCalendarHref("day", addDays(focusDate, -1)),
      nextHref: buildCalendarHref("day", addDays(focusDate, 1)),
      todayHref: buildCalendarHref("day", startOfDay(new Date()))
    };
  }

  if (view === "week") {
    const start = startOfWeek(focusDate);
    const end = addDays(start, 6);
    return {
      title: `${formatDate(start)} - ${formatDate(end)}`,
      subtitle: "Settimana completa per distribuire appuntamenti, installazioni e lavorazioni.",
      prevHref: buildCalendarHref("week", addDays(start, -7)),
      nextHref: buildCalendarHref("week", addDays(start, 7)),
      todayHref: buildCalendarHref("week", startOfDay(new Date()))
    };
  }

  const monthLabel = new Intl.DateTimeFormat("it-IT", {
    month: "long",
    year: "numeric"
  }).format(focusDate);

  return {
    title: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
    subtitle: "Agenda mensile per appuntamenti, installazioni e lavorazioni programmate.",
    prevHref: buildCalendarHref("month", new Date(focusDate.getFullYear(), focusDate.getMonth() - 1, 1)),
    nextHref: buildCalendarHref("month", new Date(focusDate.getFullYear(), focusDate.getMonth() + 1, 1)),
    todayHref: buildCalendarHref("month", startOfDay(new Date()))
  };
}

function buildCalendarHref(view: CalendarView, date: Date) {
  return `/calendar?view=${view}&date=${formatDateKey(startOfDay(date))}`;
}

function weekdayLabel(date: Date) {
  return new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(date);
}

function timeLabel(date: Date | string) {
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(date));
}
