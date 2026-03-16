import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatusPills } from "@/components/status-pills";
import { requireAuth } from "@/lib/auth";
import { formatCurrency, formatDateKey, formatDateTime } from "@/lib/format";
import { getCalendarOrders } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  await requireAuth();
  const orders = await getCalendarOrders();
  const groups = orders.reduce<Record<string, typeof orders>>((acc, order) => {
    const key = formatDateKey(order.deliveryAt);
    acc[key] = acc[key] || [];
    acc[key].push(order);
    return acc;
  }, {});

  return (
    <div className="stack">
      <PageHeader
        title="Calendario"
        description="Vista per data promessa e priorita, utile per pianificare consegne e picchi di produzione."
      />

      <div className="stack">
        {Object.entries(groups).length === 0 ? (
          <section className="card card-pad">
            <div className="empty">Nessun ordine calendarizzato.</div>
          </section>
        ) : (
          Object.entries(groups).map(([day, entries]) => (
            <section className="card card-pad" key={day}>
              <div className="list-header">
                <div>
                  <h3>{day}</h3>
                  <p className="card-muted">{entries.length} consegne previste</p>
                </div>
              </div>
              <div className="mini-list">
                {entries.map((order) => (
                  <article className="mini-item" key={order.id}>
                    <div className="list-header">
                      <Link className="order-code" href={`/orders/${order.id}`}>
                        {order.orderCode}
                      </Link>
                      <strong>{formatCurrency(order.totalCents)}</strong>
                    </div>
                    <div className="subtle">
                      {order.customer.name} - {formatDateTime(order.deliveryAt)}
                    </div>
                    <StatusPills phase={order.mainPhase} status={order.operationalStatus} payment={order.paymentStatus} />
                  </article>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
