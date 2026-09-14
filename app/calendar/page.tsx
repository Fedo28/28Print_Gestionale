import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { APP_TIMEZONE, normalizeMainPhaseForWorkflow } from "@/lib/constants";
import { requireAuth } from "@/lib/auth";
import { formatCompactDate, formatDate, formatDateKey, formatWeekdayLabel } from "@/lib/format";
import { getDisplayOrderLabel } from "@/lib/order-display";
import { buildOrdersFilterHref } from "@/lib/order-filters";
import { getCalendarOrders, getMonthlyAgendaOrders } from "@/lib/orders";

export const dynamic = "force-dynamic";

type CalendarView = "day" | "week" | "month";
type CalendarOrder = Awaited<ReturnType<typeof getCalendarOrders>>[number];

type CalendarPageProps = {
  searchParams?: {
    view?: string;
    date?: string;
  };
};

type CalendarLoadSummary = {
  workload: number;
  appointments: number;
  toStart: number;
  working: number;
  blocked: number;
  ready: number;
  overdue: number;
};

type CalendarDaySnapshot = {
  key: string;
  date: Date;
  isToday: boolean;
  dueOrders: CalendarOrder[];
  appointmentOrders: CalendarOrder[];
  overdueOrders: CalendarOrder[];
  summary: CalendarLoadSummary;
};

type CalendarWeekSnapshot = {
  days: CalendarDaySnapshot[];
  summary: CalendarLoadSummary;
};

type CalendarSignalTone = "blue" | "lime" | "red" | "cyan";

type CalendarSignal = {
  href: string;
  label: string;
  tone: CalendarSignalTone;
  value: number;
};

type CalendarTimelineItem = {
  order: CalendarOrder;
  variant: "delivery" | "appointment";
};

const MAX_WEEK_DAY_ITEMS = 6;
const MAX_DAY_OVERDUE_ITEMS = 5;

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  await requireAuth();

  const view = normalizeView(searchParams?.view);
  const focusDate = parseDateParam(searchParams?.date);
  const orders = await getCalendarOrders();
  const monthlyAgendaOrders = getMonthlyAgendaOrders(orders);
  const daySnapshot = buildDaySnapshot(orders, focusDate);
  const weekSnapshot = buildWeekSnapshot(orders, focusDate);
  const monthMatrix = getMonthMatrix(monthlyAgendaOrders, focusDate);
  const navigation = getNavigation(view, focusDate);
  const viewLabel = {
    day: "Vista giorno",
    week: "Vista settimana",
    month: "Vista mese"
  }[view];

  return (
    <div className="stack calendar-page-shell">
      <PageHeader
        title="Calendario"
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

        {view === "day" ? <DayCalendar snapshot={daySnapshot} /> : null}
        {view === "week" ? <WeekCalendar focusDate={focusDate} snapshot={weekSnapshot} /> : null}
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
    <Link className={`calendar-switch-link${isActive ? " active" : ""}`} href={href} replace scroll={false}>
      {children}
    </Link>
  );
}

function DayCalendar({ snapshot }: { snapshot: CalendarDaySnapshot }) {
  const entries = getCalendarTimelineItems(snapshot);
  const overduePreview = snapshot.overdueOrders.slice(0, MAX_DAY_OVERDUE_ITEMS);
  const hiddenOverdueCount = Math.max(0, snapshot.overdueOrders.length - MAX_DAY_OVERDUE_ITEMS);

  return (
    <div className="stack">
      <CalendarFocusStrip summary={snapshot.summary} view="day" />

      <div className={`calendar-day-shell${snapshot.overdueOrders.length === 0 ? " calendar-day-shell-single" : ""}`}>
        <section className="card card-pad compact-lane-card calendar-day-timeline" id="calendar-day-schedule">
          <div className="list-header compact-section-head calendar-lane-head">
            <div>
              <h3>Giornata</h3>
            </div>
            <span className="pill calendar-count-badge">{entries.length}</span>
          </div>
          <div className="compact-order-list calendar-timeline-list">
            {entries.length === 0 ? (
              <div className="calendar-slot-empty">Libero</div>
            ) : (
              entries.map((entry) => (
                <CalendarOrderCard
                  focusDate={snapshot.date}
                  key={`${entry.order.id}-${entry.variant}`}
                  order={entry.order}
                  variant={entry.variant}
                />
              ))
            )}
          </div>
        </section>

        {snapshot.overdueOrders.length > 0 ? (
          <section className="card card-pad compact-lane-card calendar-day-overdue" id="calendar-day-overdue">
            <div className="list-header compact-section-head calendar-lane-head">
              <div>
                <h3>Arretrati</h3>
              </div>
              <span className="pill danger calendar-count-badge">{snapshot.overdueOrders.length}</span>
            </div>
            <div className="compact-order-list">
              {overduePreview.map((order) => (
                <CalendarOrderCard focusDate={snapshot.date} key={order.id} order={order} variant="overdue" />
              ))}
              {hiddenOverdueCount > 0 ? (
                <Link className="calendar-more calendar-more-danger" href={buildOrdersFilterHref({ view: "ACTIVE", preset: "OVERDUE" })} prefetch={false}>
                  +{hiddenOverdueCount}
                </Link>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function WeekCalendar({
  snapshot,
  focusDate
}: {
  snapshot: CalendarWeekSnapshot;
  focusDate: Date;
}) {
  const activeDay = snapshot.days.find((day) => isSameDay(day.date, focusDate)) || snapshot.days[0];
  const activeDayEntries = getCalendarTimelineItems(activeDay);

  return (
    <div className="stack">
      <CalendarFocusStrip summary={snapshot.summary} view="week" />

      <div className="calendar-week-layout" id="calendar-week-work">
        <div className="calendar-week-mobile">
          <nav className="calendar-week-day-strip" aria-label="Giorni della settimana">
            {snapshot.days.map((day) => {
              const isActive = day.key === activeDay.key;

              return (
                <Link
                  className={`calendar-week-day-link${isActive ? " active" : ""}${day.isToday ? " today" : ""}`}
                  href={buildCalendarHref("week", day.date)}
                  key={day.key}
                  replace
                  scroll={false}
                >
                  <span>{weekdayLabel(day.date, "compact")}</span>
                  <strong>{day.date.getDate()}</strong>
                  <small>{day.summary.workload + day.summary.appointments}</small>
                </Link>
              );
            })}
          </nav>

          <article className="calendar-week-focus">
            <div className="calendar-week-focus-head">
              <div>
                <strong>{weekdayLabel(activeDay.date)}</strong>
                <span>{formatDate(activeDay.date)}</span>
              </div>
            </div>

            <div className="calendar-week-focus-stats">
              <span className="calendar-day-stat">Lav. {activeDay.summary.workload}</span>
              {activeDay.summary.appointments > 0 ? <span className="calendar-day-stat success">App. {activeDay.summary.appointments}</span> : null}
              {activeDay.summary.blocked > 0 ? <span className="calendar-day-stat warning">Sosp. {activeDay.summary.blocked}</span> : null}
              {activeDay.summary.ready > 0 ? <span className="calendar-day-stat success">Pront. {activeDay.summary.ready}</span> : null}
            </div>

            <section className="calendar-week-focus-section">
              <div className="calendar-section-head">
                <strong>Giornata</strong>
                <span>{activeDayEntries.length}</span>
              </div>
              <div className="calendar-mini-stack">
                {activeDayEntries.length === 0 ? (
                  <div className="calendar-slot-empty">Libero</div>
                ) : (
                  activeDayEntries.map((entry) => (
                    <CalendarWeekItem key={`${entry.order.id}-${entry.variant}`} order={entry.order} variant={entry.variant} />
                  ))
                )}
              </div>
            </section>
          </article>
        </div>

        <div className="calendar-week-grid calendar-week-desktop">
          {snapshot.days.map((day) => {
            const entries = getCalendarTimelineItems(day);
            const hiddenCount = Math.max(0, entries.length - MAX_WEEK_DAY_ITEMS);

            return (
              <article className={getWeekColumnClassName(day)} key={day.key}>
                <div className="calendar-column-head">
                  <div>
                    <strong>{weekdayLabel(day.date)}</strong>
                    <span className="subtle calendar-column-date">{formatCompactDate(day.date)}</span>
                  </div>
                  <Link className="calendar-day-open" href={buildCalendarHref("day", day.date)} prefetch={false}>
                    Apri
                  </Link>
                </div>

                <div className="calendar-column-stats">
                  <span className="calendar-day-stat">Lav. {day.summary.workload}</span>
                  {day.summary.appointments > 0 ? <span className="calendar-day-stat success">App. {day.summary.appointments}</span> : null}
                  {day.summary.blocked > 0 ? <span className="calendar-day-stat warning">Sosp. {day.summary.blocked}</span> : null}
                  {day.summary.ready > 0 ? <span className="calendar-day-stat success">Pront. {day.summary.ready}</span> : null}
                </div>

                <div className="calendar-column-body calendar-column-timeline">
                  {entries.length === 0 ? (
                    <div className="calendar-slot-empty">Libero</div>
                  ) : (
                    entries
                      .slice(0, MAX_WEEK_DAY_ITEMS)
                      .map((entry) => (
                        <CalendarWeekItem key={`${entry.order.id}-${entry.variant}`} order={entry.order} variant={entry.variant} />
                      ))
                  )}
                  {hiddenCount > 0 ? (
                    <Link className="calendar-more" href={buildCalendarHref("day", day.date)} prefetch={false}>
                      +{hiddenCount}
                    </Link>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
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
      entries: CalendarOrder[];
    }>
  >;
  focusDate: Date;
}) {
  const monthKey = `${focusDate.getFullYear()}-${focusDate.getMonth()}`;

  return (
    <div className="calendar-month-wrap" id="calendar-month-grid">
      <div className="calendar-month-weekdays">
        {getWeekdayLabels("compact").map((day) => (
          <span aria-label={day.full} key={day.compact} title={day.full}>
            {day.compact}
          </span>
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
                  <Link
                    className="calendar-entry-link calendar-entry-link-compact calendar-entry-link-accent"
                    href={`/orders/${order.id}`}
                    key={order.id}
                    prefetch={false}
                    title={`${order.customer.name} • ${getDisplayOrderLabel(order.orderCode, order.title)}`}
                  >
                    <span className="calendar-entry-title">{getCalendarEntryTitle(order)}</span>
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

function CalendarFocusStrip({ summary, view }: { summary: CalendarLoadSummary; view: CalendarView }) {
  const signals = getCalendarSignals(summary, view);

  return (
    <nav className="calendar-focus-strip" aria-label="Segnali calendario">
      {signals.map((signal) => (
        <CalendarSignalLink key={signal.label} signal={signal} />
      ))}
    </nav>
  );
}

function CalendarSignalLink({ signal }: { signal: CalendarSignal }) {
  const className = `calendar-signal-link calendar-signal-${signal.tone}`;
  const content = (
    <>
      <span>{signal.label}</span>
      <strong>{signal.value}</strong>
    </>
  );

  if (signal.href.startsWith("#")) {
    return (
      <a className={className} href={signal.href}>
        {content}
      </a>
    );
  }

  return (
    <Link className={className} href={signal.href} prefetch={false}>
      {content}
    </Link>
  );
}

function CalendarSummaryGrid({
  summary,
  labelPrefix,
  overdueLabel,
  view
}: {
  summary: CalendarLoadSummary;
  labelPrefix: "oggi" | "settimana";
  overdueLabel: string;
  view: CalendarView;
}) {
  return (
    <div className={`grid calendar-summary-grid calendar-summary-grid-${view}`}>
      <CalendarMetricCard
        href={getCalendarMetricHref(view, "workload")}
        hint={labelPrefix === "oggi" ? "Consegne previste" : "Consegne nei 7 giorni"}
        icon={<CalendarGlyph kind="work" />}
        kind="workload"
        label="Carico"
        priority="primary"
        tone="neutral"
        value={summary.workload}
      />
      <CalendarMetricCard
        href={getCalendarMetricHref(view, "appointments")}
        hint="Installazioni e incontri"
        icon={<CalendarGlyph kind="schedule" />}
        kind="appointments"
        label="Appuntamenti"
        priority="primary"
        tone="brand"
        value={summary.appointments}
      />
      <CalendarMetricCard
        href={getCalendarMetricHref(view, "toStart")}
        hint="Ordini da far partire"
        icon={<CalendarGlyph kind="play" />}
        kind="toStart"
        label="Da avviare"
        priority="secondary"
        tone="neutral"
        value={summary.toStart}
      />
      <CalendarMetricCard
        href={getCalendarMetricHref(view, "working")}
        hint="Produzione attiva"
        icon={<CalendarGlyph kind="gear" />}
        kind="working"
        label="In lavorazione"
        priority="secondary"
        tone="warning"
        value={summary.working}
      />
      <CalendarMetricCard
        href={getCalendarMetricHref(view, "blocked")}
        hint="File o approvazioni in attesa"
        icon={<CalendarGlyph kind="pause" />}
        kind="blocked"
        label="Sospesi"
        priority="secondary"
        tone="danger"
        value={summary.blocked}
      />
      <CalendarMetricCard
        href={getCalendarMetricHref(view, "overdue")}
        hint={overdueLabel}
        icon={<CalendarGlyph kind="alert" />}
        kind="overdue"
        label="Arretrati"
        priority="primary"
        tone={summary.overdue > 0 ? "danger" : "neutral"}
        value={summary.overdue}
      />
      <CalendarMetricCard
        href={getCalendarMetricHref(view, "ready")}
        hint="Ordini già pronti"
        icon={<CalendarGlyph kind="spark" />}
        kind="ready"
        label="Pronti"
        priority="secondary"
        tone="success"
        value={summary.ready}
      />
    </div>
  );
}

function CalendarMetricCard({
  icon,
  label,
  value,
  hint,
  tone,
  href,
  priority,
  kind
}: {
  icon: ReactNode;
  label: string;
  value: number;
  hint: string;
  tone: "neutral" | "danger" | "warning" | "success" | "brand";
  href: string;
  priority: "primary" | "secondary";
  kind: "workload" | "appointments" | "toStart" | "working" | "blocked" | "overdue" | "ready";
}) {
  const className = `card card-pad compact-metric calendar-metric-card calendar-metric-card-link compact-metric-${tone} calendar-metric-card-${priority} calendar-metric-kind-${kind}`;
  const content = (
    <>
      <div className="calendar-metric-head">
        <span className="compact-icon">{icon}</span>
        <div className="calendar-metric-copy">
          <span className="compact-metric-label">{label}</span>
          <span className="hint">{hint}</span>
        </div>
        <strong>{value}</strong>
      </div>
    </>
  );

  if (href.startsWith("#")) {
    return (
      <a className={className} href={href}>
        {content}
      </a>
    );
  }

  return (
    <Link className={className} href={href} prefetch={false}>
      {content}
    </Link>
  );
}

function getCalendarMetricHref(
  view: CalendarView,
  kind: "workload" | "appointments" | "toStart" | "working" | "blocked" | "overdue" | "ready"
) {
  switch (kind) {
    case "workload":
      return view === "day" ? "#calendar-day-schedule" : view === "week" ? "#calendar-week-work" : "#calendar-month-grid";
    case "appointments":
      return view === "day"
        ? "#calendar-day-schedule"
        : view === "week"
          ? "#calendar-week-work"
          : "#calendar-month-grid";
    case "toStart":
      return buildOrdersFilterHref({ view: "ACTIVE", preset: "TO_START" });
    case "working":
      return buildOrdersFilterHref({ view: "ACTIVE", preset: "WORKING" });
    case "blocked":
      return buildOrdersFilterHref({ view: "ACTIVE", preset: "BLOCKED" });
    case "overdue":
      return buildOrdersFilterHref({ view: "ACTIVE", preset: "OVERDUE" });
    case "ready":
      return buildOrdersFilterHref({ view: "ACTIVE", preset: "READY" });
  }
}

function getCalendarSignals(summary: CalendarLoadSummary, view: CalendarView): CalendarSignal[] {
  const baseSignals: CalendarSignal[] = [
    { href: getCalendarMetricHref(view, "workload"), label: "Lavori", tone: "blue", value: summary.workload }
  ];

  const conditionalSignals: Array<CalendarSignal & { show: boolean }> = [
    { href: getCalendarMetricHref(view, "appointments"), label: "App.", tone: "cyan", value: summary.appointments, show: summary.appointments > 0 },
    { href: getCalendarMetricHref(view, "toStart"), label: "Da avviare", tone: "lime", value: summary.toStart, show: summary.toStart > 0 },
    { href: getCalendarMetricHref(view, "working"), label: "In corso", tone: "blue", value: summary.working, show: summary.working > 0 },
    { href: getCalendarMetricHref(view, "ready"), label: "Pronti", tone: "cyan", value: summary.ready, show: summary.ready > 0 },
    { href: getCalendarMetricHref(view, "blocked"), label: "Sosp.", tone: "red", value: summary.blocked, show: summary.blocked > 0 },
    { href: getCalendarMetricHref(view, "overdue"), label: "Arretrati", tone: "red", value: summary.overdue, show: summary.overdue > 0 }
  ];

  return [...conditionalSignals.filter((signal) => signal.tone === "red" && signal.show), ...baseSignals, ...conditionalSignals.filter((signal) => signal.tone !== "red" && signal.show)];
}

function CalendarOrderCard({
  order,
  focusDate,
  variant
}: {
  order: CalendarOrder;
  focusDate: Date;
  variant: "delivery" | "appointment" | "overdue";
}) {
  const tone = getOrderTone(order, focusDate, variant);
  const title = getCalendarEntryTitle(order);
  const meta = getCalendarEntryMeta(order, variant);

  return (
    <Link
      className={`calendar-entry-link calendar-entry-link-day calendar-entry-link-${tone}${variant === "appointment" ? " calendar-entry-link-accent" : ""}`}
      href={`/orders/${order.id}`}
      prefetch={false}
      title={`${order.customer.name} • ${getDisplayOrderLabel(order.orderCode, order.title)}`}
    >
      <span className="calendar-entry-kind">{getCalendarEntryKindLabel(variant)}</span>
      <span className="calendar-entry-copy">
        <span className="calendar-entry-title">{title}</span>
        <span className="calendar-entry-meta">{meta}</span>
      </span>
      <span className={`calendar-entry-phase calendar-entry-phase-${tone}`}>{getCalendarPhaseLabel(order)}</span>
    </Link>
  );
}

function CalendarWeekItem({
  order,
  variant
}: {
  order: CalendarOrder;
  variant: "delivery" | "appointment";
}) {
  const tone = variant === "appointment" ? "success" : getOrderTone(order, new Date(order.deliveryAt), "delivery");

  return (
    <Link
      className={`calendar-entry-link calendar-entry-link-compact calendar-entry-link-uniform calendar-entry-link-${tone}${variant === "appointment" ? " calendar-entry-link-uniform-appointment" : ""}`}
      href={`/orders/${order.id}`}
      prefetch={false}
      title={`${order.customer.name} • ${getDisplayOrderLabel(order.orderCode, order.title)}`}
    >
      <span className="calendar-entry-kind">{getCalendarEntryKindLabel(variant)}</span>
      <span className="calendar-entry-copy">
        <span className="calendar-entry-title">{getCalendarEntryTitle(order)}</span>
        <span className="calendar-entry-meta">{getCalendarEntryMeta(order, variant)}</span>
      </span>
    </Link>
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

function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function addBusinessDays(date: Date, amount: number) {
  let cursor = startOfDay(date);
  let remaining = amount;

  while (remaining > 0) {
    cursor = addDays(cursor, 1);
    if (!isWeekend(cursor)) {
      remaining -= 1;
    }
  }

  return cursor;
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

function buildDaySnapshot(orders: CalendarOrder[], focusDate: Date): CalendarDaySnapshot {
  const dueOrders = sortByDelivery(orders.filter((order) => isSameDay(order.deliveryAt, focusDate)));
  const appointmentOrders = sortByAppointment(orders.filter((order) => order.appointmentAt && isSameDay(order.appointmentAt, focusDate)));
  const overdueOrders = sortByDelivery(orders.filter((order) => new Date(order.deliveryAt).getTime() < focusDate.getTime()));

  return {
    key: formatDateKey(focusDate),
    date: focusDate,
    isToday: isSameDay(focusDate, new Date()),
    dueOrders,
    appointmentOrders,
    overdueOrders,
    summary: buildSummary(dueOrders, appointmentOrders.length, overdueOrders.length)
  };
}

function buildWeekSnapshot(orders: CalendarOrder[], focusDate: Date): CalendarWeekSnapshot {
  const weekStart = startOfWeek(focusDate);
  const days = Array.from({ length: 7 }, (_, index) => buildDaySnapshot(orders, addDays(weekStart, index)));
  const weekOrders = days.flatMap((day) => day.dueOrders);
  const weekAppointments = days.reduce((sum, day) => sum + day.appointmentOrders.length, 0);
  const overdue = orders.filter((order) => new Date(order.deliveryAt).getTime() < weekStart.getTime()).length;

  return {
    days,
    summary: buildSummary(weekOrders, weekAppointments, overdue)
  };
}

function buildSummary(orders: CalendarOrder[], appointments: number, overdue: number): CalendarLoadSummary {
  const summary: CalendarLoadSummary = {
    workload: orders.length,
    appointments,
    toStart: 0,
    working: 0,
    blocked: 0,
    ready: 0,
    overdue
  };

  for (const order of orders) {
    if (order.operationalStatus !== "ATTIVO") {
      summary.blocked += 1;
      continue;
    }

    const phase = normalizeMainPhaseForWorkflow(order.mainPhase);
    if (phase === "ACCETTATO") {
      summary.toStart += 1;
      continue;
    }

    if (phase === "IN_LAVORAZIONE") {
      summary.working += 1;
      continue;
    }

    if (phase === "SVILUPPO_COMPLETATO") {
      summary.ready += 1;
    }
  }

  return summary;
}

function getMonthMatrix(orders: CalendarOrder[], focusDate: Date) {
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
    entries: CalendarOrder[];
  }> = [];

  for (let cursor = gridStart; cursor <= gridEnd; cursor = addDays(cursor, 1)) {
    const date = startOfDay(cursor);
    days.push({
      key: formatDateKey(date),
      date,
      inMonth: date.getMonth() === focusDate.getMonth(),
      isToday: formatDateKey(date) === formatDateKey(today),
      entries: sortByAppointment(orders.filter((order) => order.appointmentAt && isSameDay(order.appointmentAt, date)))
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
    prevHref: buildCalendarHref("month", new Date(focusDate.getFullYear(), focusDate.getMonth() - 1, 1)),
    nextHref: buildCalendarHref("month", new Date(focusDate.getFullYear(), focusDate.getMonth() + 1, 1)),
    todayHref: buildCalendarHref("month", startOfDay(new Date()))
  };
}

function buildCalendarHref(view: CalendarView, date: Date) {
  return `/calendar?view=${view}&date=${formatDateKey(startOfDay(date))}`;
}

function getWeekColumnClassName(day: CalendarDaySnapshot) {
  const classes = ["calendar-column"];
  const isWeekendDay = isWeekend(day.date);
  const today = startOfDay(new Date());

  if (day.isToday) {
    classes.push("today");
  }

  if (isWeekendDay) {
    classes.push("weekend");
  }

  if (!isWeekendDay && isSameDay(day.date, addBusinessDays(today, 1))) {
    classes.push("priority-next");
  }

  if (!isWeekendDay && isSameDay(day.date, addBusinessDays(today, 2))) {
    classes.push("priority-later");
  }

  return classes.join(" ");
}

function weekdayLabel(date: Date, variant: "short" | "compact" = "short") {
  return formatWeekdayLabel(date, variant);
}

function getWeekdayLabels(variant: "short" | "compact") {
  const dates = [
    new Date(2026, 3, 6),
    new Date(2026, 3, 7),
    new Date(2026, 3, 8),
    new Date(2026, 3, 9),
    new Date(2026, 3, 10),
    new Date(2026, 3, 11),
    new Date(2026, 3, 12)
  ];

  return dates.map((date) => ({
    full: new Intl.DateTimeFormat("it-IT", { weekday: "long" }).format(date),
    compact: formatWeekdayLabel(date, variant)
  }));
}

function sortByDelivery(orders: CalendarOrder[]) {
  return [...orders].sort((left, right) => new Date(left.deliveryAt).getTime() - new Date(right.deliveryAt).getTime());
}

function sortByAppointment(orders: CalendarOrder[]) {
  return [...orders].sort(
    (left, right) => new Date(left.appointmentAt || left.deliveryAt).getTime() - new Date(right.appointmentAt || right.deliveryAt).getTime()
  );
}

function getCalendarEntryTitle(order: CalendarOrder) {
  return order.customer.name;
}

function getCalendarTimelineItems(day: CalendarDaySnapshot): CalendarTimelineItem[] {
  const entries = new Map<string, CalendarTimelineItem>();

  for (const order of day.dueOrders) {
    entries.set(order.id, { order, variant: "delivery" });
  }

  for (const order of day.appointmentOrders) {
    entries.set(order.id, { order, variant: "appointment" });
  }

  return Array.from(entries.values()).sort((left, right) => getTimelineItemTime(left) - getTimelineItemTime(right));
}

function getTimelineItemTime(item: CalendarTimelineItem) {
  const value = item.variant === "appointment" ? item.order.appointmentAt || item.order.deliveryAt : item.order.deliveryAt;
  return new Date(value).getTime();
}

function getCalendarEntryKindLabel(variant: "delivery" | "appointment" | "overdue") {
  if (variant === "appointment") {
    return "App.";
  }

  return "Cons.";
}

function getCalendarEntryMeta(order: CalendarOrder, variant: "delivery" | "appointment" | "overdue") {
  const label = getDisplayOrderLabel(order.orderCode, order.title);
  const time = variant === "appointment" && order.appointmentAt ? formatCalendarTime(order.appointmentAt) : "";

  return time ? `${label} - ${time}` : label;
}

function getCalendarPhaseLabel(order: CalendarOrder) {
  if (order.operationalStatus !== "ATTIVO") {
    return "Sosp.";
  }

  const phase = normalizeMainPhaseForWorkflow(order.mainPhase);

  if (phase === "ACCETTATO") {
    return "Da avviare";
  }

  if (phase === "SVILUPPO_COMPLETATO") {
    return "Pronto";
  }

  return "In corso";
}

function formatCalendarTime(date: Date | string) {
  const value = typeof date === "string" ? new Date(date) : date;

  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIMEZONE
  }).format(value);
}

function getOrderTone(order: CalendarOrder, focusDate: Date, variant: "delivery" | "appointment" | "overdue") {
  if (variant === "overdue" || new Date(order.deliveryAt).getTime() < focusDate.getTime()) {
    return "danger";
  }

  if (order.operationalStatus !== "ATTIVO") {
    return "warning";
  }

  if (normalizeMainPhaseForWorkflow(order.mainPhase) === "SVILUPPO_COMPLETATO") {
    return "success";
  }

  return "neutral";
}

function CalendarGlyph({
  kind
}: {
  kind: "work" | "schedule" | "play" | "gear" | "pause" | "spark" | "alert";
}) {
  const paths = {
    work: <path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7m-12 2h16v8.5A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5Z" />,
    schedule: <path d="M7 3v3m10-3v3M5.5 6.5h13A1.5 1.5 0 0 1 20 8v10.5A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5V8a1.5 1.5 0 0 1 1.5-1.5ZM8 11h3v3H8z" />,
    play: <path d="M12 4.5v15m-4-7.5h8M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18Z" />,
    gear: <path d="M10.3 4.8h3.4l.5 1.9a5.9 5.9 0 0 1 1.4.8l1.8-.8l1.7 2.9l-1.4 1.4c.1.3.2.7.2 1s-.1.7-.2 1l1.4 1.4l-1.7 2.9l-1.8-.8c-.4.3-.9.5-1.4.8l-.5 1.9h-3.4l-.5-1.9a5.9 5.9 0 0 1-1.4-.8l-1.8.8l-1.7-2.9l1.4-1.4a4.2 4.2 0 0 1 0-2l-1.4-1.4l1.7-2.9l1.8.8c.4-.3.9-.5 1.4-.8ZM12 14.8a2.8 2.8 0 1 0 0-5.6a2.8 2.8 0 0 0 0 5.6Z" />,
    pause: <path d="M9.2 6.8h1.9v10.4H9.2zm3.7 0h1.9v10.4h-1.9zM12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18Z" />,
    spark: <path d="m12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Zm6 13l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8L18 16ZM6 14l1 2.8L9.8 18L7 19l-1 2.8L5 19l-2.8-1L5 16.8L6 14Z" />,
    alert: <path d="M12 8v5m0 3h.01M10.3 4.9L3.8 16.2a1.5 1.5 0 0 0 1.3 2.3h13.8a1.5 1.5 0 0 0 1.3-2.3L13.7 4.9a1.9 1.9 0 0 0-3.4 0Z" />
  };

  return (
    <svg aria-hidden="true" className="glyph" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      {paths[kind]}
    </svg>
  );
}
