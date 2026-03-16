import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatusPills } from "@/components/status-pills";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { getDashboardData } from "@/lib/orders";

export async function DashboardPage() {
  const { todayOrders, overdueOrders, blockedOrders, readyOrders, balanceOrders } = await getDashboardData();
  const nextDelivery = todayOrders[0];
  const topReady = readyOrders[0];
  const blockedSample = blockedOrders[0];

  return (
    <div className="stack">
      <PageHeader
        title="Dashboard"
        description="Vista operativa giornaliera con consegne, blocchi, ordini pronti e incassi da chiudere."
        action={
          <Link className="button primary" href="/orders/new">
            Registra nuovo ordine
          </Link>
        }
      />

      <section className="dashboard-hero">
        <article className="card card-pad hero-card dashboard-hero-card">
          <div className="hero-chip">Liquid glass workspace</div>
          <div className="stack">
            <div>
              <h3>Vista immediata del banco, con priorita e ritiri sempre in primo piano.</h3>
              <p className="card-muted">
                Un cruscotto unico per presidiare produzione, consegne, blocchi e saldi aperti senza perdere contesto.
              </p>
            </div>
            <div className="hero-highlight-grid">
              <div className="hero-highlight">
                <span className="subtle">Consegne oggi</span>
                <strong>{todayOrders.length}</strong>
                <span className="hint">Ordini da seguire in giornata</span>
              </div>
              <div className="hero-highlight">
                <span className="subtle">Pronti al ritiro</span>
                <strong>{readyOrders.length}</strong>
                <span className="hint">Ordini gia completati</span>
              </div>
              <div className="hero-highlight">
                <span className="subtle">Saldi aperti</span>
                <strong>{balanceOrders.length}</strong>
                <span className="hint">Incassi da chiudere</span>
              </div>
            </div>
          </div>
        </article>

        <article className="card card-pad dashboard-spotlight">
          <div className="stack">
            <div>
              <h3>Focus immediato</h3>
              <p className="card-muted">Tre segnali rapidi per capire dove intervenire adesso.</p>
            </div>
            <div className="mini-list">
              <article className="mini-item">
                <span className="subtle">Prossima consegna</span>
                <strong>{nextDelivery ? nextDelivery.orderCode : "Nessuna in scadenza"}</strong>
                <span className="hint">
                  {nextDelivery ? `${nextDelivery.customer.name} - ${formatDateTime(nextDelivery.deliveryAt)}` : "Il calendario di oggi e sotto controllo."}
                </span>
              </article>
              <article className="mini-item">
                <span className="subtle">Pronto piu rilevante</span>
                <strong>{topReady ? topReady.orderCode : "Nessun ordine pronto"}</strong>
                <span className="hint">
                  {topReady ? `${topReady.customer.name} - Residuo ${formatCurrency(topReady.balanceDueCents)}` : "Nessun ritiro in attesa."}
                </span>
              </article>
              <article className="mini-item">
                <span className="subtle">Nodo operativo</span>
                <strong>{blockedSample ? blockedSample.orderCode : "Nessun blocco attivo"}</strong>
                <span className="hint">
                  {blockedSample ? `${blockedSample.customer.name} - ${formatDateTime(blockedSample.deliveryAt)}` : "Nessun ordine bloccato in questo momento."}
                </span>
              </article>
            </div>
          </div>
        </article>
      </section>

      <section className="grid grid-4">
        <article className="card card-pad metric metric-card">
          <span className="subtle">Consegne di oggi</span>
          <strong>{todayOrders.length}</strong>
          <span className="subtle">Ordini da presidiare in giornata</span>
        </article>
        <article className="card card-pad metric metric-card">
          <span className="subtle">In ritardo</span>
          <strong>{overdueOrders.length}</strong>
          <span className="subtle">Priorita da riallineare</span>
        </article>
        <article className="card card-pad metric metric-card">
          <span className="subtle">Bloccati</span>
          <strong>{blockedOrders.length}</strong>
          <span className="subtle">In attesa file o approvazione</span>
        </article>
        <article className="card card-pad metric metric-card">
          <span className="subtle">Saldi aperti</span>
          <strong>{balanceOrders.length}</strong>
          <span className="subtle">Ordini con residuo da incassare</span>
        </article>
      </section>

      <section className="grid grid-2">
        <article className="card card-pad">
          <div className="list-header">
            <div>
              <h3>Ordini in consegna oggi</h3>
              <p className="card-muted">Pianificazione immediata del banco.</p>
            </div>
          </div>
          <div className="mini-list">
            {todayOrders.length === 0 ? (
              <div className="empty">Nessuna consegna prevista oggi.</div>
            ) : (
              todayOrders.slice(0, 6).map((order) => (
                <article className="mini-item" key={order.id}>
                  <div className="list-header">
                    <Link className="order-code" href={`/orders/${order.id}`}>
                      {order.orderCode}
                    </Link>
                    <span>{formatCurrency(order.totalCents)}</span>
                  </div>
                  <div className="subtle">
                    {order.customer.name} - {formatDateTime(order.deliveryAt)}
                  </div>
                  <StatusPills phase={order.mainPhase} status={order.operationalStatus} payment={order.paymentStatus} />
                </article>
              ))
            )}
          </div>
        </article>

        <article className="card card-pad">
          <div className="list-header">
            <div>
              <h3>Pronti al ritiro</h3>
              <p className="card-muted">Ordini segnati pronti e in attesa del cliente.</p>
            </div>
          </div>
          <div className="mini-list">
            {readyOrders.length === 0 ? (
              <div className="empty">Nessun ordine pronto.</div>
            ) : (
              readyOrders.slice(0, 6).map((order) => (
                <article className="mini-item" key={order.id}>
                  <div className="list-header">
                    <Link className="order-code" href={`/orders/${order.id}`}>
                      {order.orderCode}
                    </Link>
                    <span>Residuo {formatCurrency(order.balanceDueCents)}</span>
                  </div>
                  <div className="subtle">{order.customer.name}</div>
                  <StatusPills phase={order.mainPhase} status={order.operationalStatus} payment={order.paymentStatus} />
                </article>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="grid grid-2">
        <article className="card card-pad">
          <div className="list-header">
            <div>
              <h3>Ordini bloccati</h3>
              <p className="card-muted">Da sbloccare con file o approvazione cliente.</p>
            </div>
          </div>
          <div className="mini-list">
            {blockedOrders.length === 0 ? (
              <div className="empty">Nessun ordine bloccato.</div>
            ) : (
              blockedOrders.slice(0, 6).map((order) => (
                <article className="mini-item" key={order.id}>
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
        </article>

        <article className="card card-pad">
          <div className="list-header">
            <div>
              <h3>Saldi aperti</h3>
              <p className="card-muted">Da presidiare al momento del ritiro.</p>
            </div>
          </div>
          <div className="mini-list">
            {balanceOrders.length === 0 ? (
              <div className="empty">Nessun saldo aperto.</div>
            ) : (
              balanceOrders.slice(0, 6).map((order) => (
                <article className="mini-item" key={order.id}>
                  <div className="list-header">
                    <Link className="order-code" href={`/orders/${order.id}`}>
                      {order.orderCode}
                    </Link>
                    <span>{formatCurrency(order.balanceDueCents)}</span>
                  </div>
                  <div className="subtle">{order.customer.name}</div>
                  <StatusPills phase={order.mainPhase} status={order.operationalStatus} payment={order.paymentStatus} />
                </article>
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
