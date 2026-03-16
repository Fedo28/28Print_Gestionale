import Link from "next/link";
import { PageHeader } from "@/components/page-header";
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
  orders: Awaited<ReturnType<typeof getProductionQueues>>["toStart"];
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
              <Link className="order-code" href={`/orders/${order.id}`}>
                {order.orderCode}
              </Link>
              <div className="subtle">
                {order.customer.name} - {formatDateTime(order.deliveryAt)}
              </div>
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
        description="Ordini da avviare, in lavorazione, bloccati e pronti al ritiro."
      />

      <div className="grid grid-2">
        <QueueColumn description="Ordini pronti per partire" orders={queues.toStart} title="Da iniziare" />
        <QueueColumn description="Produzione attiva" orders={queues.working} title="In lavorazione" />
        <QueueColumn description="Ordini sospesi" orders={queues.blocked} title="Bloccati" />
        <QueueColumn description="Pronti da ritirare" orders={queues.ready} title="Pronti" />
      </div>
    </div>
  );
}
