import Link from "next/link";
import type { ReactNode } from "react";
import type { MainPhase, PaymentStatus } from "@prisma/client";
import { PageHeader } from "@/components/page-header";
import { QuickOrderControls } from "@/components/quick-order-controls";
import { StatusPills } from "@/components/status-pills";
import { operationalStatusLabels, paymentStatusLabels } from "@/lib/constants";
import { formatCompactDate, formatCurrency, formatDateKey, formatDateTime, formatWeekdayLabel } from "@/lib/format";
import { buildOrdersFilterHref } from "@/lib/order-filters";
import { getDashboardData, type DashboardWeekDayLoad } from "@/lib/orders";
import { getWorkdayHighlight } from "@/lib/workday-highlights";

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
type DashboardOrder = DashboardData["todayOrders"][number];
type DashboardPanel = "PRIORITY" | "PRODUCTION" | "APPOINTMENTS" | "FINANCE";
type DashboardFocus = "PRIORITY" | "TOMORROW" | "TO_START" | "BLOCKED" | "READY";
type DashboardDayFocus = "ALL" | "WORKLOAD" | "APPOINTMENTS";
type DashboardReadyMode = "TO_NOTIFY" | "NOTIFIED";
type DashboardFinanceMode = "PAID" | "UNPAID";
type DashboardFinanceSort = "AGE" | "AMOUNT";
type DashboardPulse = "CALENDAR" | "DAY" | "PRIORITY" | "TO_START" | "LATE_START" | "BLOCKED" | "READY" | "FINANCE" | "FINANCE_AGED" | "TOMORROW";
type DashboardAccent = "today" | "agenda" | "overdue" | "to-start" | "working" | "blocked" | "ready" | "balance";

export async function DashboardPage({
  panel,
  focus,
  day,
  dayFocus,
  readyMode,
  financeMode,
  financeSort,
  pulse
}: {
  panel?: string;
  focus?: string;
  day?: string;
  dayFocus?: string;
  readyMode?: string;
  financeMode?: string;
  financeSort?: string;
  pulse?: string;
}) {
  const {
    todayOrders,
    todayAppointments,
    overdueOrders,
    blockedOrders,
    readyOrders,
    invoiceOrders,
    priorityOrders,
    toStartOrders,
    workingOrders,
    weekOrders,
    weekLoad
  } = await getDashboardData();

  const nextDelivery = getSoonestDeliveryOrder(mergeUniqueOrders(overdueOrders, todayOrders, toStartOrders, workingOrders));
  const nextAppointment = todayAppointments[0];
  const weeklyAppointments = weekLoad.reduce((sum, day) => sum + day.appointments, 0);
  const activePanel = parseDashboardPanel(panel);
  const activeFocus = parseDashboardFocus(focus);
  const activeDayFocus = parseDashboardDayFocus(dayFocus);
  const isFinancePanelOpen = activePanel === "FINANCE";
  const activePulse = parseDashboardPulse(pulse);
  const selectedDay = getSelectedDashboardDay(weekLoad, day);
  const selectedDayAllOrders = selectedDay ? getOrdersForDashboardDay(weekOrders, selectedDay.date) : [];
  const selectedDayOrders = selectedDay ? filterDashboardDayOrders(selectedDayAllOrders, selectedDay.date, activeDayFocus) : [];
  const selectedDayStats = selectedDay
    ? {
        workload: selectedDayAllOrders.filter((order) => isSameDashboardDay(order.deliveryAt, selectedDay.date)).length,
        appointments: selectedDayAllOrders.filter((order) => order.appointmentAt && isSameDashboardDay(order.appointmentAt, selectedDay.date)).length,
        blocked: selectedDayAllOrders.filter((order) => order.operationalStatus !== "ATTIVO").length
      }
    : null;
  const totalBalanceDueCents = invoiceOrders.reduce((sum, order) => sum + order.balanceDueCents, 0);
  const readyOrdersToNotify = readyOrders.filter((order) => !order.readyWhatsappSentAt);
  const readyOrdersNotified = readyOrders.filter((order) => Boolean(order.readyWhatsappSentAt));
  const activeReadyMode = getDashboardReadyMode(readyMode, readyOrdersToNotify.length);
  const currentReadyMode = activeFocus === "READY" ? activeReadyMode : undefined;
  const readyOrdersVisible = activeReadyMode === "NOTIFIED" ? readyOrdersNotified : readyOrdersToNotify;
  const invoiceOrdersSorted = [...invoiceOrders].sort(
    (left, right) => new Date(left.deliveryAt).getTime() - new Date(right.deliveryAt).getTime()
  );
  const financePaidOrders = invoiceOrdersSorted.filter((order) => order.paymentStatus === "PAGATO");
  const financeUnpaidOrders = invoiceOrdersSorted.filter((order) => order.paymentStatus !== "PAGATO");
  const activeFinanceMode = getDashboardFinanceMode(financeMode, financePaidOrders.length, financeUnpaidOrders.length);
  const currentFinanceMode = isFinancePanelOpen ? activeFinanceMode : undefined;
  const activeFinanceSort = getDashboardFinanceSort(financeSort);
  const currentFinanceSort = isFinancePanelOpen && activeFinanceMode === "UNPAID" ? activeFinanceSort : undefined;
  const financeOrdersVisible = getFinanceOrdersVisible(activeFinanceMode, financePaidOrders, financeUnpaidOrders, activeFinanceSort);
  const financeAging = {
    today: financeOrdersVisible.filter((order) => getDashboardDateAgeInDays(order.deliveryAt) === 0).length,
    week: financeOrdersVisible.filter((order) => {
      const age = getDashboardDateAgeInDays(order.deliveryAt);
      return age >= 1 && age <= 7;
    }).length,
    older: financeOrdersVisible.filter((order) => getDashboardDateAgeInDays(order.deliveryAt) > 7).length
  };
  const blockedCustomerOrders = blockedOrders.filter((order) => order.operationalStatus === "IN_ATTESA_APPROVAZIONE");
  const blockedProductionOrders = blockedOrders.filter((order) => order.operationalStatus !== "IN_ATTESA_APPROVAZIONE");
  const stalePaidInvoiceOrders = financePaidOrders.filter((order) => getDashboardDateAgeInDays(order.deliveryAt) > 7);
  const tomorrowDate = getTomorrowDashboardDate();
  const lateStartOrders = toStartOrders.filter((order) => new Date(order.deliveryAt).getTime() < tomorrowDate.getTime());
  const tomorrowToStartOrders = toStartOrders.filter((order) => isTomorrowDashboardDay(order.deliveryAt));
  const tomorrowOrders = getTomorrowDashboardOrders(weekOrders, tomorrowDate);
  const tomorrowOrdersToStart = tomorrowOrders.filter((order) => order.mainPhase === "ACCETTATO");
  const tomorrowOrdersWorking = tomorrowOrders.filter((order) => order.mainPhase !== "ACCETTATO");
  const lateStartOrderIds = new Set(lateStartOrders.map((order) => order.id));
  const stalePaidInvoiceOrderIds = new Set(stalePaidInvoiceOrders.map((order) => order.id));
  const links = {
    today: buildOrdersFilterHref({ preset: "TODAY" }),
    appointments: buildOrdersFilterHref({ preset: "APPOINTMENTS_TODAY" }),
    overdue: buildOrdersFilterHref({ preset: "OVERDUE" }),
    priorityToday: buildOrdersFilterHref({ preset: "PRIORITY_TODAY" }),
    toStart: buildOrdersFilterHref({ preset: "TO_START" }),
    working: buildOrdersFilterHref({ preset: "WORKING" }),
    blocked: buildOrdersFilterHref({ preset: "BLOCKED" }),
    blockedCustomer: buildOrdersFilterHref({ status: "IN_ATTESA_APPROVAZIONE" }),
    blockedProduction: buildOrdersFilterHref({ status: "IN_ATTESA_FILE" }),
    ready: buildOrdersFilterHref({ preset: "READY" }),
    balance: buildOrdersFilterHref({ preset: "FINANCE_UNPAID" }),
    financePaid: buildOrdersFilterHref({ preset: "FINANCE_PAID" }),
    financeUnpaid: buildOrdersFilterHref({ preset: "FINANCE_UNPAID" }),
    tomorrow: buildOrdersFilterHref({ preset: "TOMORROW", sort: "delivery" })
  };
  const dashboardPanelLinks = {
    today: buildDashboardStateHref({
      anchor: "dashboard-calendar",
      pulse: "CALENDAR",
      financeMode: currentFinanceMode,
      financeSort: currentFinanceSort,
      financeOpen: isFinancePanelOpen,
      focus: activeFocus,
      readyMode: currentReadyMode
    }),
    appointments: buildDashboardStateHref({
      anchor: "dashboard-calendar",
      pulse: "CALENDAR",
      financeMode: currentFinanceMode,
      financeSort: currentFinanceSort,
      financeOpen: isFinancePanelOpen,
      focus: activeFocus,
      readyMode: currentReadyMode
    }),
    overdue: buildDashboardStateHref({
      anchor: "dashboard-focus-panel",
      pulse: "PRIORITY",
      financeMode: currentFinanceMode,
      financeSort: currentFinanceSort,
      financeOpen: isFinancePanelOpen,
      focus: "PRIORITY"
    }),
    tomorrow: buildDashboardStateHref({
      anchor: "dashboard-focus-panel",
      pulse: "TOMORROW",
      financeMode: currentFinanceMode,
      financeSort: currentFinanceSort,
      financeOpen: isFinancePanelOpen,
      focus: "TOMORROW"
    }),
    toStart: buildDashboardStateHref({
      anchor: "dashboard-focus-panel",
      pulse: "TO_START",
      financeMode: currentFinanceMode,
      financeSort: currentFinanceSort,
      financeOpen: isFinancePanelOpen,
      focus: "TO_START"
    }),
    working: buildOrdersFilterHref({ preset: "WORKING" }),
    blocked: buildDashboardStateHref({
      anchor: "dashboard-focus-panel",
      pulse: "BLOCKED",
      financeMode: currentFinanceMode,
      financeSort: currentFinanceSort,
      financeOpen: isFinancePanelOpen,
      focus: "BLOCKED"
    }),
    ready: buildDashboardStateHref({
      anchor: "dashboard-focus-panel",
      pulse: "READY",
      financeMode: currentFinanceMode,
      financeSort: currentFinanceSort,
      financeOpen: isFinancePanelOpen,
      focus: "READY",
      readyMode: readyOrdersToNotify.length > 0 ? "TO_NOTIFY" : "NOTIFIED"
    }),
    balance: buildDashboardFinanceHref(
      true,
      activeFocus,
      currentReadyMode,
      currentFinanceMode || (financePaidOrders.length > 0 ? "PAID" : "UNPAID"),
      currentFinanceSort,
      "FINANCE"
    )
  };
  const nextDeliveryDetail = nextDelivery
    ? `${nextDelivery.customer.name} • ${formatDateTime(nextDelivery.deliveryAt)}`
    : "Nessuna scadenza vicina";
  const nextAppointmentDetail = nextAppointment
    ? `${nextAppointment.customer.name} • ${formatDateTime(nextAppointment.appointmentAt || nextAppointment.deliveryAt)}`
    : "Nessun appuntamento oggi";
  const mobileStats = [
    { accent: "overdue", href: dashboardPanelLinks.overdue, label: "Urgenze", value: priorityOrders.length },
    { accent: "agenda", href: dashboardPanelLinks.appointments, label: "Agenda", value: todayAppointments.length },
    { accent: "to-start", href: dashboardPanelLinks.toStart, label: "Avvio", value: toStartOrders.length },
    { accent: "balance", href: dashboardPanelLinks.balance, label: "Fatture", value: invoiceOrders.length }
  ] satisfies Array<{ accent: DashboardAccent; href: string; label: string; value: number }>;

  return (
    <div className="stack dashboard-page-shell">
      <PageHeader
        title="Dashboard"
        action={
          <div className="dashboard-head-actions">
            <Link className="button secondary" href="/customers#customers-new-entry">
              Nuovo cliente
            </Link>
            <details className="dashboard-cta-menu">
              <summary className="button primary">Nuovo documento</summary>
              <div className="dashboard-cta-menu-panel">
                <Link className="dashboard-cta-menu-link" href="/orders/new">
                  <span className="dashboard-cta-menu-eyebrow">Operativo</span>
                  <strong>Nuovo ordine</strong>
                </Link>
                <Link className="dashboard-cta-menu-link" href="/quotes/new">
                  <span className="dashboard-cta-menu-eyebrow">Commerciale</span>
                  <strong>Nuovo preventivo</strong>
                </Link>
              </div>
            </details>
          </div>
        }
      />

      <section className="dashboard-mobile-home">
        <article className="card card-pad dashboard-mobile-today-card">
          <div className="dashboard-mobile-today-head">
            <div className="dashboard-mobile-today-copy">
              <span className="compact-kicker">Home di oggi</span>
            </div>
            <strong className="focus-total dashboard-mobile-today-total">{todayOrders.length + todayAppointments.length}</strong>
          </div>

          <div className="dashboard-mobile-priority-grid">
            <Link className="dashboard-mobile-priority-card compact-card-link" href={links.priorityToday}>
              <span className="dashboard-mobile-priority-label">Prossima consegna</span>
              <strong>{nextDelivery ? nextDelivery.orderCode : "Nessuna"}</strong>
              <span className="hint">{nextDeliveryDetail}</span>
            </Link>
            <Link className="dashboard-mobile-priority-card compact-card-link" href={links.appointments}>
              <span className="dashboard-mobile-priority-label">Primo appuntamento</span>
              <strong>{nextAppointment ? nextAppointment.orderCode : "Nessuno"}</strong>
              <span className="hint">{nextAppointmentDetail}</span>
            </Link>
          </div>

          <div className="dashboard-mobile-stats-rail" aria-label="Contatori rapidi dashboard">
            {mobileStats.map((item) => (
              <DashboardMobileStatChip key={item.label} accent={item.accent} href={item.href} label={item.label} value={item.value} />
            ))}
          </div>
        </article>

        <div className="dashboard-mobile-module-stack">
          <DashboardMobileModuleCard
            accent="working"
            href={buildDashboardStateHref({
              anchor: "dashboard-focus-panel",
              financeMode: currentFinanceMode,
              financeOpen: isFinancePanelOpen,
              focus: "TO_START"
            })}
            icon={<DashboardGlyph kind="tools" />}
            metricsLayout="quad"
            title="Produzione"
            items={[
              { label: "Da avviare", value: toStartOrders.length },
              { label: "In lav.", value: workingOrders.length },
              { label: "Sospesi", value: blockedOrders.length },
              { label: "Pronti", value: readyOrders.length }
            ]}
          />
          <DashboardMobileModuleCard
            accent="agenda"
            href={buildDashboardStateHref({
              anchor: "dashboard-calendar-signals",
              financeMode: currentFinanceMode,
              financeOpen: isFinancePanelOpen,
              focus: activeFocus
            })}
            icon={<DashboardGlyph kind="calendar" />}
            title="Agenda"
            items={[
              { label: "Oggi", value: todayAppointments.length },
              { label: "Settimana", value: weeklyAppointments },
              { label: "Prossima", value: nextAppointment ? nextAppointment.orderCode : "Ness." }
            ]}
          />
          <DashboardMobileModuleCard
            accent="overdue"
            href={buildDashboardStateHref({
              anchor: "dashboard-focus-panel",
              financeMode: currentFinanceMode,
              financeOpen: isFinancePanelOpen,
              focus: "PRIORITY"
            })}
            icon={<DashboardGlyph kind="alert" />}
            title="Attenzione"
            items={[
              { label: "Arretrati", value: overdueOrders.length },
              { label: "Blocchi", value: blockedOrders.length },
              { label: "Fatture", value: invoiceOrders.length }
            ]}
          />
        </div>
      </section>

      <section className="grid dashboard-summary-grid">
        <MiniMetricCard
          accent="overdue"
          href={dashboardPanelLinks.overdue}
          icon={<DashboardGlyph kind="alert" />}
          label="Urgenze"
          pulse="PRIORITY"
          value={priorityOrders.length}
          tone="danger"
        />
        <MiniMetricCard
          accent="agenda"
          href={dashboardPanelLinks.appointments}
          icon={<DashboardGlyph kind="calendar" />}
          label="Appuntamenti"
          pulse="CALENDAR"
          value={todayAppointments.length}
          tone="brand"
        />
        <MiniMetricCard
          accent="to-start"
          href={dashboardPanelLinks.toStart}
          icon={<DashboardGlyph kind="play" />}
          label="Da avviare"
          pulse="TO_START"
          value={toStartOrders.length}
          tone="neutral"
        />
        <MiniMetricCard
          accent="balance"
          href={dashboardPanelLinks.balance}
          icon={<DashboardGlyph kind="cash" />}
          label="Da fatturare"
          pulse="FINANCE"
          value={invoiceOrders.length}
          tone="brand"
        />
      </section>

      {lateStartOrders.length > 0 || tomorrowToStartOrders.length > 0 || stalePaidInvoiceOrders.length > 0 ? (
        <section className="dashboard-alert-strip" aria-label="Attenzioni rapide dashboard">
          {lateStartOrders.length > 0 ? (
            <Link
              className="dashboard-alert-chip dashboard-alert-chip-warning compact-card-link"
              href={buildDashboardStateHref({
                anchor: "dashboard-focus-panel",
                pulse: "LATE_START",
                financeMode: currentFinanceMode,
                financeSort: currentFinanceSort,
                financeOpen: isFinancePanelOpen,
                focus: "TO_START"
              })}
              replace
              scroll={false}
            >
              <span className="dashboard-alert-chip-label">Oggi in ritardo</span>
              <strong>{lateStartOrders.length}</strong>
              <span className="dashboard-alert-chip-detail">
                {lateStartOrders.length === 1 ? "ordine non ancora avviato" : "ordini non ancora avviati"}
              </span>
            </Link>
          ) : null}
          {tomorrowToStartOrders.length > 0 ? (
            <Link className="dashboard-alert-chip compact-card-link" href={dashboardPanelLinks.tomorrow} replace scroll={false}>
              <span className="dashboard-alert-chip-label">Domani da avviare</span>
              <strong>{tomorrowToStartOrders.length}</strong>
              <span className="dashboard-alert-chip-detail">
                {tomorrowToStartOrders.length === 1 ? "ordine non avviato" : "ordini non avviati"}
              </span>
            </Link>
          ) : null}
          {stalePaidInvoiceOrders.length > 0 ? (
            <Link
              className="dashboard-alert-chip dashboard-alert-chip-finance compact-card-link"
              href={buildDashboardFinanceHref(true, activeFocus, currentReadyMode, "PAID", currentFinanceSort, "FINANCE_AGED")}
              replace
              scroll={false}
            >
              <span className="dashboard-alert-chip-label">Pagati non fatturati</span>
              <strong>{stalePaidInvoiceOrders.length}</strong>
              <span className="dashboard-alert-chip-detail">
                {stalePaidInvoiceOrders.length === 1 ? "ordine da oltre 7 giorni" : "ordini da oltre 7 giorni"}
              </span>
            </Link>
          ) : null}
        </section>
      ) : null}

      <section className="dashboard-overview-grid">
        <div className="dashboard-main-column">
          <section
            className={`card card-pad compact-lane-card dashboard-week-card dashboard-week-card-expanded dashboard-soft-slab${pulseClass(activePulse, "CALENDAR")}`}
            id="dashboard-calendar"
          >
            <div className="list-header compact-section-head">
              <div>
                <span className="compact-kicker">Calendario</span>
              </div>
              <Link className="compact-link" href="/calendar?view=week">
                Apri settimana
              </Link>
            </div>
            <div className="dashboard-week-grid">
              {weekLoad.map((day) => (
                <article className={getDashboardWeekDayClassName(day, selectedDay?.key === day.key)} key={day.key}>
                  <Link
                    className="dashboard-week-head-link"
                    href={buildDashboardStateHref({
                      anchor: "dashboard-focus-panel",
                      pulse: "DAY",
                      day: day.key,
                      dayFocus: "ALL",
                      financeMode: currentFinanceMode,
                      financeSort: currentFinanceSort,
                      financeOpen: isFinancePanelOpen,
                      focus: activeFocus,
                      readyMode: currentReadyMode
                    })}
                    replace
                    scroll={false}
                  >
                    <div className="dashboard-week-head">
                      <span className="dashboard-week-label">{day.shortLabel}</span>
                      <strong className="dashboard-week-date">{day.dayLabel}</strong>
                    </div>
                  </Link>
                  <div className="dashboard-week-stats">
                    <Link
                      className={`dashboard-week-stat-link${selectedDay?.key === day.key && activeDayFocus === "WORKLOAD" ? " active" : ""}`}
                      href={buildDashboardStateHref({
                        anchor: "dashboard-focus-panel",
                        pulse: "DAY",
                        day: day.key,
                        dayFocus: "WORKLOAD",
                        financeOpen: isFinancePanelOpen,
                        focus: activeFocus,
                        financeMode: currentFinanceMode,
                        financeSort: currentFinanceSort,
                        readyMode: currentReadyMode
                      })}
                      replace
                      scroll={false}
                    >
                      Lav. {day.workload}
                    </Link>
                    <Link
                      className={`dashboard-week-stat-link${selectedDay?.key === day.key && activeDayFocus === "APPOINTMENTS" ? " active" : ""}`}
                      href={buildDashboardStateHref({
                        anchor: "dashboard-focus-panel",
                        pulse: "DAY",
                        day: day.key,
                        dayFocus: "APPOINTMENTS",
                        financeOpen: isFinancePanelOpen,
                        focus: activeFocus,
                        financeMode: currentFinanceMode,
                        financeSort: currentFinanceSort,
                        readyMode: currentReadyMode
                      })}
                      replace
                      scroll={false}
                    >
                      App. {day.appointments}
                    </Link>
                    {day.blocked > 0 ? <span className="warning">Sosp. {day.blocked}</span> : null}
                    {day.ready > 0 ? <span className="success">Pront. {day.ready}</span> : null}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <div className="compact-signal-list dashboard-priority-grid" id="dashboard-calendar-signals">
            <CompactSignal
              href={links.priorityToday}
              icon={<DashboardGlyph kind="clock" />}
              label="Prossima consegna"
              value={nextDelivery ? nextDelivery.orderCode : "Nessuna"}
              detail={nextDelivery ? `${nextDelivery.customer.name} • ${formatDateTime(nextDelivery.deliveryAt)}` : "Nessuna scadenza vicina"}
            />
            <CompactSignal
              href={links.appointments}
              icon={<DashboardGlyph kind="calendar" />}
              label="Primo appuntamento"
              value={nextAppointment ? nextAppointment.orderCode : "Nessuno"}
              detail={
                nextAppointment
                  ? `${nextAppointment.customer.name} • ${formatDateTime(nextAppointment.appointmentAt || nextAppointment.deliveryAt)}`
                  : "Nessun appuntamento oggi"
              }
            />
          </div>

          <section
            className={`card card-pad dashboard-finance-shell dashboard-soft-slab${pulseClass(activePulse, "FINANCE", "FINANCE_AGED")}`}
            id="dashboard-operativa"
          >
            <div className="list-header compact-section-head">
              <div>
                <span className="compact-kicker">Da fatturare</span>
              </div>
              <Link
                className="compact-link"
                href={
                  isFinancePanelOpen
                    ? buildDashboardFinanceHref(false, activeFocus, currentReadyMode)
                    : buildDashboardFinanceHref(
                        true,
                        activeFocus,
                        currentReadyMode,
                        currentFinanceMode || activeFinanceMode,
                        currentFinanceSort
                      )
                }
                replace
                scroll={false}
              >
                {isFinancePanelOpen ? "Chiudi lista" : "Apri lista ordini"}
              </Link>
            </div>

            <Link
              className="dashboard-finance-summary compact-card-link"
              href={buildDashboardFinanceHref(
                true,
                activeFocus,
                currentReadyMode,
                currentFinanceMode || activeFinanceMode,
                currentFinanceSort,
                "FINANCE"
              )}
              replace
              scroll={false}
            >
              <div className="dashboard-finance-summary-copy">
                <strong>{formatCurrency(totalBalanceDueCents)}</strong>
                <span className="subtle">{invoiceOrders.length} ordini ancora da fatturare</span>
              </div>
              <span className="dashboard-finance-summary-action">{isFinancePanelOpen ? "Lista aperta" : "Apri il pannello"}</span>
            </Link>

            <div className="dashboard-finance-mode-row" aria-label="Filtro pagamenti da fatturare">
              <Link
                className={`dashboard-finance-mode-pill compact-card-link${activeFinanceMode === "PAID" ? " active" : ""}`}
                href={buildDashboardFinanceHref(true, activeFocus, currentReadyMode, "PAID", undefined, "FINANCE")}
                replace
                scroll={false}
              >
                <span>Pagati da fatturare</span>
                <strong>{financePaidOrders.length}</strong>
              </Link>
              <Link
                className={`dashboard-finance-mode-pill compact-card-link${activeFinanceMode === "UNPAID" ? " active" : ""}`}
                href={buildDashboardFinanceHref(true, activeFocus, currentReadyMode, "UNPAID", currentFinanceSort, "FINANCE")}
                replace
                scroll={false}
              >
                <span>Da incassare</span>
                <strong>{financeUnpaidOrders.length}</strong>
              </Link>
            </div>

            {activeFinanceMode === "UNPAID" ? (
              <div className="dashboard-finance-sort-row" aria-label="Ordinamento da incassare">
                <Link
                  className={`dashboard-finance-sort-pill compact-card-link${activeFinanceSort === "AGE" ? " active" : ""}`}
                  href={buildDashboardFinanceHref(true, activeFocus, currentReadyMode, "UNPAID", "AGE", "FINANCE")}
                  replace
                  scroll={false}
                >
                  Anzianita
                </Link>
                <Link
                  className={`dashboard-finance-sort-pill compact-card-link${activeFinanceSort === "AMOUNT" ? " active" : ""}`}
                  href={buildDashboardFinanceHref(true, activeFocus, currentReadyMode, "UNPAID", "AMOUNT", "FINANCE")}
                  replace
                  scroll={false}
                >
                  Importo
                </Link>
              </div>
            ) : null}

            <div className="dashboard-finance-aging-row" aria-label="Anzianita ordini da fatturare">
              <span className="dashboard-finance-aging-pill">
                <span>Oggi</span>
                <strong>{financeAging.today}</strong>
              </span>
              <span className="dashboard-finance-aging-pill">
                <span>1-7g</span>
                <strong>{financeAging.week}</strong>
              </span>
              <span className="dashboard-finance-aging-pill dashboard-finance-aging-pill-alert">
                <span>8g+</span>
                <strong>{financeAging.older}</strong>
              </span>
            </div>

            {isFinancePanelOpen ? (
              <DashboardLane
                className={`dashboard-finance-lane${pulseClass(activePulse, "FINANCE", "FINANCE_AGED")}`}
                density="dense"
                emptyMessage={
                  activeFinanceMode === "PAID"
                    ? "Nessun ordine pagato ancora da fatturare."
                    : "Nessun ordine da incassare prima della fattura."
                }
                orders={financeOrdersVisible}
                title={activeFinanceMode === "PAID" ? "Pagati da fatturare" : "Da incassare e fatturare"}
                visibleLimit={6}
                viewHref={activeFinanceMode === "PAID" ? links.financePaid : links.financeUnpaid}
                viewLabel="Apri lista completa"
                itemClassName={(order) => {
                  const classNames: string[] = [];

                  if (activeFinanceMode !== "UNPAID") {
                    if (activePulse === "FINANCE_AGED" && stalePaidInvoiceOrderIds.has(order.id)) {
                      classNames.push("dashboard-pulse-item");
                    }

                    return classNames.join(" ") || undefined;
                  }

                  if (order.balanceDueCents >= 100000) {
                    classNames.push("finance-critical-balance");
                  } else if (order.balanceDueCents >= 50000) {
                    classNames.push("finance-high-balance");
                  }

                  if (activePulse === "FINANCE_AGED" && stalePaidInvoiceOrderIds.has(order.id)) {
                    classNames.push("dashboard-pulse-item");
                  }

                  return classNames.join(" ") || undefined;
                }}
                renderMeta={(order) =>
                  `${getInvoiceAgeLabel(order.deliveryAt)}${order.balanceDueCents > 0 ? ` • Residuo ${formatCurrency(order.balanceDueCents)}` : ""}`
                }
                renderAside={(order) => formatCurrency(order.totalCents)}
                renderNote={(order) => `Pagamento ${paymentStatusLabels[order.paymentStatus]} • Fattura da emettere`}
              />
            ) : null}
          </section>
        </div>

        <aside
          className={`card card-pad dashboard-focus-panel dashboard-soft-slab${pulseClass(activePulse, "PRIORITY", "TO_START", "LATE_START", "BLOCKED", "READY", "TOMORROW", "DAY")}`}
          aria-label="Priorita e produzione"
          id="dashboard-focus-panel"
        >
          {selectedDay ? (
            <>
              <div className="dashboard-day-focus-head">
                <div>
                  <span className="compact-kicker">Giorno selezionato</span>
                  <h3>{`${formatWeekdayLabel(selectedDay.date)} ${formatCompactDate(selectedDay.date)}`}</h3>
                </div>
                <Link
                  className="compact-link"
                  href={buildDashboardStateHref({
                    anchor: "dashboard-focus-panel",
                    pulse: "DAY",
                    financeMode: currentFinanceMode,
                    financeSort: currentFinanceSort,
                    financeOpen: isFinancePanelOpen,
                    focus: activeFocus,
                    readyMode: currentReadyMode
                  })}
                  replace
                  scroll={false}
                >
                  Torna al focus
                </Link>
              </div>

              <div className="dashboard-side-pill-row">
                <Link
                  className={`dashboard-side-pill compact-card-link${activeDayFocus === "WORKLOAD" ? " active" : ""}`}
                  href={buildDashboardStateHref({
                    anchor: "dashboard-focus-panel",
                    pulse: "DAY",
                    day: selectedDay.key,
                    dayFocus: "WORKLOAD",
                    financeMode: currentFinanceMode,
                    financeSort: currentFinanceSort,
                    financeOpen: isFinancePanelOpen,
                    focus: activeFocus,
                    readyMode: currentReadyMode
                  })}
                  replace
                  scroll={false}
                >
                  <span>Lavori</span>
                  <strong>{selectedDayStats?.workload || 0}</strong>
                </Link>
                <Link
                  className={`dashboard-side-pill compact-card-link${activeDayFocus === "APPOINTMENTS" ? " active" : ""}`}
                  href={buildDashboardStateHref({
                    anchor: "dashboard-focus-panel",
                    pulse: "DAY",
                    day: selectedDay.key,
                    dayFocus: "APPOINTMENTS",
                    financeMode: currentFinanceMode,
                    financeSort: currentFinanceSort,
                    financeOpen: isFinancePanelOpen,
                    focus: activeFocus,
                    readyMode: currentReadyMode
                  })}
                  replace
                  scroll={false}
                >
                  <span>Appuntamenti</span>
                  <strong>{selectedDayStats?.appointments || 0}</strong>
                </Link>
              </div>

              <DashboardLane
                className={`dashboard-side-lane${pulseClass(activePulse, "DAY")}`}
                density="dense"
                emptyMessage={getDashboardDayFocusEmptyMessage(activeDayFocus)}
                orders={selectedDayOrders}
                title={getDashboardDayFocusTitle(activeDayFocus)}
                viewHref={`/calendar?view=day&date=${selectedDay.key}`}
                viewLabel="Apri giornata"
                renderMeta={(order) => getDashboardDayOrderMeta(order, selectedDay.date)}
                renderNote={(order) =>
                  order.appointmentNote ||
                  order.notes ||
                  (order.appointmentAt && isSameDashboardDay(order.appointmentAt, selectedDay.date)
                    ? "Ordine con appuntamento programmato"
                    : null)
                }
                renderAside={(order) => formatCurrency(order.totalCents)}
                id="dashboard-day-list"
              />
            </>
          ) : (
            <>
              <nav className="dashboard-focus-switch" aria-label="Selettore focus operativo">
                <Link
                  className={`dashboard-focus-switch-link${activeFocus === "PRIORITY" ? " active" : ""}`}
                  href={buildDashboardStateHref({
                    anchor: "dashboard-focus-panel",
                    pulse: "PRIORITY",
                    financeMode: currentFinanceMode,
                    financeSort: currentFinanceSort,
                    financeOpen: isFinancePanelOpen,
                    focus: "PRIORITY"
                  })}
                  replace
                  scroll={false}
                >
                  Priorita
                </Link>
                <Link
                  className={`dashboard-focus-switch-link${activeFocus === "TOMORROW" ? " active" : ""}`}
                  href={buildDashboardStateHref({
                    anchor: "dashboard-focus-panel",
                    pulse: "TOMORROW",
                    financeMode: currentFinanceMode,
                    financeSort: currentFinanceSort,
                    financeOpen: isFinancePanelOpen,
                    focus: "TOMORROW"
                  })}
                  replace
                  scroll={false}
                >
                  Domani
                </Link>
                <Link
                  className={`dashboard-focus-switch-link${activeFocus === "TO_START" ? " active" : ""}`}
                  href={buildDashboardStateHref({
                    anchor: "dashboard-focus-panel",
                    pulse: "TO_START",
                    financeMode: currentFinanceMode,
                    financeSort: currentFinanceSort,
                    financeOpen: isFinancePanelOpen,
                    focus: "TO_START"
                  })}
                  replace
                  scroll={false}
                >
                  Avvio
                </Link>
                <Link
                  className={`dashboard-focus-switch-link${activeFocus === "BLOCKED" ? " active" : ""}`}
                  href={buildDashboardStateHref({
                    anchor: "dashboard-focus-panel",
                    pulse: "BLOCKED",
                    financeMode: currentFinanceMode,
                    financeSort: currentFinanceSort,
                    financeOpen: isFinancePanelOpen,
                    focus: "BLOCKED"
                  })}
                  replace
                  scroll={false}
                >
                  Sblocca
                </Link>
                <Link
                  className={`dashboard-focus-switch-link${activeFocus === "READY" ? " active" : ""}`}
                  href={buildDashboardStateHref({
                    anchor: "dashboard-focus-panel",
                    pulse: "READY",
                    financeMode: currentFinanceMode,
                    financeSort: currentFinanceSort,
                    financeOpen: isFinancePanelOpen,
                    focus: "READY",
                    readyMode: currentReadyMode || (readyOrdersToNotify.length > 0 ? "TO_NOTIFY" : "NOTIFIED")
                  })}
                  replace
                  scroll={false}
                >
                  Pronti
                </Link>
              </nav>

              <div className="dashboard-side-pill-row" id="dashboard-production-meta">
                {activeFocus === "BLOCKED" ? (
                  <>
                    <Link className="dashboard-side-pill compact-card-link" href={links.blockedCustomer}>
                      <span>Attesa cliente</span>
                      <strong>{blockedCustomerOrders.length}</strong>
                    </Link>
                    <Link className="dashboard-side-pill compact-card-link" href={links.blockedProduction}>
                      <span>Attesa produzione</span>
                      <strong>{blockedProductionOrders.length}</strong>
                    </Link>
                  </>
                ) : activeFocus === "READY" ? (
                  <>
                    <Link
                      className={`dashboard-side-pill dashboard-side-pill-alert compact-card-link${activeReadyMode === "TO_NOTIFY" ? " active" : ""}`}
                      href={buildDashboardStateHref({
                        anchor: "dashboard-focus-panel",
                        pulse: "READY",
                        financeOpen: isFinancePanelOpen,
                        financeMode: currentFinanceMode,
                        financeSort: currentFinanceSort,
                        focus: "READY",
                        readyMode: "TO_NOTIFY"
                      })}
                      replace
                      scroll={false}
                    >
                      <span>Da avvisare</span>
                      <strong>{readyOrdersToNotify.length}</strong>
                    </Link>
                    <Link
                      className={`dashboard-side-pill compact-card-link${activeReadyMode === "NOTIFIED" ? " active" : ""}`}
                      href={buildDashboardStateHref({
                        anchor: "dashboard-focus-panel",
                        pulse: "READY",
                        financeOpen: isFinancePanelOpen,
                        financeMode: currentFinanceMode,
                        financeSort: currentFinanceSort,
                        focus: "READY",
                        readyMode: "NOTIFIED"
                      })}
                      replace
                      scroll={false}
                    >
                      <span>Gia avvisati</span>
                      <strong>{readyOrdersNotified.length}</strong>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      className="dashboard-side-pill compact-card-link"
                      href={buildDashboardStateHref({
                        anchor: "dashboard-focus-panel",
                        pulse: "BLOCKED",
                        financeMode: currentFinanceMode,
                        financeOpen: isFinancePanelOpen,
                        focus: "BLOCKED"
                      })}
                    >
                      <span>Sospesi</span>
                      <strong>{blockedOrders.length}</strong>
                    </Link>
                    <Link className="dashboard-side-pill compact-card-link" href={dashboardPanelLinks.ready} replace scroll={false}>
                      <span>Pronti</span>
                      <strong>{readyOrders.length}</strong>
                    </Link>
                  </>
                )}
              </div>

              {activeFocus === "PRIORITY" ? (
                <DashboardLane
                  className={`dashboard-side-lane${pulseClass(activePulse, "PRIORITY")}`}
                  density="dense"
                  emptyMessage="Nessuna priorita in lavorazione con scadenza oggi o domani."
                  orders={priorityOrders}
                  title="Priorita oggi"
                  viewHref={links.priorityToday}
                  viewLabel="Apri lista"
                  renderMeta={(order) => `Consegna ${formatDateTime(order.deliveryAt)}`}
                  renderNote={(order) => order.appointmentNote || order.notes || null}
                  renderAside={(order) => formatCurrency(order.totalCents)}
                  id="dashboard-priority-list"
                />
              ) : null}

              {activeFocus === "TO_START" ? (
                <DashboardLane
                  className={`dashboard-side-lane${pulseClass(activePulse, "TO_START", "LATE_START")}`}
                  density="dense"
                  emptyMessage="Niente in attesa di avvio."
                  orders={toStartOrders}
                  title="Da avviare"
                  viewHref={links.toStart}
                  viewLabel="Apri lista"
                  renderMeta={(order) => `Consegna ${formatDateTime(order.deliveryAt)}`}
                  itemClassName={(order) => (activePulse === "LATE_START" && lateStartOrderIds.has(order.id) ? "dashboard-pulse-item" : undefined)}
                  id="dashboard-production-start"
                />
              ) : null}

              {activeFocus === "TOMORROW" ? (
                <>
                  <div className="dashboard-side-pill-row">
                    <span className="dashboard-side-pill">
                      <span>Da avviare</span>
                      <strong>{tomorrowOrdersToStart.length}</strong>
                    </span>
                    <span className="dashboard-side-pill">
                      <span>Gia in lavorazione</span>
                      <strong>{tomorrowOrdersWorking.length}</strong>
                    </span>
                  </div>

                  <DashboardLane
                    className={`dashboard-side-lane${pulseClass(activePulse, "TOMORROW")}`}
                    density="dense"
                    emptyMessage="Nessuna consegna prevista per domani."
                    orders={tomorrowOrders}
                    title="Consegne di domani"
                    viewHref={links.tomorrow}
                    viewLabel="Apri lista"
                    renderMeta={(order) => `Consegna ${formatDateTime(order.deliveryAt)}`}
                    renderNote={(order) => order.appointmentNote || order.notes || null}
                    renderAside={(order) => formatCurrency(order.totalCents)}
                    id="dashboard-tomorrow-list"
                  />
                </>
              ) : null}

              {activeFocus === "BLOCKED" ? (
                <div className={`dashboard-blocked-grid${pulseClass(activePulse, "BLOCKED")}`} id="dashboard-production-blocked">
                  <DashboardLane
                    className="dashboard-side-lane"
                    density="dense"
                    emptyMessage="Nessun ordine in attesa cliente."
                    orders={blockedCustomerOrders}
                    title="Attesa cliente"
                    viewHref={links.blockedCustomer}
                    viewLabel="Apri lista"
                    renderMeta={(order) => `${operationalStatusLabels[order.operationalStatus]} • Consegna ${formatDateTime(order.deliveryAt)}`}
                    renderNote={(order) => order.operationalNote || order.appointmentNote || order.notes || "In attesa di conferma o approvazione"}
                  />
                  <DashboardLane
                    className="dashboard-side-lane"
                    density="dense"
                    emptyMessage="Nessun ordine in attesa produzione."
                    orders={blockedProductionOrders}
                    title="Attesa produzione"
                    viewHref={links.blockedProduction}
                    viewLabel="Apri lista"
                    renderMeta={(order) => `${operationalStatusLabels[order.operationalStatus]} • Consegna ${formatDateTime(order.deliveryAt)}`}
                    renderNote={(order) => order.operationalNote || order.notes || "Da sbloccare internamente prima della consegna"}
                  />
                </div>
              ) : null}

              {activeFocus === "READY" ? (
                <DashboardLane
                  className={`dashboard-side-lane${pulseClass(activePulse, "READY")}`}
                  density="dense"
                  emptyMessage={
                    activeReadyMode === "TO_NOTIFY" ? "Nessun ordine pronto ancora da avvisare." : "Nessun ordine gia avvisato in questo momento."
                  }
                  orders={readyOrdersVisible}
                  title={activeReadyMode === "TO_NOTIFY" ? "Pronti da avvisare" : "Pronti gia avvisati"}
                  viewHref={links.ready}
                  viewLabel="Apri lista"
                  renderMeta={(order) =>
                    `${order.readyWhatsappSentAt ? "Avvisato" : "Da avvisare"} • Consegna ${formatDateTime(order.deliveryAt)}`
                  }
                  renderNote={(order) =>
                    order.readyWhatsappSentAt
                      ? `Cliente avvisato il ${formatDateTime(order.readyWhatsappSentAt)}`
                      : order.operationalNote || order.notes || "Da contattare prima della consegna"
                  }
                  renderAside={(order) => formatCurrency(order.totalCents)}
                  id="dashboard-production-ready"
                />
              ) : null}
            </>
          )}
        </aside>
      </section>
    </div>
  );
}

function DashboardLane({
  title,
  id,
  className,
  orders,
  emptyMessage,
  viewHref,
  viewLabel,
  renderMeta,
  renderNote,
  renderAside,
  density = "default",
  visibleLimit,
  itemClassName
}: {
  title: string;
  id?: string;
  className?: string;
  orders: DashboardOrder[];
  emptyMessage: string;
  viewHref?: string;
  viewLabel?: string;
  renderMeta: (order: DashboardOrder) => string;
  renderNote?: (order: DashboardOrder) => string | null | undefined;
  renderAside?: (order: DashboardOrder) => string | undefined;
  density?: "default" | "dense";
  visibleLimit?: number;
  itemClassName?: (order: DashboardOrder) => string | undefined;
}) {
  const resolvedVisibleLimit = visibleLimit ?? (density === "dense" ? 4 : 6);
  const visibleOrders = orders.slice(0, resolvedVisibleLimit);
  const hasHiddenOrders = orders.length > resolvedVisibleLimit;

  return (
    <article className={`card card-pad compact-lane-card${className ? ` ${className}` : ""}`} id={id}>
      <div className="list-header compact-section-head">
        <div>
          <h3>{title}</h3>
        </div>
        {viewHref && viewLabel ? (
          <Link className="compact-link" href={viewHref}>
            {viewLabel}
          </Link>
        ) : null}
      </div>
      <div className="compact-order-list">
        {orders.length === 0 ? (
          <div className="empty">{emptyMessage}</div>
        ) : (
          <>
            <div className={`compact-order-grid${density === "dense" ? " compact-order-grid-dense" : ""}`}>
              {visibleOrders.map((order) => (
                <CompactOrderItem
                  key={order.id}
                  hasWhatsapp={Boolean((order.customer.whatsapp || order.customer.phone || "").replace(/[^\d+]/g, ""))}
                  orderId={order.id}
                  href={`/orders/${order.id}`}
                  code={order.orderCode}
                  deliveryAt={order.deliveryAt}
                  readyWhatsappSentAt={order.readyWhatsappSentAt}
                  title={order.customer.name}
                  meta={renderMeta(order)}
                  aside={renderAside?.(order)}
                  tone={getOrderTone(order.deliveryAt, order.mainPhase, order.paymentStatus)}
                  phase={order.mainPhase}
                  density={density}
                  extraClassName={itemClassName?.(order)}
                  pills={
                    <StatusPills
                      hideNeutralStatus
                      linked={false}
                      phase={order.mainPhase}
                      payment={order.paymentStatus}
                      status={order.operationalStatus}
                    />
                  }
                  status={order.operationalStatus}
                  note={renderNote?.(order)}
                />
              ))}
            </div>
            {hasHiddenOrders && viewHref ? (
              <Link
                aria-label={`Apri la lista completa di ${title.toLowerCase()}`}
                className="compact-order-overflow-link"
                href={viewHref}
                title={`Vedi gli altri ${orders.length - resolvedVisibleLimit} ordini`}
              >
                ...
              </Link>
            ) : null}
          </>
        )}
      </div>
    </article>
  );
}

function MiniMetricCard({
  accent,
  href,
  icon,
  label,
  pulse,
  value,
  tone
}: {
  accent: DashboardAccent;
  href: string;
  icon: ReactNode;
  label: string;
  pulse?: DashboardPulse;
  value: number;
  tone: "neutral" | "danger" | "warning" | "success" | "brand";
}) {
  return (
    <Link
      className={`card card-pad compact-metric compact-metric-${tone} compact-metric-dashboard compact-accent-${accent} compact-card-link`}
      data-dashboard-pulse={pulse}
      href={href}
    >
      <span className="compact-icon">{icon}</span>
      <div className="compact-metric-copy">
        <span className="compact-metric-label">{label}</span>
      </div>
      <div className="compact-metric-foot">
        <strong>{value}</strong>
      </div>
    </Link>
  );
}

function DashboardMobileStatChip({
  accent,
  href,
  label,
  value
}: {
  accent: DashboardAccent;
  href: string;
  label: string;
  value: number;
}) {
  return (
    <Link className={`dashboard-mobile-stat-chip compact-card-link compact-accent-${accent}`} href={href}>
      <span>{label}</span>
      <strong>{value}</strong>
    </Link>
  );
}

function DashboardMobileModuleCard({
  accent,
  href,
  icon,
  title,
  items,
  metricsLayout = "auto"
}: {
  accent: DashboardAccent;
  href: string;
  icon: ReactNode;
  title: string;
  items: Array<{ label: string; value: string | number }>;
  metricsLayout?: "auto" | "quad";
}) {
  return (
    <Link className={`card card-pad dashboard-mobile-module compact-card-link compact-accent-${accent}`} href={href}>
      <div className="dashboard-mobile-module-head">
        <span className="compact-icon">{icon}</span>
        <div className="dashboard-mobile-module-copy">
          <strong>{title}</strong>
        </div>
      </div>
      <div className={`dashboard-mobile-module-metrics${metricsLayout === "quad" ? " dashboard-mobile-module-metrics-quad" : ""}`}>
        {items.map((item) => (
          <span className="dashboard-mobile-module-pill" key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </span>
        ))}
      </div>
    </Link>
  );
}

function CompactSignal({
  href,
  icon,
  label,
  value,
  detail
}: {
  href: string;
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Link className="compact-signal compact-card-link" href={href}>
      <span className="compact-icon compact-icon-soft">{icon}</span>
      <div className="compact-signal-copy">
        <span className="subtle">{label}</span>
        <strong>{value}</strong>
        <span className="hint">{detail}</span>
      </div>
    </Link>
  );
}

function CompactOrderItem({
  hasWhatsapp,
  orderId,
  href,
  code,
  deliveryAt,
  readyWhatsappSentAt,
  title,
  meta,
  aside,
  tone,
  phase,
  density = "default",
  extraClassName,
  status,
  pills,
  note
}: {
  hasWhatsapp: boolean;
  orderId: string;
  href: string;
  code: string;
  deliveryAt: Date | string;
  readyWhatsappSentAt?: Date | string | null;
  title: string;
  meta: string;
  aside?: string;
  tone: "neutral" | "danger" | "warning" | "success";
  phase: MainPhase;
  density?: "default" | "dense";
  extraClassName?: string;
  status: import("@prisma/client").OperationalStatus;
  pills: ReactNode;
  note?: string | null;
}) {
  const workdayHighlight = getWorkdayHighlight(deliveryAt);
  const whatsappNotified = phase === "SVILUPPO_COMPLETATO" && Boolean(readyWhatsappSentAt);
  const needsWhatsapp = phase === "SVILUPPO_COMPLETATO" && !readyWhatsappSentAt;

  return (
    <article
      className={`compact-order-item compact-order-item-dashboard compact-order-item-${density} compact-order-item-${tone} workday-highlight-card${workdayHighlight ? ` ${workdayHighlight}` : ""}${whatsappNotified ? " whatsapp-notified" : ""}${needsWhatsapp ? " needs-whatsapp" : ""}${extraClassName ? ` ${extraClassName}` : ""}`}
    >
      <div className="compact-order-main">
        <div className="compact-order-head">
          <QuickOrderControls
            align="start"
            hasWhatsapp={hasWhatsapp}
            mode="inline"
            orderId={orderId}
            phase={phase}
            readyWhatsappSentAt={readyWhatsappSentAt}
            status={status}
          />
          <Link className="order-code" href={href}>
            {code}
          </Link>
          {aside ? <span className="compact-order-aside">{aside}</span> : null}
        </div>
        <div className="subtle compact-order-customer">{title}</div>
        <div className="hint compact-order-meta">{meta}</div>
        {whatsappNotified ? <div className="hint order-whatsapp-status">Cliente avvisato via WhatsApp</div> : null}
        {needsWhatsapp ? <div className="hint order-whatsapp-status order-whatsapp-status-pending">Cliente da avvisare</div> : null}
        {note ? <div className="hint">{note}</div> : null}
      </div>
      {pills}
    </article>
  );
}

function mergeUniqueOrders(...lists: DashboardOrder[][]) {
  const unique = new Map<string, DashboardOrder>();

  for (const list of lists) {
    for (const order of list) {
      if (!unique.has(order.id)) {
        unique.set(order.id, order);
      }
    }
  }

  return [...unique.values()];
}

function getSoonestDeliveryOrder(orders: DashboardOrder[]) {
  return [...orders].sort((left, right) => new Date(left.deliveryAt).getTime() - new Date(right.deliveryAt).getTime())[0];
}

function getSelectedDashboardDay(weekLoad: DashboardWeekDayLoad[], dayKey?: string) {
  if (!dayKey) {
    return null;
  }

  return weekLoad.find((day) => day.key === dayKey) || null;
}

function getOrdersForDashboardDay(orders: DashboardOrder[], date: Date) {
  return orders
    .filter((order) => isSameDashboardDay(order.deliveryAt, date) || (order.appointmentAt ? isSameDashboardDay(order.appointmentAt, date) : false))
    .sort((left, right) => {
      const leftTime = new Date(left.appointmentAt || left.deliveryAt).getTime();
      const rightTime = new Date(right.appointmentAt || right.deliveryAt).getTime();
      return leftTime - rightTime;
    });
}

function filterDashboardDayOrders(orders: DashboardOrder[], date: Date, focus: DashboardDayFocus) {
  if (focus === "WORKLOAD") {
    return orders.filter((order) => isSameDashboardDay(order.deliveryAt, date));
  }

  if (focus === "APPOINTMENTS") {
    return orders.filter((order) => order.appointmentAt && isSameDashboardDay(order.appointmentAt, date));
  }

  return orders;
}

function isSameDashboardDay(value: Date | string, target: Date) {
  return formatDateKey(new Date(value)) === formatDateKey(target);
}

function getDashboardDayOrderMeta(order: DashboardOrder, selectedDate: Date) {
  const chunks: string[] = [];

  if (order.appointmentAt && isSameDashboardDay(order.appointmentAt, selectedDate)) {
    chunks.push(`Appuntamento ${formatDateTime(order.appointmentAt)}`);
  }

  if (isSameDashboardDay(order.deliveryAt, selectedDate)) {
    chunks.push(`Consegna ${formatDateTime(order.deliveryAt)}`);
  }

  return chunks.join(" • ") || `Consegna ${formatDateTime(order.deliveryAt)}`;
}

function parseDashboardPanel(raw?: string): DashboardPanel {
  if (raw === "production") {
    return "PRODUCTION";
  }

  if (raw === "appointments") {
    return "APPOINTMENTS";
  }

  if (raw === "finance") {
    return "FINANCE";
  }

  return "PRIORITY";
}

function parseDashboardFocus(raw?: string): DashboardFocus {
  if (raw === "start") {
    return "TO_START";
  }

  if (raw === "blocked") {
    return "BLOCKED";
  }

  if (raw === "ready") {
    return "READY";
  }

  if (raw === "tomorrow") {
    return "TOMORROW";
  }

  return "PRIORITY";
}

function parseDashboardDayFocus(raw?: string): DashboardDayFocus {
  if (raw === "workload") {
    return "WORKLOAD";
  }

  if (raw === "appointments") {
    return "APPOINTMENTS";
  }

  return "ALL";
}

function parseDashboardReadyMode(raw?: string): DashboardReadyMode | null {
  if (raw === "notified") {
    return "NOTIFIED";
  }

  if (raw === "to-notify") {
    return "TO_NOTIFY";
  }

  return null;
}

function getDashboardReadyMode(raw: string | undefined, toNotifyCount: number): DashboardReadyMode {
  const parsed = parseDashboardReadyMode(raw);

  if (parsed) {
    return parsed;
  }

  return toNotifyCount > 0 ? "TO_NOTIFY" : "NOTIFIED";
}

function parseDashboardFinanceMode(raw?: string): DashboardFinanceMode | null {
  if (raw === "paid") {
    return "PAID";
  }

  if (raw === "unpaid") {
    return "UNPAID";
  }

  return null;
}

function getDashboardFinanceMode(raw: string | undefined, paidCount: number, unpaidCount: number): DashboardFinanceMode {
  const parsed = parseDashboardFinanceMode(raw);

  if (parsed) {
    return parsed;
  }

  if (paidCount > 0) {
    return "PAID";
  }

  if (unpaidCount > 0) {
    return "UNPAID";
  }

  return "PAID";
}

function parseDashboardFinanceSort(raw?: string): DashboardFinanceSort | null {
  if (raw === "amount") {
    return "AMOUNT";
  }

  if (raw === "age") {
    return "AGE";
  }

  return null;
}

function getDashboardFinanceSort(raw?: string): DashboardFinanceSort {
  return parseDashboardFinanceSort(raw) || "AGE";
}

function getFinanceOrdersVisible(
  mode: DashboardFinanceMode,
  paidOrders: DashboardOrder[],
  unpaidOrders: DashboardOrder[],
  sort: DashboardFinanceSort
) {
  if (mode === "PAID") {
    return paidOrders;
  }

  const orders = [...unpaidOrders];

  if (sort === "AMOUNT") {
    return orders.sort((left, right) => right.balanceDueCents - left.balanceDueCents);
  }

  return orders.sort((left, right) => new Date(left.deliveryAt).getTime() - new Date(right.deliveryAt).getTime());
}

function buildDashboardPanelHref(panel: DashboardPanel) {
  switch (panel) {
    case "PRODUCTION":
      return "/?panel=production";
    case "APPOINTMENTS":
      return "/?panel=appointments";
    case "FINANCE":
      return "/?panel=finance";
    default:
      return "/";
  }
}

function buildDashboardStateHref({
  anchor,
  day,
  dayFocus = "ALL",
  financeMode,
  financeSort,
  financeOpen = false,
  focus = "PRIORITY",
  readyMode,
  pulse
}: {
  anchor?: string;
  day?: string;
  dayFocus?: DashboardDayFocus;
  financeMode?: DashboardFinanceMode;
  financeSort?: DashboardFinanceSort;
  financeOpen?: boolean;
  focus?: DashboardFocus;
  readyMode?: DashboardReadyMode;
  pulse?: DashboardPulse;
}) {
  const params = new URLSearchParams();

  if (financeOpen) {
    params.set("panel", "finance");

    if (financeMode === "PAID") {
      params.set("financeMode", "paid");
    } else if (financeMode === "UNPAID") {
      params.set("financeMode", "unpaid");
    }

    if (financeSort === "AMOUNT") {
      params.set("financeSort", "amount");
    } else if (financeSort === "AGE") {
      params.set("financeSort", "age");
    }
  }

  if (focus === "TO_START") {
    params.set("focus", "start");
  } else if (focus === "BLOCKED") {
    params.set("focus", "blocked");
  } else if (focus === "READY") {
    params.set("focus", "ready");

    if (readyMode === "NOTIFIED") {
      params.set("readyMode", "notified");
    } else if (readyMode === "TO_NOTIFY") {
      params.set("readyMode", "to-notify");
    }
  } else if (focus === "TOMORROW") {
    params.set("focus", "tomorrow");
  }

  if (day) {
    params.set("day", day);

    if (dayFocus === "WORKLOAD") {
      params.set("dayFocus", "workload");
    } else if (dayFocus === "APPOINTMENTS") {
      params.set("dayFocus", "appointments");
    }
  }

  if (pulse) {
    params.set("pulse", pulse.toLowerCase().replace(/_/g, "-"));
  }

  const query = params.toString();
  return `/${query ? `?${query}` : ""}${anchor ? `#${anchor}` : ""}`;
}

function getDashboardDayFocusTitle(focus: DashboardDayFocus) {
  if (focus === "WORKLOAD") {
    return "Lavori del giorno";
  }

  if (focus === "APPOINTMENTS") {
    return "Appuntamenti del giorno";
  }

  return "Ordini del giorno";
}

function getDashboardDayFocusEmptyMessage(focus: DashboardDayFocus) {
  if (focus === "WORKLOAD") {
    return "Nessun lavoro programmato per questo giorno.";
  }

  if (focus === "APPOINTMENTS") {
    return "Nessun appuntamento per questo giorno.";
  }

  return "Nessun ordine o appuntamento per questo giorno.";
}

function getInvoiceAgeLabel(value: Date | string) {
  const age = getDashboardDateAgeInDays(value);

  if (age === 0) {
    return "Da fatturare oggi";
  }

  if (age === 1) {
    return "Da fatturare da 1 giorno";
  }

  return `Da fatturare da ${age} giorni`;
}

function getDashboardDateAgeInDays(value: Date | string, reference = new Date()) {
  const target = startOfDashboardDay(new Date(value)).getTime();
  const base = startOfDashboardDay(reference).getTime();
  return Math.max(0, Math.floor((base - target) / 86400000));
}

function startOfDashboardDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isTomorrowDashboardDay(value: Date | string) {
  return isSameDashboardDay(value, getTomorrowDashboardDate());
}

function getTomorrowDashboardDate() {
  const tomorrow = startOfDashboardDay(new Date());
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
}

function getTomorrowDashboardOrders(orders: DashboardOrder[], tomorrowDate: Date) {
  return orders
    .filter((order) => isSameDashboardDay(order.deliveryAt, tomorrowDate))
    .sort((left, right) => {
      const leftTime = new Date(left.deliveryAt).getTime();
      const rightTime = new Date(right.deliveryAt).getTime();
      return leftTime - rightTime;
    });
}

function buildDashboardFinanceHref(
  open: boolean,
  focus: DashboardFocus,
  readyMode?: DashboardReadyMode,
  financeMode?: DashboardFinanceMode,
  financeSort?: DashboardFinanceSort,
  pulse?: DashboardPulse
) {
  return buildDashboardStateHref({
    anchor: "dashboard-operativa",
    financeMode,
    financeSort,
    financeOpen: open,
    focus,
    readyMode,
    pulse
  });
}

function parseDashboardPulse(value?: string): DashboardPulse | null {
  if (value === "calendar") return "CALENDAR";
  if (value === "day") return "DAY";
  if (value === "priority") return "PRIORITY";
  if (value === "to-start") return "TO_START";
  if (value === "late-start") return "LATE_START";
  if (value === "blocked") return "BLOCKED";
  if (value === "ready") return "READY";
  if (value === "finance") return "FINANCE";
  if (value === "finance-aged") return "FINANCE_AGED";
  if (value === "tomorrow") return "TOMORROW";
  return null;
}

function pulseClass(activePulse: DashboardPulse | null, ...targets: DashboardPulse[]) {
  return activePulse && targets.includes(activePulse) ? " dashboard-pulse-target" : "";
}

function isToday(day: DashboardWeekDayLoad) {
  const today = new Date();
  return (
    day.date.getFullYear() === today.getFullYear() &&
    day.date.getMonth() === today.getMonth() &&
    day.date.getDate() === today.getDate()
  );
}

function getDashboardWeekDayClassName(day: DashboardWeekDayLoad, selected = false) {
  const classes = ["dashboard-week-day", "workday-highlight-card"];
  const highlight = getWorkdayHighlight(day.date);

  if (highlight) {
    classes.push(highlight);
  } else if (isToday(day)) {
    classes.push("today");
  }

  if (selected) {
    classes.push("selected");
  }

  return classes.join(" ");
}

function getOrderTone(deliveryAt: Date | string, phase: MainPhase, paymentStatus: PaymentStatus) {
  const isOverdue = new Date(deliveryAt).getTime() < Date.now() && phase !== "CONSEGNATO";
  if (isOverdue) {
    return "danger";
  }

  if (paymentStatus === "PAGATO") {
    return "success";
  }

  if (phase === "IN_LAVORAZIONE" && (paymentStatus === "ACCONTO" || paymentStatus === "PARZIALE")) {
    return "warning";
  }

  return "neutral";
}

function DashboardGlyph({
  kind
}: {
  kind: "clock" | "alert" | "pause" | "spark" | "cash" | "calendar" | "play" | "tools";
}) {
  const paths = {
    clock: (
      <>
        <circle cx="12" cy="12" r="8.15" />
        <path d="M12 7.8v4.6l3.15 1.95" />
      </>
    ),
    alert: (
      <>
        <path d="M12 4.75 19 16.9a1.2 1.2 0 0 1-1.04 1.8H6.04A1.2 1.2 0 0 1 5 16.9L12 4.75Z" />
        <path d="M12 9.15v4.7" />
        <circle cx="12" cy="16.2" r="0.92" fill="currentColor" stroke="none" />
      </>
    ),
    pause: (
      <>
        <rect x="7.3" y="5.6" width="3.6" height="12.8" rx="1.15" fill="currentColor" stroke="none" />
        <rect x="13.1" y="5.6" width="3.6" height="12.8" rx="1.15" fill="currentColor" stroke="none" />
      </>
    ),
    spark: (
      <path
        d="M12 3.15 13.8 8.2l5.05 1.8-5.05 1.8L12 16.85l-1.8-5.05L5.15 10l5.05-1.8L12 3.15Zm6.15 11.35.7 1.95 1.95.7-1.95.7-.7 1.95-.7-1.95-1.95-.7 1.95-.7.7-1.95ZM5.85 14.85l.9 2.5 2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9.9-2.5Z"
        fill="currentColor"
        stroke="none"
      />
    ),
    cash: (
      <>
        <rect x="4.2" y="7.1" width="15.6" height="9.8" rx="2.2" />
        <circle cx="12" cy="12" r="2.35" />
        <path d="M7.25 9.25h.01M16.75 14.75h.01" />
      </>
    ),
    calendar: (
      <>
        <path d="M7.75 3.95v2.7M16.25 3.95v2.7" />
        <rect x="4.55" y="5.75" width="14.9" height="13.2" rx="2.8" />
        <path d="M4.55 9.35h14.9" />
      </>
    ),
    play: (
      <path
        d="M8.35 6.1v11.8c0 .67.74 1.08 1.31.72l8.7-5.9a.86.86 0 0 0 0-1.44l-8.7-5.9a.86.86 0 0 0-1.31.72Z"
        fill="currentColor"
        stroke="none"
      />
    ),
    tools: (
      <>
        <path d="m14.65 5.6 3.75 3.75" />
        <path d="M7.85 16.15 16 8a2.2 2.2 0 1 0-3.1-3.1l-8.15 8.15-.95 4.05 4.05-.95Z" />
      </>
    )
  };

  return (
    <svg
      aria-hidden="true"
      className="glyph dashboard-glyph"
      fill="none"
      shapeRendering="geometricPrecision"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.05"
      viewBox="0 0 24 24"
    >
      {paths[kind]}
    </svg>
  );
}
