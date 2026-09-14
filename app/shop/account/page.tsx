import Link from "next/link";
import { redirect } from "next/navigation";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { requireCustomerAccountAuth } from "@/lib/customer-account-auth";
import { getCustomerAccountDashboard } from "@/lib/customer-accounts";
import { listCustomerAccountShopOrders } from "@/lib/shop-orders";

export const dynamic = "force-dynamic";

const salesOrderStatusLabels = {
  DRAFT: "Bozza",
  PENDING_PAYMENT: "In attesa di pagamento",
  PAID: "Pagato",
  PAYMENT_FAILED: "Pagamento fallito",
  CANCELLED: "Annullato",
  FULFILLED: "Completato"
} as const;

export default async function ShopAccountPage() {
  const session = await requireCustomerAccountAuth();
  const [account, recentOrders] = await Promise.all([
    getCustomerAccountDashboard(session.customerAccountId),
    listCustomerAccountShopOrders(session.customerAccountId)
  ]);

  if (!account) {
    redirect("/shop/account/login");
  }

  return (
    <div className="shop-page-shell">
      <section className="shop-card">
        <div className="shop-config-page-head">
          <div>
            <span className="shop-kicker">Area cliente</span>
            <h1>{account.customer.name}</h1>
            <div className="subtle">{account.email}</div>
          </div>
          <div className="button-row">
            <Link className="button primary" href="/shop/stampa-documenti">
              Nuovo ordine
            </Link>
          </div>
        </div>
      </section>

      <section className="shop-card">
        <div className="list-header">
          <div>
            <h3>Panoramica</h3>
          </div>
        </div>

        <div className="shop-inline-metrics">
          <article className="mini-item">
            <strong>Ordini</strong>
            <div className="subtle">{account._count.salesOrders}</div>
          </article>
          <article className="mini-item">
            <strong>File caricati</strong>
            <div className="subtle">{account.customer._count.fileAssets}</div>
          </article>
        </div>
      </section>

      <section className="shop-card">
        <div className="list-header">
          <div>
            <h3>Ordini recenti</h3>
          </div>
          <span className="pill">{recentOrders.length}</span>
        </div>

        {recentOrders.length ? (
          <div className="shop-order-list">
            {recentOrders.map((order) => {
              const primaryItem = order.items[0];

              return (
                <article className="mini-item" key={order.id}>
                  <div className="shop-order-list-head">
                    <div>
                      <strong>{order.orderCode}</strong>
                      <div className="subtle">{primaryItem ? primaryItem.label : "Ordine shop"}</div>
                    </div>
                    <div className="shop-order-list-aside">
                      <span className="pill">{salesOrderStatusLabels[order.status] || order.status}</span>
                      <strong>{formatCurrency(order.totalCents)}</strong>
                    </div>
                  </div>
                  <div className="hint">
                    {formatDateTime(order.createdAt)}
                    {order.invoiceRequested ? " • fattura" : ""}
                  </div>
                  <div className="button-row">
                    <Link className="button ghost" href={`/shop/orders/${order.id}`}>
                      Apri ordine
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty">Nessun ordine.</div>
        )}
      </section>
    </div>
  );
}
