import Link from "next/link";
import type { CSSProperties } from "react";
import { PageHeader } from "@/components/page-header";
import { requireAuth } from "@/lib/auth";
import { formatCurrency, formatQuantity } from "@/lib/format";
import { getSalesStats, type SalesStatsMonth, type SalesStatsTopItem } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  await requireAuth();
  const stats = await getSalesStats();
  const months = stats.monthlyTrend;
  const currentMonth = stats.summaryCurrentMonth;
  const totalRevenue = months.reduce((sum, month) => sum + month.revenueCents, 0);
  const totalQuantity = months.reduce((sum, month) => sum + month.quantity, 0);
  const totalOrders = months.reduce((sum, month) => sum + month.ordersCount, 0);
  const activeMonths = months.filter((month) => month.revenueCents > 0 || month.ordersCount > 0 || month.quantity > 0);
  const averageOrderCents = currentMonth.ordersCount > 0
    ? Math.round(currentMonth.revenueCents / currentMonth.ordersCount)
    : 0;
  const averageMonthCents = activeMonths.length > 0 ? Math.round(totalRevenue / activeMonths.length) : 0;
  const maxRevenueCents = Math.max(...months.map((month) => month.revenueCents), 1);
  const bestMonth = months.reduce<SalesStatsMonth | null>((best, month) => {
    if (!best || month.revenueCents > best.revenueCents) {
      return month;
    }

    return best;
  }, null);

  return (
    <div className="stack stats-page-shell">
      <PageHeader
        title="Statistiche"
        action={
          <Link className="button ghost" href="/orders">
            Apri ordini
          </Link>
        }
      />

      <section className="stats-overview-grid">
        <article className="card card-pad stats-hero-card">
          <div className="stats-hero-top">
            <span className="compact-kicker">Mese corrente</span>
            <span className={`stats-delta stats-delta-${currentMonth.trend}`}>
              {formatTrendValue(currentMonth)}
            </span>
          </div>
          <div className="stats-hero-value">
            <span>{currentMonth.label}</span>
            <strong>{formatCurrency(currentMonth.revenueCents)}</strong>
          </div>
          <div className="stats-hero-bottom">
            <div>
              <span>Ordini</span>
              <strong>{currentMonth.ordersCount}</strong>
            </div>
            <div>
              <span>Pezzi</span>
              <strong>{formatQuantity(currentMonth.quantity)}</strong>
            </div>
            <div>
              <span>Ticket medio</span>
              <strong>{formatCurrency(averageOrderCents)}</strong>
            </div>
          </div>
        </article>

        <div className="stats-signal-grid">
          <StatsSignal label="Totale 12 mesi" value={formatCurrency(totalRevenue)} tone="blue" />
          <StatsSignal label="Ordini" value={String(totalOrders)} tone="lime" />
          <StatsSignal label="Pezzi" value={formatQuantity(totalQuantity)} tone="cyan" />
          <StatsSignal label="Media mese" value={formatCurrency(averageMonthCents)} tone="neutral" />
        </div>
      </section>

      <section className="grid stats-main-grid">
        <article className="card card-pad stats-trend-card">
          <div className="stats-panel-head">
            <div>
              <span className="compact-kicker">Andamento</span>
              <h3>Vendite 12 mesi</h3>
            </div>
            <div className="stats-period-meta">
              <span>Best</span>
              <strong>{bestMonth?.label || "-"}</strong>
            </div>
          </div>

          <div className="stats-trend-chart">
            {months.map((month) => (
              <StatsTrendRow month={month} maxRevenueCents={maxRevenueCents} key={month.monthKey} />
            ))}
          </div>
        </article>

        <div className="grid stats-top-grid">
          <article className="card card-pad stats-top-card">
            <div className="stats-panel-head">
              <div>
                <span className="compact-kicker">Top vendite</span>
                <h3>Fatturato</h3>
              </div>
            </div>
            <StatsTopList items={stats.topByRevenue.slice(0, 8)} metric="revenue" total={totalRevenue} />
          </article>

          <article className="card card-pad stats-top-card">
            <div className="stats-panel-head">
              <div>
                <span className="compact-kicker">Top vendite</span>
                <h3>Quantita</h3>
              </div>
            </div>
            <StatsTopList items={stats.topByQuantity.slice(0, 8)} metric="quantity" total={totalQuantity} />
          </article>
        </div>
      </section>
    </div>
  );
}

function StatsSignal({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "blue" | "lime" | "cyan" | "neutral";
}) {
  return (
    <article className={`stats-signal-card stats-signal-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function StatsTrendRow({
  month,
  maxRevenueCents
}: {
  month: SalesStatsMonth;
  maxRevenueCents: number;
}) {
  const barWidth = maxRevenueCents > 0
    ? Math.min(100, Math.round((month.revenueCents / maxRevenueCents) * 100))
    : 0;
  const visibleBarWidth = month.revenueCents > 0 ? Math.max(4, barWidth) : 0;
  const style = { "--bar-width": `${visibleBarWidth}%` } as CSSProperties;

  return (
    <article className={`stats-trend-row stats-trend-row-${month.trend}`} style={style}>
      <div className="stats-trend-month">
        <strong>{formatCompactMonthLabel(month.label)}</strong>
        <span>{month.ordersCount} ordini</span>
      </div>
      <div className="stats-trend-bar-track">
        <span className="stats-trend-bar" />
        <span className="stats-trend-qty">{formatQuantity(month.quantity)} pezzi</span>
      </div>
      <div className="stats-trend-value">
        <strong>{formatCurrency(month.revenueCents)}</strong>
      </div>
      <div className={`stats-delta stats-delta-${month.trend}`}>{formatTrendValue(month)}</div>
    </article>
  );
}

function StatsTopList({
  items,
  metric,
  total
}: {
  items: SalesStatsTopItem[];
  metric: "revenue" | "quantity";
  total: number;
}) {
  if (items.length === 0) {
    return <div className="empty">Nessun ordine confermato negli ultimi 12 mesi.</div>;
  }

  return (
    <div className="stats-top-list">
      {items.map((item, index) => {
        const share = total > 0
          ? Math.round(((metric === "revenue" ? item.revenueCents : item.quantity) / total) * 1000) / 10
          : 0;
        const shareWidth = share > 0 ? Math.max(4, Math.min(100, share)) : 0;
        const style = { "--bar-width": `${shareWidth}%` } as CSSProperties;

        return (
          <article className="stats-top-item" key={item.key}>
            <div className="stats-top-rank">{index + 1}</div>
            <div className="stats-top-copy">
              <div className="stats-top-title-row">
                <strong>{item.label}</strong>
              </div>
              <div className="stats-top-meta">
                {item.catalogCode ? <span className="stats-code-tag">{item.catalogCode}</span> : null}
                <span>{item.orderCount} ordini</span>
              </div>
              <div className="stats-top-meter" style={style}>
                <span />
              </div>
            </div>
            <div className="stats-top-aside">
              <strong>{metric === "revenue" ? formatCurrency(item.revenueCents) : formatQuantity(item.quantity)}</strong>
              <span>{share.toLocaleString("it-IT", { maximumFractionDigits: 1 })}%</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function formatTrendValue(month: SalesStatsMonth) {
  if (month.trend === "new") {
    return "Nuovo";
  }

  if (month.deltaRevenuePct === null) {
    return formatCurrency(month.deltaRevenueCents);
  }

  const sign = month.deltaRevenuePct > 0 ? "+" : "";
  return `${sign}${month.deltaRevenuePct.toLocaleString("it-IT", { maximumFractionDigits: 1 })}%`;
}

function formatCompactMonthLabel(label: string) {
  const [month, year] = label.split(" ");

  if (!month || !year) {
    return label;
  }

  return `${month.slice(0, 3)} ${year.slice(-2)}`;
}
