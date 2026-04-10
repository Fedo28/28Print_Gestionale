import Link from "next/link";
import type { ReactNode } from "react";
import type { MainPhase, PaymentStatus } from "@prisma/client";
import { QuickOrderControls } from "@/components/quick-order-controls";
import { StatusPills } from "@/components/status-pills";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { countUniqueOrders, getDashboardData } from "@/lib/orders";

type DashboardTone = "neutral" | "sky" | "coral" | "mint" | "amber" | "lilac";

export async function DashboardPage() {
  const { todayOrders, overdueOrders, blockedOrders, readyOrders, balanceOrders } = await getDashboardData();
  const nextDelivery = todayOrders[0] ?? overdueOrders[0];
  const topReady = readyOrders[0];
  const blockedSample = blockedOrders[0];
  const topBalance = balanceOrders[0];
  const totalAttention = countUniqueOrders(overdueOrders, blockedOrders, balanceOrders);

  return (
    <div className="dashboard-stack">
      <section className="dashboard-grid">
        <article className="card card-pad dashboard-panel dashboard-tone-neutral dashboard-hero-panel">
          <div className="dashboard-hero-copy">
            <span className="dashboard-eyebrow">Control room</span>
            <h2>Dashboard operativo per la giornata</h2>
            <p>
              Un colpo d&apos;occhio su consegne, ritiri, sospesi e saldi aperti, con un linguaggio piu
              ordinato e leggibile.
            </p>
            <div className="dashboard-hero-actions">
              <Link className="button primary" href="/orders/new">
                Registra nuovo ordine
              </Link>
              <Link className="button secondary" href="/calendar?view=day">
                Apri calendario
              </Link>
            </div>
          </div>

          <div className="dashboard-hero-side">
            <article className="dashboard-total-card dashboard-tone-lilac">
              <span className="dashboard-total-label">Ordini da seguire</span>
              <strong>{totalAttention}</strong>
              <p>Tra ritardi, sospesi e saldi ancora da chiudere.</p>
            </article>

            <div className="dashboard-hero-highlights">
              <HeroSignal
                icon={<DashboardGlyph kind="clock" />}
                label="Prossima consegna"
                value={nextDelivery ? nextDelivery.orderCode : "Agenda libera"}
                detail={
                  nextDelivery
                    ? `${nextDelivery.customer.name} • ${formatDateTime(nextDelivery.deliveryAt)}`
                    : "Nessuna consegna imminente"
                }
                tone="sky"
              />
              <HeroSignal
                icon={<DashboardGlyph kind="spark" />}
                label="Ritiro in evidenza"
                value={topReady ? topReady.orderCode : "Nessun ritiro"}
                detail={
                  topReady
                    ? `${topReady.customer.name} • ${formatCurrency(topReady.balanceDueCents)}`
                    : "Nessun ordine pronto da mostrare"
                }
                tone="mint"
              />
            </div>
          </div>
        </article>

        <section aria-label="Metriche operative" className="dashboard-kpi-stack">
          <MetricCard
            icon={<DashboardGlyph kind="calendar" />}
            label="Oggi"
            value={todayOrders.length}
            detail="Consegne programmate"
            tone="sky"
          />
          <MetricCard
            icon={<DashboardGlyph kind="alert" />}
            label="Ritardi"
            value={overdueOrders.length}
            detail="Ordini da riallineare"
            tone="coral"
          />
          <MetricCard
            icon={<DashboardGlyph kind="spark" />}
            label="Pronti"
            value={readyOrders.length}
            detail="Ritiri da gestire"
            tone="mint"
          />
          <MetricCard
            icon={<DashboardGlyph kind="pause" />}
            label="Sospesi"
            value={blockedOrders.length}
            detail="Attese cliente o file"
            tone="amber"
          />
        </section>

        <DashboardPanel
          action={
            <Link className="dashboard-link" href="/calendar?view=day">
              Apri calendario
            </Link>
          }
          className="dashboard-main-lane"
          description="Consegne immediate e ordini da monitorare oggi."
          title="Oggi"
          tone="sky"
        >
          <div className="dashboard-order-list">
            {todayOrders.length === 0 ? <div className="empty">Nessuna consegna prevista oggi.</div> : null}
            {todayOrders.slice(0, 6).map((order) => (
              <CompactOrderItem
                key={order.id}
                hasWhatsapp={Boolean((order.customer.whatsapp || order.customer.phone || "").replace(/[^\d+]/g, ""))}
                orderId={order.id}
                href={`/orders/${order.id}`}
                code={order.orderCode}
                title={order.customer.name}
                meta={formatDateTime(order.deliveryAt)}
                aside={formatCurrency(order.totalCents)}
                tone={getOrderTone(order.deliveryAt, order.mainPhase, order.paymentStatus, "sky")}
                phase={order.mainPhase}
                pills={<StatusPills phase={order.mainPhase} status={order.operationalStatus} payment={order.paymentStatus} />}
                status={order.operationalStatus}
              />
            ))}
          </div>
        </DashboardPanel>

        <div className="dashboard-side-lanes">
          <DashboardPanel description="Ordini pronti al ritiro." title="Ritiri" tone="mint">
            <div className="dashboard-order-list">
              {readyOrders.length === 0 ? (
                <div className="empty">Nessun ordine pronto.</div>
              ) : (
                readyOrders.slice(0, 4).map((order) => (
                  <CompactOrderItem
                    key={order.id}
                    hasWhatsapp={Boolean((order.customer.whatsapp || order.customer.phone || "").replace(/[^\d+]/g, ""))}
                    orderId={order.id}
                    href={`/orders/${order.id}`}
                    code={order.orderCode}
                    title={order.customer.name}
                    meta="Pronto al ritiro"
                    aside={formatCurrency(order.balanceDueCents)}
                    tone={getOrderTone(order.deliveryAt, order.mainPhase, order.paymentStatus, "mint")}
                    phase={order.mainPhase}
                    pills={<StatusPills phase={order.mainPhase} status={order.operationalStatus} payment={order.paymentStatus} />}
                    status={order.operationalStatus}
                  />
                ))
              )}
            </div>
          </DashboardPanel>

          <DashboardPanel description="Attese e blocchi che fermano il flusso." title="Sospesi" tone="amber">
            <div className="dashboard-order-list">
              {blockedOrders.length === 0 ? (
                <div className="empty">Nessun ordine sospeso.</div>
              ) : (
                blockedOrders.slice(0, 4).map((order) => (
                  <CompactOrderItem
                    key={order.id}
                    hasWhatsapp={Boolean((order.customer.whatsapp || order.customer.phone || "").replace(/[^\d+]/g, ""))}
                    orderId={order.id}
                    href={`/orders/${order.id}`}
                    code={order.orderCode}
                    title={order.customer.name}
                    meta={formatDateTime(order.deliveryAt)}
                    note={order.operationalNote || "Motivo sospensione non indicato"}
                    tone={getOrderTone(order.deliveryAt, order.mainPhase, order.paymentStatus, "amber")}
                    phase={order.mainPhase}
                    pills={<StatusPills phase={order.mainPhase} status={order.operationalStatus} payment={order.paymentStatus} />}
                    status={order.operationalStatus}
                  />
                ))
              )}
            </div>
          </DashboardPanel>
        </div>

        <DashboardPanel className="dashboard-bottom-lane" description="Residui da chiudere prima della consegna." title="Incassi" tone="lilac">
          <div className="dashboard-order-list">
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
                  tone={getOrderTone(order.deliveryAt, order.mainPhase, order.paymentStatus, "lilac")}
                  phase={order.mainPhase}
                  pills={<StatusPills phase={order.mainPhase} status={order.operationalStatus} payment={order.paymentStatus} />}
                  status={order.operationalStatus}
                />
              ))
            )}
          </div>
        </DashboardPanel>

        <DashboardPanel className="dashboard-focus-panel" description="Tre segnali rapidi per riorganizzare la giornata." title="Focus rapido" tone="neutral">
          <div className="dashboard-focus-list">
            <FocusSignal
              detail={
                nextDelivery
                  ? `${nextDelivery.customer.name} • ${formatDateTime(nextDelivery.deliveryAt)}`
                  : "Giornata libera"
              }
              icon={<DashboardGlyph kind="clock" />}
              label="Prossima"
              tone="sky"
              value={nextDelivery ? nextDelivery.orderCode : "Nessuna"}
            />
            <FocusSignal
              detail={
                topBalance
                  ? `${topBalance.customer.name} • ${formatCurrency(topBalance.balanceDueCents)}`
                  : "Nessun importo aperto"
              }
              icon={<DashboardGlyph kind="cash" />}
              label="Incasso"
              tone="lilac"
              value={topBalance ? topBalance.orderCode : "Pulito"}
            />
            <FocusSignal
              detail={
                blockedSample
                  ? `${blockedSample.customer.name} • ${blockedSample.operationalNote || formatDateTime(blockedSample.deliveryAt)}`
                  : "Nessun blocco attivo"
              }
              icon={<DashboardGlyph kind="pause" />}
              label="Nodo"
              tone="amber"
              value={blockedSample ? blockedSample.orderCode : "Stabile"}
            />
          </div>
        </DashboardPanel>
      </section>
    </div>
  );
}

function DashboardPanel({
  title,
  description,
  tone,
  action,
  className,
  children
}: {
  title: string;
  description: string;
  tone: DashboardTone;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <article className={cx("card card-pad dashboard-panel", `dashboard-tone-${tone}`, className)}>
      <div className="dashboard-panel-head">
        <div className="dashboard-panel-copy">
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        {action ? <div className="dashboard-panel-action">{action}</div> : null}
      </div>
      {children}
    </article>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  tone
}: {
  icon: ReactNode;
  label: string;
  value: number;
  detail: string;
  tone: DashboardTone;
}) {
  return (
    <article className={cx("card card-pad dashboard-kpi-card", `dashboard-tone-${tone}`)}>
      <div className="dashboard-kpi-head">
        <span className="dashboard-icon">{icon}</span>
        <span className="dashboard-kpi-label">{label}</span>
      </div>
      <strong>{value}</strong>
      <span className="hint">{detail}</span>
    </article>
  );
}

function HeroSignal({
  icon,
  label,
  value,
  detail,
  tone
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: DashboardTone;
}) {
  return (
    <article className={cx("dashboard-signal-card", `dashboard-tone-${tone}`)}>
      <span className="dashboard-icon dashboard-icon-soft">{icon}</span>
      <div className="dashboard-signal-copy">
        <span className="subtle">{label}</span>
        <strong>{value}</strong>
        <span className="hint">{detail}</span>
      </div>
    </article>
  );
}

function FocusSignal({
  icon,
  label,
  value,
  detail,
  tone
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: DashboardTone;
}) {
  return (
    <article className={cx("dashboard-focus-item", `dashboard-tone-${tone}`)}>
      <span className="dashboard-icon dashboard-icon-soft">{icon}</span>
      <div className="dashboard-focus-copy">
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
  tone: DashboardTone;
  phase: MainPhase;
  status: import("@prisma/client").OperationalStatus;
  pills: ReactNode;
  note?: string | null;
}) {
  return (
    <article className={cx("dashboard-order-item", `dashboard-tone-${tone}`)}>
      <div className="dashboard-order-main">
        <div className="dashboard-order-head">
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
          {aside ? <span className="dashboard-order-aside">{aside}</span> : null}
        </div>
        <div className="subtle">
          {title} • {meta}
        </div>
        {note ? <div className="hint">{note}</div> : null}
      </div>
      <div className="dashboard-order-pills">{pills}</div>
    </article>
  );
}

function getOrderTone(
  deliveryAt: Date | string,
  phase: MainPhase,
  paymentStatus: PaymentStatus,
  defaultTone: DashboardTone
) {
  const isOverdue = new Date(deliveryAt).getTime() < Date.now() && phase !== "CONSEGNATO";
  if (isOverdue) {
    return "coral";
  }

  if (paymentStatus === "PAGATO") {
    return "mint";
  }

  if (phase === "IN_LAVORAZIONE" && (paymentStatus === "ACCONTO" || paymentStatus === "PARZIALE")) {
    return "amber";
  }

  return defaultTone;
}

function DashboardGlyph({
  kind
}: {
  kind: "clock" | "alert" | "pause" | "spark" | "cash" | "calendar";
}) {
  const paths = {
    clock: <path d="M12 6.5v5l3 2M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18Z" />,
    alert: <path d="M12 8v5m0 3h.01M10.3 4.9L3.8 16.2a1.5 1.5 0 0 0 1.3 2.3h13.8a1.5 1.5 0 0 0 1.3-2.3L13.7 4.9a1.9 1.9 0 0 0-3.4 0Z" />,
    pause: <path d="M9.2 6.8h1.9v10.4H9.2zm3.7 0h1.9v10.4h-1.9zM12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18Z" />,
    spark: <path d="m12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Zm6 13l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8L18 16ZM6 14l1 2.8L9.8 18L7 19l-1 2.8L5 19l-2.8-1L5 16.8L6 14Z" />,
    cash: <path d="M4 7.5h16v9H4zm3 4.5h.01M17 12h.01M12 14.5a2.5 2.5 0 1 0 0-5a2.5 2.5 0 0 0 0 5Z" />,
    calendar: <path d="M8 3.5v4M16 3.5v4M4 9.5h16M6.5 6h11A2.5 2.5 0 0 1 20 8.5V18a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18V8.5A2.5 2.5 0 0 1 6.5 6Z" />
  };

  return (
    <svg aria-hidden="true" className="glyph" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      {paths[kind]}
    </svg>
  );
}

function cx(...values: Array<string | undefined | false>) {
  return values.filter(Boolean).join(" ");
}
