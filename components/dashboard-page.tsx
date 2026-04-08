import Link from "next/link";
import type { ReactNode } from "react";
import type { MainPhase, PaymentStatus } from "@prisma/client";
import { PageHeader } from "@/components/page-header";
import { QuickOrderControls } from "@/components/quick-order-controls";
import { StatusPills } from "@/components/status-pills";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { countUniqueOrders, getDashboardData, type DashboardWeekDayLoad } from "@/lib/orders";

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
type DashboardOrder = DashboardData["todayOrders"][number];

export async function DashboardPage() {
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

  return (
    <div className="stack">
      <PageHeader
        title="Dashboard"
        description="Vista operativa per capire subito cosa parte oggi, cosa e fermo e come si carica la settimana."
        action={
          <Link className="button primary" href="/orders/new">
            Registra nuovo ordine
          </Link>
        }
      />

      <section className="grid dashboard-summary-grid">
        <MiniMetricCard
          icon={<DashboardGlyph kind="clock" />}
          label="Oggi"
          value={todayOrders.length}
          hint="Consegne di oggi"
          tone="neutral"
        />
        <MiniMetricCard
          icon={<DashboardGlyph kind="calendar" />}
          label="Appuntamenti"
          value={todayAppointments.length}
          hint="Previsti oggi"
          tone="brand"
        />
        <MiniMetricCard
          icon={<DashboardGlyph kind="alert" />}
          label="Arretrati"
          value={overdueOrders.length}
          hint="Scadenze passate"
          tone="danger"
        />
        <MiniMetricCard
          icon={<DashboardGlyph kind="play" />}
          label="Da avviare"
          value={toStartOrders.length}
          hint="Ancora da iniziare"
          tone="neutral"
        />
        <MiniMetricCard
          icon={<DashboardGlyph kind="tools" />}
          label="In lavorazione"
          value={workingOrders.length}
          hint="Gia in cantiere"
          tone="warning"
        />
        <MiniMetricCard
          icon={<DashboardGlyph kind="pause" />}
          label="Sospesi"
          value={blockedOrders.length}
          hint="File o approvazioni"
          tone="warning"
        />
        <MiniMetricCard
          icon={<DashboardGlyph kind="spark" />}
          label="Pronti"
          value={readyOrders.length}
          hint="Da ritirare"
          tone="success"
        />
        <MiniMetricCard
          icon={<DashboardGlyph kind="cash" />}
          label="Saldi"
          value={balanceOrders.length}
          hint="Ancora aperti"
          tone="brand"
        />
      </section>

      <section className="grid dashboard-focus-grid">
        <article className="card card-pad compact-focus-card">
          <div className="compact-focus-head">
            <div>
              <span className="compact-kicker">Cantiere aperto</span>
              <h3>Situazione operativa</h3>
            </div>
            <strong className="focus-total">{totalWorkshop}</strong>
          </div>
          <div className="compact-signal-list">
            <CompactSignal
              icon={<DashboardGlyph kind="play" />}
              label="Da avviare"
              value={String(toStartOrders.length)}
              detail={
                nextToStart ? `${nextToStart.orderCode} • ${nextToStart.customer.name}` : "Nessun ordine in attesa di partenza"
              }
            />
            <CompactSignal
              icon={<DashboardGlyph kind="tools" />}
              label="In lavorazione"
              value={String(workingOrders.length)}
              detail={currentWork ? `${currentWork.orderCode} • ${currentWork.customer.name}` : "Banco libero"}
            />
            <CompactSignal
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
              <article className={`dashboard-week-day${isToday(day) ? " today" : ""}`} key={day.key}>
                <span className="dashboard-week-label">{day.shortLabel}</span>
                <strong>{day.dayLabel}</strong>
                <div className="dashboard-week-stats">
                  <span>Lavori {day.workload}</span>
                  <span>App. {day.appointments}</span>
                  {day.blocked > 0 ? <span className="warning">Sospesi {day.blocked}</span> : null}
                  {day.ready > 0 ? <span className="success">Pronti {day.ready}</span> : null}
                </div>
              </article>
            ))}
          </div>
          <div className="compact-signal-list">
            <CompactSignal
              icon={<DashboardGlyph kind="clock" />}
              label="Prossima consegna"
              value={nextDelivery ? nextDelivery.orderCode : "Nessuna"}
              detail={nextDelivery ? `${nextDelivery.customer.name} • ${formatDateTime(nextDelivery.deliveryAt)}` : "Nessuna scadenza vicina"}
            />
            <CompactSignal
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

      <section className="grid dashboard-lanes-grid">
        <DashboardLane
          description="Arretrati e consegne di oggi"
          emptyMessage="Nessuna urgenza operativa per oggi."
          orders={priorityOrders}
          title="Priorita oggi"
          viewHref="/calendar?view=day"
          viewLabel="Apri giorno"
          renderMeta={(order) =>
            new Date(order.deliveryAt).getTime() < Date.now()
              ? `Arretrato dal ${formatDateTime(order.deliveryAt)}`
              : `Consegna ${formatDateTime(order.deliveryAt)}`
          }
          renderNote={(order) => order.appointmentNote || order.notes || null}
          renderAside={(order) => formatCurrency(order.totalCents)}
        />

        <DashboardLane
          description="Installazioni, sopralluoghi e ritiri pianificati"
          emptyMessage="Nessun appuntamento programmato oggi."
          orders={todayAppointments}
          title="Appuntamenti di oggi"
          viewHref="/calendar?view=day"
          viewLabel="Apri giorno"
          renderMeta={(order) => `Appuntamento ${formatDateTime(order.appointmentAt || order.deliveryAt)}`}
          renderNote={(order) => order.appointmentNote || `Consegna ${formatDateTime(order.deliveryAt)}`}
        />

        <DashboardLane
          description="Ordini accettati ancora da far partire"
          emptyMessage="Niente in attesa di avvio."
          orders={toStartOrders}
          title="Da avviare"
          renderMeta={(order) => `Consegna ${formatDateTime(order.deliveryAt)}`}
          renderNote={(order) => order.notes || null}
        />

        <DashboardLane
          description="Lavorazioni gia partite"
          emptyMessage="Nessun lavoro in corso."
          orders={workingOrders}
          title="In lavorazione"
          renderMeta={(order) => `Consegna ${formatDateTime(order.deliveryAt)}`}
          renderNote={(order) => order.appointmentNote || order.notes || null}
        />

        <DashboardLane
          description="Ordini fermi in attesa di sblocco"
          emptyMessage="Nessun ordine sospeso."
          orders={blockedOrders}
          title="Sospesi"
          renderMeta={(order) => `Consegna ${formatDateTime(order.deliveryAt)}`}
          renderNote={(order) => order.operationalNote || "Motivo sospensione non indicato"}
        />

        <DashboardLane
          description="Ordini pronti al ritiro o consegna"
          emptyMessage="Nessun ordine pronto."
          orders={readyOrders}
          title="Pronti"
          renderMeta={() => "Pronto al ritiro"}
          renderAside={(order) => formatCurrency(order.balanceDueCents)}
          renderNote={(order) => (order.balanceDueCents > 0 ? `Residuo ${formatCurrency(order.balanceDueCents)}` : null)}
        />

        <DashboardLane
          description="Ordini con residui ancora da chiudere"
          emptyMessage="Nessun saldo aperto."
          orders={balanceOrders}
          title="Saldi aperti"
          renderMeta={() => "Saldo da chiudere"}
          renderAside={(order) => formatCurrency(order.balanceDueCents)}
          renderNote={(order) => `Totale ordine ${formatCurrency(order.totalCents)}`}
        />
      </section>

      <section className="card card-pad compact-focus-card">
        <div className="compact-focus-head">
          <div>
            <span className="compact-kicker">Attenzione</span>
            <h3>Ordini che meritano uno sguardo</h3>
          </div>
          <strong className="focus-total">{totalAttention}</strong>
        </div>
        <div className="compact-signal-list">
          <CompactSignal
            icon={<DashboardGlyph kind="alert" />}
            label="Da riallineare"
            value={String(overdueOrders.length)}
            detail={overdueOrders[0] ? `${overdueOrders[0].orderCode} • ${overdueOrders[0].customer.name}` : "Nessun arretrato"}
          />
          <CompactSignal
            icon={<DashboardGlyph kind="pause" />}
            label="Blocchi"
            value={String(blockedOrders.length)}
            detail={blockedOrders[0] ? `${blockedOrders[0].orderCode} • ${blockedOrders[0].customer.name}` : "Nessun fermo"}
          />
          <CompactSignal
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
  renderAside
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
          orders.slice(0, 5).map((order) => (
            <CompactOrderItem
              key={order.id}
              hasWhatsapp={Boolean((order.customer.whatsapp || order.customer.phone || "").replace(/[^\d+]/g, ""))}
              orderId={order.id}
              href={`/orders/${order.id}`}
              code={order.orderCode}
              title={order.customer.name}
              meta={renderMeta(order)}
              aside={renderAside?.(order)}
              tone={getOrderTone(order.deliveryAt, order.mainPhase, order.paymentStatus)}
              phase={order.mainPhase}
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
          ))
        )}
      </div>
    </article>
  );
}

function MiniMetricCard({
  icon,
  label,
  value,
  hint,
  tone
}: {
  icon: ReactNode;
  label: string;
  value: number;
  hint: string;
  tone: "neutral" | "danger" | "warning" | "success" | "brand";
}) {
  return (
    <article className={`card card-pad compact-metric compact-metric-${tone}`}>
      <div className="compact-metric-top">
        <span className="compact-icon">{icon}</span>
        <span className="compact-metric-label">{label}</span>
      </div>
      <strong>{value}</strong>
      <span className="hint">{hint}</span>
    </article>
  );
}

function CompactSignal({
  icon,
  label,
  value,
  detail
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="compact-signal">
      <span className="compact-icon compact-icon-soft">{icon}</span>
      <div className="compact-signal-copy">
        <span className="subtle">{label}</span>
        <strong>{value}</strong>
        <span className="hint">{detail}</span>
      </div>
    </article>
  );
}

function CompactOrderItem({
  hasWhatsapp,
  orderId,
  href,
  code,
  title,
  meta,
  aside,
  tone,
  phase,
  status,
  pills,
  note
}: {
  hasWhatsapp: boolean;
  orderId: string;
  href: string;
  code: string;
  title: string;
  meta: string;
  aside?: string;
  tone: "neutral" | "danger" | "warning" | "success";
  phase: MainPhase;
  status: import("@prisma/client").OperationalStatus;
  pills: ReactNode;
  note?: string | null;
}) {
  return (
    <article className={`compact-order-item compact-order-item-${tone}`}>
      <div className="compact-order-main">
        <div className="compact-order-head">
          <QuickOrderControls
            align="start"
            hasWhatsapp={hasWhatsapp}
            orderId={orderId}
            phase={phase}
            status={status}
          />
          <Link className="order-code" href={href}>
            {code}
          </Link>
          {aside ? <span className="compact-order-aside">{aside}</span> : null}
        </div>
        <div className="subtle">
          {title} • {meta}
        </div>
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

function isToday(day: DashboardWeekDayLoad) {
  const today = new Date();
  return (
    day.date.getFullYear() === today.getFullYear() &&
    day.date.getMonth() === today.getMonth() &&
    day.date.getDate() === today.getDate()
  );
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
    clock: <path d="M12 6.5v5l3 2M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18Z" />,
    alert: <path d="M12 8v5m0 3h.01M10.3 4.9L3.8 16.2a1.5 1.5 0 0 0 1.3 2.3h13.8a1.5 1.5 0 0 0 1.3-2.3L13.7 4.9a1.9 1.9 0 0 0-3.4 0Z" />,
    pause: <path d="M9.2 6.8h1.9v10.4H9.2zm3.7 0h1.9v10.4h-1.9zM12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18Z" />,
    spark: <path d="m12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Zm6 13l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8L18 16ZM6 14l1 2.8L9.8 18L7 19l-1 2.8L5 19l-2.8-1L5 16.8L6 14Z" />,
    cash: <path d="M4 7.5h16v9H4zm3 4.5h.01M17 12h.01M12 14.5a2.5 2.5 0 1 0 0-5a2.5 2.5 0 0 0 0 5Z" />,
    calendar: <path d="M7.5 3.5v3m9-3v3M5.5 8h13m-14 1.5A2.5 2.5 0 0 1 7 7h10a2.5 2.5 0 0 1 2.5 2.5V18A2.5 2.5 0 0 1 17 20.5H7A2.5 2.5 0 0 1 4.5 18Z" />,
    play: <path d="M9 7.5v9l7-4.5-7-4.5ZM12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18Z" />,
    tools: <path d="m14.5 6.5 3 3m-8.2 8.2 8.9-8.9a2 2 0 0 0-2.8-2.8l-8.9 8.9a2 2 0 0 0-.5.8l-.8 2.6 2.6-.8a2 2 0 0 0 .8-.5ZM8 5.5l1.5 1.5M5.5 8 7 9.5" />
  };

  return (
    <svg aria-hidden="true" className="glyph" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      {paths[kind]}
    </svg>
  );
}
