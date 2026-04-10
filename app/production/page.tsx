import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { QuickOrderControls } from "@/components/quick-order-controls";
import { StatusPills } from "@/components/status-pills";
import { requireAuth } from "@/lib/auth";
import { formatCompactDate } from "@/lib/format";
import { getProductionQueues } from "@/lib/orders";
import { getWorkdayHighlight } from "@/lib/workday-highlights";

export const dynamic = "force-dynamic";

function QueueColumn({
  title,
  description,
  orders
}: {
  title: string;
  description: string;
  orders: Awaited<ReturnType<typeof getProductionQueues>>["planning"];
}) {
  return (
    <section className="card card-pad compact-lane-card queue-column-card">
      <div className="list-header">
        <div>
          <h3>{title}</h3>
          <p className="card-muted">{description}</p>
        </div>
        <span className="pill">{orders.length}</span>
      </div>
      <div className="compact-order-list">
        {orders.length === 0 ? (
          <div className="empty">Nessun ordine in questa coda.</div>
        ) : (
          <div className="compact-order-grid compact-order-grid-dense queue-grid-dense">
            {orders.map((order) => {
            const workdayHighlight = getWorkdayHighlight(order.deliveryAt);

            return (
              <article
                className={`compact-order-item compact-order-item-dashboard compact-order-item-dense workday-highlight-card${workdayHighlight ? ` ${workdayHighlight}` : ""}`}
                key={order.id}
              >
                <div className="compact-order-main">
                  <div className="compact-order-head">
                    <QuickOrderControls
                      align="start"
                      hasWhatsapp={Boolean((order.customer.whatsapp || order.customer.phone || "").replace(/[^\d+]/g, ""))}
                      orderId={order.id}
                      phase={order.mainPhase}
                      status={order.operationalStatus}
                    />
                    <Link className="order-code" href={`/orders/${order.id}`}>
                      {order.orderCode}
                    </Link>
                  </div>
                  <div className="subtle compact-order-customer">{order.customer.name}</div>
                  <div className="hint compact-order-meta">Consegna {formatCompactDate(order.deliveryAt)}</div>
                  {workdayHighlight === "weekend" ? <div className="hint">Consegna in weekend</div> : null}
                  {order.operationalStatus !== "ATTIVO" ? (
                    <div className="hint">{order.operationalNote || "Motivo sospensione non indicato"}</div>
                  ) : null}
                </div>
                <StatusPills
                  hideNeutralStatus
                  linked={false}
                  phase={order.mainPhase}
                  payment={order.paymentStatus}
                  status={order.operationalStatus}
                />
              </article>
            );
          })}
          </div>
        )}
      </div>
    </section>
  );
}

export default async function ProductionPage() {
  await requireAuth();
  const queues = await getProductionQueues();

  return (
    <div className="stack">
      <PageHeader
        title="Produzione"
        description="Flusso rapido di laboratorio: da avviare, in lavorazione, sospesi e pronti."
      />

      <div className="grid grid-2">
        <QueueColumn description="Ordini confermati e pronti da partire" orders={queues.planning} title="Da avviare" />
        <QueueColumn description="Produzione attiva" orders={queues.working} title="In lavorazione" />
        <QueueColumn description="Ordini sospesi" orders={queues.blocked} title="Sospesi" />
        <QueueColumn description="Pronti da ritirare" orders={queues.ready} title="Pronti" />
      </div>
    </div>
  );
}
