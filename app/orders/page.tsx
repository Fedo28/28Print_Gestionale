import { MainPhase, OperationalStatus } from "@prisma/client";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatusPills } from "@/components/status-pills";
import { requireAuth } from "@/lib/auth";
import { mainPhaseLabels, operationalStatusLabels, priorityLabels } from "@/lib/constants";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { getOrdersList } from "@/lib/orders";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: {
    q?: string;
    phase?: MainPhase | "ALL";
    status?: OperationalStatus | "ALL";
  };
};

export default async function OrdersPage({ searchParams }: Props) {
  await requireAuth();
  const orders = await getOrdersList({
    query: searchParams?.q,
    phase: searchParams?.phase,
    status: searchParams?.status
  });

  return (
    <div className="stack">
      <PageHeader
        title="Ordini"
        description="Ricerca per codice, titolo, cliente e telefono. Ordinamento per consegna e priorita."
        action={
          <Link className="button primary" href="/orders/new">
            Nuovo ordine
          </Link>
        }
      />

      <section className="card card-pad">
        <form className="toolbar filters-bar" method="get">
          <div className="filters-grow">
            <input
              aria-label="Ricerca ordini"
              defaultValue={searchParams?.q}
              name="q"
              placeholder="Cerca codice, titolo, cliente o telefono"
            />
          </div>
          <div className="filters-field">
            <select aria-label="Fase" defaultValue={searchParams?.phase || "ALL"} name="phase">
              <option value="ALL">Tutte le fasi</option>
              {Object.entries(mainPhaseLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="filters-field">
            <select aria-label="Stato operativo" defaultValue={searchParams?.status || "ALL"} name="status">
              <option value="ALL">Tutti gli stati</option>
              {Object.entries(operationalStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <button className="secondary" type="submit">
            Filtra
          </button>
        </form>
      </section>

      <section className="card card-pad table-wrap orders-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ordine</th>
              <th>Cliente</th>
              <th>Consegna</th>
              <th>Priorita</th>
              <th>Stato</th>
              <th>Importi</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="empty">Nessun ordine trovato.</div>
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link href={`/orders/${order.id}`}>
                      <div className="order-code">{order.orderCode}</div>
                    </Link>
                    <div className="subtle">{order.title}</div>
                  </td>
                  <td>
                    <strong>{order.customer.name}</strong>
                    <div className="subtle">{order.customer.phone}</div>
                  </td>
                  <td>{formatDateTime(order.deliveryAt)}</td>
                  <td>{priorityLabels[order.priority]}</td>
                  <td>
                    <StatusPills phase={order.mainPhase} status={order.operationalStatus} payment={order.paymentStatus} />
                  </td>
                  <td>
                    <div className="strong">{formatCurrency(order.totalCents)}</div>
                    <div className="subtle">Residuo {formatCurrency(order.balanceDueCents)}</div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
