import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireAuth } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { getSalesStats, type SalesStatsMonth, type SalesStatsTopItem, type SalesStatsTrend } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  await requireAuth();
  const stats = await getSalesStats();
  const currentMonth = stats.summaryCurrentMonth;
  const totalRevenue = stats.monthlyTrend.reduce((sum, month) => sum + month.revenueCents, 0);
  const totalQuantity = stats.monthlyTrend.reduce((sum, month) => sum + month.quantity, 0);

  return (
    <div className="stack">
      <PageHeader
        title="Statistiche"
        description="Lettura commerciale semplice: cosa vendiamo di piu e come sta andando il fatturato mese dopo mese."
        action={
          <Link className="button ghost" href="/orders">
            Apri ordini
          </Link>
        }
      />

      <section className="grid stats-summary-grid">
        <StatsMetricCard
          title="Fatturato mese"
          value={formatCurrency(currentMonth.revenueCents)}
          hint={currentMonth.label}
          tone="brand"
        />
        <StatsMetricCard
          title="Vs mese prima"
          value={formatTrendValue(currentMonth)}
          hint={formatTrendHint(currentMonth)}
          tone={getTrendTone(currentMonth.trend)}
        />
        <StatsMetricCard
          title="Ordini mese"
          value={String(currentMonth.ordersCount)}
          hint="Ordini confermati"
          tone="neutral"
        />
        <StatsMetricCard
          title="Quantita mese"
          value={String(currentMonth.quantity)}
          hint="Righe vendute"
          tone="success"
        />
      </section>

      <section className="grid stats-main-grid">
        <article className="card card-pad stats-trend-card">
          <div className="list-header">
            <div>
              <span className="compact-kicker">Ultimi 12 mesi</span>
              <h3>Andamento mese su mese</h3>
              <p className="card-muted">Confronto sul mese di creazione ordine, esclusi i preventivi.</p>
            </div>
            <div className="stats-period-meta">
              <strong>{formatCurrency(totalRevenue)}</strong>
              <span className="subtle">{totalQuantity} pezzi complessivi</span>
            </div>
          </div>

          <div className="stats-trend-list">
            {stats.monthlyTrend.map((month) => (
              <article className="mini-item stats-trend-item" key={month.monthKey}>
                <div className="stats-trend-head">
                  <div>
                    <strong>{month.label}</strong>
                    <div className="subtle">
                      {month.ordersCount} ordini • {month.quantity} pezzi
                    </div>
                  </div>
                  <div className={`stats-delta stats-delta-${month.trend}`}>{formatTrendValue(month)}</div>
                </div>
                <div className="stats-trend-values">
                  <strong>{formatCurrency(month.revenueCents)}</strong>
                  <span className="hint">{formatTrendHint(month)}</span>
                </div>
              </article>
            ))}
          </div>
        </article>

        <div className="grid stats-top-grid">
          <article className="card card-pad stats-top-card">
            <div className="list-header">
              <div>
                <span className="compact-kicker">Top vendite</span>
                <h3>Per fatturato</h3>
              </div>
            </div>
            <StatsTopList items={stats.topByRevenue.slice(0, 8)} metric="revenue" total={totalRevenue} />
          </article>

          <article className="card card-pad stats-top-card">
            <div className="list-header">
              <div>
                <span className="compact-kicker">Top vendite</span>
                <h3>Per quantita</h3>
              </div>
            </div>
            <StatsTopList items={stats.topByQuantity.slice(0, 8)} metric="quantity" total={totalQuantity} />
          </article>
        </div>
      </section>
    </div>
  );
}

function StatsMetricCard({
  title,
  value,
  hint,
  tone
}: {
  title: string;
  value: string;
  hint: string;
  tone: "neutral" | "brand" | "success" | "up" | "down" | "new";
}) {
  return (
    <article className={`card card-pad stats-metric-card stats-metric-${tone}`}>
      <span className="compact-kicker">{title}</span>
      <strong>{value}</strong>
      <span className="hint">{hint}</span>
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

        return (
          <article className="mini-item stats-top-item" key={item.key}>
            <div className="stats-top-rank">{index + 1}</div>
            <div className="stats-top-copy">
              <div className="list-header">
                <strong>{item.label}</strong>
                {item.catalogCode ? <span className="stats-code-tag">{item.catalogCode}</span> : null}
              </div>
              <div className="subtle">{item.orderCount} ordini coinvolti</div>
            </div>
            <div className="stats-top-aside">
              <strong>{metric === "revenue" ? formatCurrency(item.revenueCents) : `${item.quantity}`}</strong>
              <span className="hint">{share.toLocaleString("it-IT", { maximumFractionDigits: 1 })}% quota</span>
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

function formatTrendHint(month: SalesStatsMonth) {
  if (month.trend === "new") {
    return `Primo movimento rispetto al mese precedente (${formatCurrency(month.deltaRevenueCents)})`;
  }

  if (month.trend === "flat") {
    return "Andamento stabile rispetto al mese precedente";
  }

  const sign = month.deltaRevenueCents > 0 ? "+" : "";
  return `${sign}${formatCurrency(month.deltaRevenueCents)} rispetto al mese precedente`;
}

function getTrendTone(trend: SalesStatsTrend) {
  if (trend === "up") {
    return "up" as const;
  }

  if (trend === "down") {
    return "down" as const;
  }

  if (trend === "new") {
    return "new" as const;
  }

  return "neutral" as const;
}
