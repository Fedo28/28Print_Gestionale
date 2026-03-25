import Link from "next/link";
import type { ReactNode } from "react";
import type { MainPhase, PaymentStatus } from "@prisma/client";
import { PageHeader } from "@/components/page-header";
import { QuickOrderControls } from "@/components/quick-order-controls";
import { StatusPills } from "@/components/status-pills";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { countUniqueOrders, getDashboardData } from "@/lib/orders";

export async function DashboardPage() {
  const { todayOrders, overdueOrders, blockedOrders, readyOrders, balanceOrders } = await getDashboardData();
  const nextDelivery = todayOrders[0];
  const topReady = readyOrders[0];
  const blockedSample = blockedOrders[0];
  const totalAttention = countUniqueOrders(overdueOrders, blockedOrders, balanceOrders);

  return (
    <div className="stack">
      <PageHeader
        title="Dashboard"
        description="Cruscotto rapido per vedere subito consegne, ritiri, sospesi e saldi aperti."
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
          hint="Consegne"
          tone="neutral"
        />
        <MiniMetricCard
          icon={<DashboardGlyph kind="alert" />}
          label="Ritardo"
          value={overdueOrders.length}
          hint="Da riallineare"
          tone="danger"
        />
        <MiniMetricCard
          icon={<DashboardGlyph kind="pause" />}
          label="Sospesi"
          value={blockedOrders.length}
          hint="File o ok cliente"
          tone="warning"
        />
        <MiniMetricCard
          icon={<DashboardGlyph kind="spark" />}
          label="Pronti"
          value={readyOrders.length}
          hint="Ritiro"
          tone="success"
        />
        <MiniMetricCard
          icon={<DashboardGlyph kind="cash" />}
          label="Saldi"
          value={balanceOrders.length}
          hint="Da incassare"
          tone="brand"
        />
      </section>

      <section className="grid dashboard-focus-grid">
        <article className="card card-pad compact-focus-card">
          <div className="compact-focus-head">
            <div>
              <span className="compact-kicker">Adesso</span>
              <h3>Focus rapido</h3>
            </div>
            <strong className="focus-total">{totalAttention}</strong>
          </div>
          <div className="compact-signal-list">
            <CompactSignal
              icon={<DashboardGlyph kind="clock" />}
              label="Prossima"
              value={nextDelivery ? nextDelivery.orderCode : "Nessuna"}
              detail={nextDelivery ? `${nextDelivery.customer.name} • ${formatDateTime(nextDelivery.deliveryAt)}` : "Giornata libera"}
            />
            <CompactSignal
              icon={<DashboardGlyph kind="spark" />}
              label="Ritiro"
              value={topReady ? topReady.orderCode : "Nessuno"}
              detail={topReady ? `${topReady.customer.name} • ${formatCurrency(topReady.balanceDueCents)}` : "Nessun pronto"}
            />
            <CompactSignal
              icon={<DashboardGlyph kind="pause" />}
              label="Nodo"
              value={blockedSample ? blockedSample.orderCode : "Pulito"}
              detail={
                blockedSample
                  ? `${blockedSample.customer.name} • ${blockedSample.operationalNote || formatDateTime(blockedSample.deliveryAt)}`
                  : "Nessun sospeso"
              }
            />
          </div>
        </article>

        <article className="card card-pad compact-lane-card">
          <div className="list-header compact-section-head">
            <div>
              <h3>Oggi</h3>
              <p className="card-muted">Consegne immediate</p>
            </div>
            <Link className="compact-link" href="/calendar?view=day">
              Apri calendario
            </Link>
          </div>
          <div className="compact-order-list">
            {todayOrders.length === 0 ? <div className="empty">Nessuna consegna prevista oggi.</div> : null}
            {todayOrders.slice(0, 5).map((order) => (
              <CompactOrderItem
                key={order.id}
                hasWhatsapp={Boolean((order.customer.whatsapp || order.customer.phone || "").replace(/[^\d+]/g, ""))}
                orderId={order.id}
                href={`/orders/${order.id}`}
                code={order.orderCode}
                title={order.customer.name}
                meta={formatDateTime(order.deliveryAt)}
                aside={formatCurrency(order.totalCents)}
                tone={getOrderTone(order.deliveryAt, order.mainPhase, order.paymentStatus)}
                phase={order.mainPhase}
                pills={<StatusPills phase={order.mainPhase} status={order.operationalStatus} payment={order.paymentStatus} />}
                status={order.operationalStatus}
              />
            ))}
          </div>
        </article>
      </section>

      <section className="grid dashboard-lanes-grid">
        <article className="card card-pad compact-lane-card">
          <div className="list-header compact-section-head">
            <div>
              <h3>Ritiri</h3>
              <p className="card-muted">Ordini pronti</p>
            </div>
          </div>
          <div className="compact-order-list">
            {readyOrders.length === 0 ? (
              <div className="empty">Nessun ordine pronto.</div>
            ) : (
              readyOrders.slice(0, 5).map((order) => (
                <CompactOrderItem
                  key={order.id}
                  hasWhatsapp={Boolean((order.customer.whatsapp || order.customer.phone || "").replace(/[^\d+]/g, ""))}
                  orderId={order.id}
                  href={`/orders/${order.id}`}
                  code={order.orderCode}
                  title={order.customer.name}
                  meta="Pronto al ritiro"
                  aside={formatCurrency(order.balanceDueCents)}
                  tone={getOrderTone(order.deliveryAt, order.mainPhase, order.paymentStatus)}
                  phase={order.mainPhase}
                  pills={<StatusPills phase={order.mainPhase} status={order.operationalStatus} payment={order.paymentStatus} />}
                  status={order.operationalStatus}
                />
              ))
            )}
          </div>
        </article>

        <article className="card card-pad compact-lane-card">
          <div className="list-header compact-section-head">
            <div>
              <h3>Sospesi</h3>
              <p className="card-muted">Da riallineare</p>
            </div>
          </div>
          <div className="compact-order-list">
            {blockedOrders.length === 0 ? (
              <div className="empty">Nessun ordine sospeso.</div>
            ) : (
              blockedOrders.slice(0, 5).map((order) => (
                <CompactOrderItem
                  key={order.id}
                  hasWhatsapp={Boolean((order.customer.whatsapp || order.customer.phone || "").replace(/[^\d+]/g, ""))}
                  orderId={order.id}
                  href={`/orders/${order.id}`}
                  code={order.orderCode}
                  title={order.customer.name}
                  meta={formatDateTime(order.deliveryAt)}
                  note={order.operationalNote || "Motivo sospensione non indicato"}
                  tone={getOrderTone(order.deliveryAt, order.mainPhase, order.paymentStatus)}
                  phase={order.mainPhase}
                  pills={<StatusPills phase={order.mainPhase} status={order.operationalStatus} payment={order.paymentStatus} />}
                  status={order.operationalStatus}
                />
              ))
            )}
          </div>
        </article>

        <article className="card card-pad compact-lane-card">
          <div className="list-header compact-section-head">
            <div>
              <h3>Incassi</h3>
              <p className="card-muted">Residui aperti</p>
            </div>
          </div>
          <div className="compact-order-list">
            {balanceOrders.length === 0 ? (
              <div className="empty">Nessun saldo aperto.</div>
            ) : (
              balanceOrders.slice(0, 5).map((order) => (
                <CompactOrderItem
                  key={order.id}
                  hasWhatsapp={Boolean((order.customer.whatsapp || order.customer.phone || "").replace(/[^\d+]/g, ""))}
                  orderId={order.id}
                  href={`/orders/${order.id}`}
                  code={order.orderCode}
                  title={order.customer.name}
                  meta="Saldo da chiudere"
                  aside={formatCurrency(order.balanceDueCents)}
                  tone={getOrderTone(order.deliveryAt, order.mainPhase, order.paymentStatus)}
                  phase={order.mainPhase}
                  pills={<StatusPills phase={order.mainPhase} status={order.operationalStatus} payment={order.paymentStatus} />}
                  status={order.operationalStatus}
                />
              ))
            )}
          </div>
        </article>
      </section>
    </div>
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

function DashboardGlyph({ kind }: { kind: "clock" | "alert" | "pause" | "spark" | "cash" }) {
  const paths = {
    clock: <path d="M12 6.5v5l3 2M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18Z" />,
    alert: <path d="M12 8v5m0 3h.01M10.3 4.9L3.8 16.2a1.5 1.5 0 0 0 1.3 2.3h13.8a1.5 1.5 0 0 0 1.3-2.3L13.7 4.9a1.9 1.9 0 0 0-3.4 0Z" />,
    pause: <path d="M9.2 6.8h1.9v10.4H9.2zm3.7 0h1.9v10.4h-1.9zM12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18Z" />,
    spark: <path d="m12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Zm6 13l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8L18 16ZM6 14l1 2.8L9.8 18L7 19l-1 2.8L5 19l-2.8-1L5 16.8L6 14Z" />,
    cash: <path d="M4 7.5h16v9H4zm3 4.5h.01M17 12h.01M12 14.5a2.5 2.5 0 1 0 0-5a2.5 2.5 0 0 0 0 5Z" />
  };

  return (
    <svg aria-hidden="true" className="glyph" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      {paths[kind]}
    </svg>
  );
}
