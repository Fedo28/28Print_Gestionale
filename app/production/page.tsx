import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { QuickOrderControls } from "@/components/quick-order-controls";
import { StatusPills } from "@/components/status-pills";
import { requireAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { getProductionQueues } from "@/lib/orders";

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
    <section className="card card-pad">
      <div className="list-header">
        <div>
          <h3>{title}</h3>
          <p className="card-muted">{description}</p>
        </div>
        <span className="pill">{orders.length}</span>
      </div>
      <div className="queue">
        {orders.length === 0 ? (
          <div className="empty">Nessun ordine in questa coda.</div>
        ) : (
          orders.map((order) => (
            <article className="queue-card" key={order.id}>
              <div className="order-inline-head">
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
              <div className="subtle">
                {order.customer.name} - {formatDateTime(order.deliveryAt)}
              </div>
              {order.operationalStatus !== "ATTIVO" ? (
                <div className="hint">{order.operationalNote || "Motivo sospensione non indicato"}</div>
              ) : null}
              <StatusPills phase={order.mainPhase} status={order.operationalStatus} payment={order.paymentStatus} />
            </article>
          ))
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
        description="Ordini da pianificare, calendarizzati, in lavorazione, sospesi e pronti al ritiro."
      />

      <div className="grid grid-2">
        <QueueColumn description="Ordini appena presi in carico" orders={queues.planning} title="Da pianificare" />
        <QueueColumn description="Ordini inseriti in agenda" orders={queues.scheduled} title="Calendarizzati" />
        <QueueColumn description="Produzione attiva" orders={queues.working} title="In lavorazione" />
        <QueueColumn description="Ordini sospesi" orders={queues.blocked} title="Sospesi" />
        <QueueColumn description="Pronti da ritirare" orders={queues.ready} title="Pronti" />
      </div>
    </div>
  );
}
