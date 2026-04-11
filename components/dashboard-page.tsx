import Link from "next/link";
import type { ReactNode } from "react";
import type { MainPhase, PaymentStatus } from "@prisma/client";
import { PageHeader } from "@/components/page-header";
import { QuickOrderControls } from "@/components/quick-order-controls";
import { StatusPills } from "@/components/status-pills";
import { formatCurrency, formatDateKey, formatDateTime } from "@/lib/format";
import { buildOrdersFilterHref } from "@/lib/order-filters";
import { countUniqueOrders, getDashboardData, type DashboardWeekDayLoad } from "@/lib/orders";
import { getWorkdayHighlight } from "@/lib/workday-highlights";

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
type DashboardOrder = DashboardData["todayOrders"][number];
type DashboardPanel = "PRIORITY" | "PRODUCTION" | "APPOINTMENTS" | "FINANCE";
type DashboardAccent = "today" | "agenda" | "overdue" | "to-start" | "working" | "blocked" | "ready" | "balance";

export async function DashboardPage({ panel }: { panel?: string }) {
  const {
    todayOrders,
    todayAppointments,
    overdueOrders,
    blockedOrders,
    readyOrders,
    balanceOrders,
    toStartOrders,
    workingOrders,
    weekLoad
  } = await getDashboardData();

  const priorityOrders = mergeUniqueOrders(overdueOrders, todayOrders);
  const nextDelivery = priorityOrders[0];
  const nextAppointment = todayAppointments[0];
  const nextToStart = toStartOrders[0];
  const currentWork = workingOrders[0];
  const totalWorkshop = countUniqueOrders(toStartOrders, workingOrders, blockedOrders, readyOrders);
  const totalAttention = countUniqueOrders(priorityOrders, blockedOrders, balanceOrders);
  const weeklyWorkload = weekLoad.reduce((sum, day) => sum + day.workload, 0);
  const weeklyAppointments = weekLoad.reduce((sum, day) => sum + day.appointments, 0);
  const activePanel = parseDashboardPanel(panel);
  const links = {
    today: buildOrdersFilterHref({ preset: "TODAY" }),
    appointments: buildOrdersFilterHref({ preset: "APPOINTMENTS_TODAY" }),
    overdue: buildOrdersFilterHref({ preset: "OVERDUE" }),
    priorityToday: buildOrdersFilterHref({ preset: "PRIORITY_TODAY" }),
    toStart: buildOrdersFilterHref({ preset: "TO_START" }),
    working: buildOrdersFilterHref({ preset: "WORKING" }),
    blocked: buildOrdersFilterHref({ preset: "BLOCKED" }),
    ready: buildOrdersFilterHref({ preset: "READY" }),
    balance: buildOrdersFilterHref({ preset: "BALANCE" })
  };
  const dashboardPanelLinks = {
    today: `${buildDashboardPanelHref("PRIORITY")}#dashboard-operativa`,
    appointments: `${buildDashboardPanelHref("APPOINTMENTS")}#dashboard-operativa`,
    overdue: `${buildDashboardPanelHref("PRIORITY")}#dashboard-operativa`,
    toStart: `${buildDashboardPanelHref("PRODUCTION")}#dashboard-operativa`,
    working: `${buildDashboardPanelHref("PRODUCTION")}#dashboard-operativa`,
    blocked: `${buildDashboardPanelHref("PRODUCTION")}#dashboard-operativa`,
    ready: `${buildDashboardPanelHref("PRODUCTION")}#dashboard-operativa`,
    balance: `${buildDashboardPanelHref("FINANCE")}#dashboard-operativa`
  };
  const nextDeliveryDetail = nextDelivery
    ? `${nextDelivery.customer.name} • ${formatDateTime(nextDelivery.deliveryAt)}`
    : "Nessuna scadenza vicina";
  const nextAppointmentDetail = nextAppointment
    ? `${nextAppointment.customer.name} • ${formatDateTime(nextAppointment.appointmentAt || nextAppointment.deliveryAt)}`
    : "Nessun appuntamento oggi";
  const mobileStats = [
    { accent: "today", href: dashboardPanelLinks.today, label: "Oggi", value: todayOrders.length },
    { accent: "agenda", href: dashboardPanelLinks.appointments, label: "Agenda", value: todayAppointments.length },
    { accent: "overdue", href: dashboardPanelLinks.overdue, label: "Arretrati", value: overdueOrders.length },
    { accent: "to-start", href: dashboardPanelLinks.toStart, label: "Avvio", value: toStartOrders.length },
    { accent: "working", href: dashboardPanelLinks.working, label: "Lavoro", value: workingOrders.length },
    { accent: "blocked", href: dashboardPanelLinks.blocked, label: "Sospesi", value: blockedOrders.length },
    { accent: "ready", href: dashboardPanelLinks.ready, label: "Pronti", value: readyOrders.length },
    { accent: "balance", href: dashboardPanelLinks.balance, label: "Saldi", value: balanceOrders.length }
  ] satisfies Array<{ accent: DashboardAccent; href: string; label: string; value: number }>;

  return (
    <div className="stack dashboard-page-shell">
      <PageHeader
        title="Dashboard"
        action={
          <Link className="button primary" href="/orders/new">
            Registra nuovo ordine
          </Link>
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
            href={`${buildDashboardPanelHref("PRODUCTION")}#dashboard-operativa`}
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
            href={`${buildDashboardPanelHref("APPOINTMENTS")}#dashboard-operativa`}
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
            href={`${buildDashboardPanelHref("PRIORITY")}#dashboard-operativa`}
            icon={<DashboardGlyph kind="alert" />}
            title="Attenzione"
            items={[
              { label: "Arretrati", value: overdueOrders.length },
              { label: "Blocchi", value: blockedOrders.length },
              { label: "Saldi", value: balanceOrders.length }
            ]}
          />
        </div>
      </section>

      <section className="grid dashboard-summary-grid">
        <MiniMetricCard
          accent="today"
          href={dashboardPanelLinks.today}
          icon={<DashboardGlyph kind="clock" />}
          label="Oggi"
          value={todayOrders.length}
          hint="Consegne di oggi"
          tone="neutral"
        />
        <MiniMetricCard
          accent="agenda"
          href={dashboardPanelLinks.appointments}
          icon={<DashboardGlyph kind="calendar" />}
          label="Agenda"
          value={todayAppointments.length}
          hint="Previsti oggi"
          tone="brand"
        />
        <MiniMetricCard
          accent="overdue"
          href={dashboardPanelLinks.overdue}
          icon={<DashboardGlyph kind="alert" />}
          label="Arretrati"
          value={overdueOrders.length}
          hint="Scadenze passate"
          tone="danger"
        />
        <MiniMetricCard
          accent="to-start"
          href={dashboardPanelLinks.toStart}
          icon={<DashboardGlyph kind="play" />}
          label="Da avviare"
          value={toStartOrders.length}
          hint="Ancora da iniziare"
          tone="neutral"
        />
        <MiniMetricCard
          accent="working"
          href={dashboardPanelLinks.working}
          icon={<DashboardGlyph kind="tools" />}
          label="In lavorazione"
          value={workingOrders.length}
          hint="Gia in cantiere"
          tone="warning"
        />
        <MiniMetricCard
          accent="blocked"
          href={dashboardPanelLinks.blocked}
          icon={<DashboardGlyph kind="pause" />}
          label="Sospesi"
          value={blockedOrders.length}
          hint="File o approvazioni"
          tone="warning"
        />
        <MiniMetricCard
          accent="ready"
          href={dashboardPanelLinks.ready}
          icon={<DashboardGlyph kind="spark" />}
          label="Pronti"
          value={readyOrders.length}
          hint="Da ritirare"
          tone="success"
        />
        <MiniMetricCard
          accent="balance"
          href={dashboardPanelLinks.balance}
          icon={<DashboardGlyph kind="cash" />}
          label="Saldi"
          value={balanceOrders.length}
          hint="Ancora aperti"
          tone="brand"
        />
      </section>

      <section className="grid dashboard-focus-grid">
        <article className="card card-pad compact-focus-card dashboard-ops-card">
          <div className="compact-focus-head">
            <div>
              <span className="compact-kicker">Cantiere aperto</span>
              <h3>Situazione operativa</h3>
            </div>
            <strong className="focus-total">{totalWorkshop}</strong>
          </div>
          <div className="compact-signal-list dashboard-ops-signal-list">
            <CompactSignal
              href={links.toStart}
              icon={<DashboardGlyph kind="play" />}
              label="Da avviare"
              value={String(toStartOrders.length)}
              detail={
                nextToStart ? `${nextToStart.orderCode} • ${nextToStart.customer.name}` : "Nessun ordine in attesa di partenza"
              }
            />
            <CompactSignal
              href={links.working}
              icon={<DashboardGlyph kind="tools" />}
              label="In lavorazione"
              value={String(workingOrders.length)}
              detail={currentWork ? `${currentWork.orderCode} • ${currentWork.customer.name}` : "Banco libero"}
            />
            <CompactSignal
              href={links.blocked}
              icon={<DashboardGlyph kind="pause" />}
              label="Sospesi"
              value={String(blockedOrders.length)}
              detail={
                blockedOrders[0]
                  ? `${blockedOrders[0].orderCode} • ${blockedOrders[0].operationalNote || blockedOrders[0].customer.name}`
                  : "Nessun blocco aperto"
              }
            />
            <CompactSignal
              href={links.ready}
              icon={<DashboardGlyph kind="spark" />}
              label="Pronti"
              value={String(readyOrders.length)}
              detail={readyOrders[0] ? `${readyOrders[0].orderCode} • ${readyOrders[0].customer.name}` : "Nessun ritiro pronto"}
            />
          </div>
        </article>

        <article className="card card-pad compact-lane-card dashboard-week-card">
          <div className="list-header compact-section-head">
            <div>
              <h3>Settimana sotto controllo</h3>
              <p className="card-muted">
                {weeklyWorkload} lavori in consegna e {weeklyAppointments} appuntamenti nei prossimi 7 giorni.
              </p>
            </div>
            <Link className="compact-link" href="/calendar?view=week">
              Apri settimana
            </Link>
          </div>
          <div className="dashboard-week-grid">
            {weekLoad.map((day) => (
              <Link
                className={getDashboardWeekDayClassName(day)}
                href={`/calendar?view=day&date=${formatDateKey(day.date)}`}
                key={day.key}
              >
                <div className="dashboard-week-head">
                  <span className="dashboard-week-label">{day.shortLabel}</span>
                  <strong className="dashboard-week-date">{day.dayLabel}</strong>
                </div>
                <div className="dashboard-week-stats">
                  <span>Lav. {day.workload}</span>
                  <span>App. {day.appointments}</span>
                  {day.blocked > 0 ? <span className="warning">Sosp. {day.blocked}</span> : null}
                  {day.ready > 0 ? <span className="success">Pront. {day.ready}</span> : null}
                </div>
              </Link>
            ))}
          </div>
          <div className="compact-signal-list">
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
        </article>
      </section>

      <section className="card card-pad compact-focus-card dashboard-panel-shell" id="dashboard-operativa">
        <div className="list-header compact-section-head">
          <div>
            <span className="compact-kicker">Liste rapide</span>
            <h3>Dashboard operativa</h3>
          </div>
        </div>

        <nav className="calendar-view-switch dashboard-panel-switch" aria-label="Selettore blocchi dashboard">
          <Link
            className={`calendar-switch-link${activePanel === "PRIORITY" ? " active" : ""}`}
            href={buildDashboardPanelHref("PRIORITY")}
            replace
            scroll={false}
          >
            Priorita
          </Link>
          <Link
            className={`calendar-switch-link${activePanel === "PRODUCTION" ? " active" : ""}`}
            href={buildDashboardPanelHref("PRODUCTION")}
            replace
            scroll={false}
          >
            Produzione
          </Link>
          <Link
            className={`calendar-switch-link${activePanel === "APPOINTMENTS" ? " active" : ""}`}
            href={buildDashboardPanelHref("APPOINTMENTS")}
            replace
            scroll={false}
          >
            Appuntamenti
          </Link>
          <Link
            className={`calendar-switch-link${activePanel === "FINANCE" ? " active" : ""}`}
            href={buildDashboardPanelHref("FINANCE")}
            replace
            scroll={false}
          >
            Incassi
          </Link>
        </nav>

        {activePanel === "PRIORITY" ? (
          <section className="grid dashboard-lanes-grid">
            <DashboardLane
              description="Arretrati e consegne di oggi"
              emptyMessage="Nessuna urgenza operativa per oggi."
              orders={priorityOrders}
              title="Priorita oggi"
              viewHref={links.priorityToday}
              viewLabel="Apri lista"
              renderMeta={(order) =>
                new Date(order.deliveryAt).getTime() < Date.now()
                  ? `Arretrato dal ${formatDateTime(order.deliveryAt)}`
                  : `Consegna ${formatDateTime(order.deliveryAt)}`
              }
              renderNote={(order) => order.appointmentNote || order.notes || null}
              renderAside={(order) => formatCurrency(order.totalCents)}
            />
          </section>
        ) : null}

        {activePanel === "PRODUCTION" ? (
          <section className="grid dashboard-lanes-grid">
            <DashboardLane
              description="Ordini accettati ancora da far partire"
              emptyMessage="Niente in attesa di avvio."
              density="dense"
              orders={toStartOrders}
              title="Da avviare"
              viewHref={links.toStart}
              viewLabel="Apri lista"
              renderMeta={(order) => `Consegna ${formatDateTime(order.deliveryAt)}`}
            />

            <DashboardLane
              description="Lavorazioni gia partite"
              emptyMessage="Nessun lavoro in corso."
              density="dense"
              orders={workingOrders}
              title="In lavorazione"
              viewHref={links.working}
              viewLabel="Apri lista"
              renderMeta={(order) => `Consegna ${formatDateTime(order.deliveryAt)}`}
            />

            <DashboardLane
              description="Ordini fermi in attesa di sblocco"
              density="dense"
              emptyMessage="Nessun ordine sospeso."
              orders={blockedOrders}
              title="Sospesi"
              viewHref={links.blocked}
              viewLabel="Apri lista"
              renderMeta={(order) => `Consegna ${formatDateTime(order.deliveryAt)}`}
              renderNote={(order) => order.operationalNote || "Motivo sospensione non indicato"}
            />

            <DashboardLane
              description="Ordini pronti al ritiro o consegna"
              density="dense"
              emptyMessage="Nessun ordine pronto."
              orders={readyOrders}
              title="Pronti"
              viewHref={links.ready}
              viewLabel="Apri lista"
              renderMeta={() => "Pronto al ritiro"}
              renderAside={(order) => formatCurrency(order.balanceDueCents)}
            />
          </section>
        ) : null}

        {activePanel === "APPOINTMENTS" ? (
          <section className="grid dashboard-lanes-grid">
            <DashboardLane
              description="Installazioni, sopralluoghi e ritiri pianificati"
              emptyMessage="Nessun appuntamento programmato oggi."
              orders={todayAppointments}
              title="Appuntamenti di oggi"
              viewHref={links.appointments}
              viewLabel="Apri lista"
              renderMeta={(order) => `Appuntamento ${formatDateTime(order.appointmentAt || order.deliveryAt)}`}
              renderNote={(order) => order.appointmentNote || `Consegna ${formatDateTime(order.deliveryAt)}`}
            />
          </section>
        ) : null}

        {activePanel === "FINANCE" ? (
          <section className="grid dashboard-lanes-grid">
            <DashboardLane
              description="Ordini con residui ancora da chiudere"
              emptyMessage="Nessun saldo aperto."
              orders={balanceOrders}
              title="Saldi aperti"
              viewHref={links.balance}
              viewLabel="Apri lista"
              renderMeta={() => "Saldo da chiudere"}
              renderAside={(order) => formatCurrency(order.balanceDueCents)}
              renderNote={(order) => `Totale ordine ${formatCurrency(order.totalCents)}`}
            />
          </section>
        ) : null}
      </section>

      <section className="card card-pad compact-focus-card dashboard-attention-card">
        <div className="compact-focus-head">
          <div>
            <span className="compact-kicker">Attenzione</span>
            <h3>Ordini che meritano uno sguardo</h3>
          </div>
          <strong className="focus-total">{totalAttention}</strong>
        </div>
        <div className="compact-signal-list">
          <CompactSignal
            href={links.overdue}
            icon={<DashboardGlyph kind="alert" />}
            label="Da riallineare"
            value={String(overdueOrders.length)}
            detail={overdueOrders[0] ? `${overdueOrders[0].orderCode} • ${overdueOrders[0].customer.name}` : "Nessun arretrato"}
          />
          <CompactSignal
            href={links.blocked}
            icon={<DashboardGlyph kind="pause" />}
            label="Blocchi"
            value={String(blockedOrders.length)}
            detail={blockedOrders[0] ? `${blockedOrders[0].orderCode} • ${blockedOrders[0].customer.name}` : "Nessun fermo"}
          />
          <CompactSignal
            href={links.balance}
            icon={<DashboardGlyph kind="cash" />}
            label="Incassi aperti"
            value={String(balanceOrders.length)}
            detail={balanceOrders[0] ? `${balanceOrders[0].orderCode} • ${formatCurrency(balanceOrders[0].balanceDueCents)}` : "Nessun saldo"}
          />
        </div>
      </section>
    </div>
  );
}

function DashboardLane({
  title,
  description,
  orders,
  emptyMessage,
  viewHref,
  viewLabel,
  renderMeta,
  renderNote,
  renderAside,
  density = "default"
}: {
  title: string;
  description: string;
  orders: DashboardOrder[];
  emptyMessage: string;
  viewHref?: string;
  viewLabel?: string;
  renderMeta: (order: DashboardOrder) => string;
  renderNote?: (order: DashboardOrder) => string | null | undefined;
  renderAside?: (order: DashboardOrder) => string | undefined;
  density?: "default" | "dense";
}) {
  return (
    <article className="card card-pad compact-lane-card">
      <div className="list-header compact-section-head">
        <div>
          <h3>{title}</h3>
          <p className="card-muted">{description}</p>
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
          <div className={`compact-order-grid${density === "dense" ? " compact-order-grid-dense" : ""}`}>
            {orders.slice(0, 30).map((order) => (
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
  value,
  hint,
  tone
}: {
  accent: DashboardAccent;
  href: string;
  icon: ReactNode;
  label: string;
  value: number;
  hint: string;
  tone: "neutral" | "danger" | "warning" | "success" | "brand";
}) {
  return (
    <Link
      className={`card card-pad compact-metric compact-metric-${tone} compact-metric-dashboard compact-accent-${accent} compact-card-link`}
      href={href}
    >
      <div className="compact-metric-top">
        <span className="compact-icon">{icon}</span>
        <span className="compact-metric-label">{label}</span>
      </div>
      <strong>{value}</strong>
      <span className="hint">{hint}</span>
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
  status: import("@prisma/client").OperationalStatus;
  pills: ReactNode;
  note?: string | null;
}) {
  const workdayHighlight = getWorkdayHighlight(deliveryAt);
  const whatsappNotified = phase === "SVILUPPO_COMPLETATO" && Boolean(readyWhatsappSentAt);

  return (
    <article
      className={`compact-order-item compact-order-item-dashboard compact-order-item-${density} compact-order-item-${tone} workday-highlight-card${workdayHighlight ? ` ${workdayHighlight}` : ""}${whatsappNotified ? " whatsapp-notified" : ""}`}
    >
      <div className="compact-order-main">
        <div className="compact-order-head">
          <QuickOrderControls
            align="start"
            hasWhatsapp={hasWhatsapp}
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

function isToday(day: DashboardWeekDayLoad) {
  const today = new Date();
  return (
    day.date.getFullYear() === today.getFullYear() &&
    day.date.getMonth() === today.getMonth() &&
    day.date.getDate() === today.getDate()
  );
}

function getDashboardWeekDayClassName(day: DashboardWeekDayLoad) {
  const classes = ["dashboard-week-day", "workday-highlight-card"];
  const highlight = getWorkdayHighlight(day.date);

  if (highlight) {
    classes.push(highlight);
  } else if (isToday(day)) {
    classes.push("today");
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
