import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteCustomerAction, updateCustomerAction } from "@/app/actions";
import { HistoryBackButton } from "@/components/history-back-button";
import { PageHeader } from "@/components/page-header";
import { StatusPills } from "@/components/status-pills";
import { getEntityAuditTrail } from "@/lib/audit-log";
import { requireAuth } from "@/lib/auth";
import {
  billboardAssetKindLabels,
  billboardBookingStatusLabels,
  customerTypeLabels,
  purchaseNoteUrgencyLabels
} from "@/lib/constants";
import { formatCurrency, formatDate, formatDateKey, formatDateTime } from "@/lib/format";
import { getDisplayOrderLabel } from "@/lib/order-display";
import { getCustomerById } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  await requireAuth();
  const customer = await getCustomerById(params.id);

  if (!customer) {
    notFound();
  }

  const recentActivity = await getEntityAuditTrail("CUSTOMER", customer.id, { limit: 6 });
  const customerOrders = customer.orders.filter((order) => !order.isQuote);
  const customerQuotes = customer.orders.filter((order) => order.isQuote);
  const pendingNotes = customer.purchaseNotes.filter((note) => !note.completedAt);
  const completedNotes = customer.purchaseNotes.filter((note) => Boolean(note.completedAt));
  const canDeleteCustomer = customer.orders.length === 0 && customer.billboardBookings.length === 0;
  const lastCustomerUpdate = recentActivity[0]?.createdAt || customer.updatedAt;
  const contactChips = [
    customer.phone ? customer.phone : null,
    customer.whatsapp && customer.whatsapp !== customer.phone ? `WA ${customer.whatsapp}` : null,
    customer.email ? customer.email : null,
    customer.pec ? `PEC ${customer.pec}` : null,
    customer.vatNumber ? `P. IVA ${customer.vatNumber}` : null,
    customer.taxCode ? `CF ${customer.taxCode}` : null
  ].filter((value): value is string => Boolean(value));

  return (
    <div className="stack customer-detail-shell">
      <PageHeader
        title={customer.name}
        action={
          <div className="button-row customer-detail-header-actions">
            <Link className="button secondary" href={`/orders/new?customerId=${customer.id}`}>
              Nuovo ordine
            </Link>
            <Link className="button secondary" href={`/quotes/new?customerId=${customer.id}`}>
              Nuovo preventivo
            </Link>
            <HistoryBackButton className="button ghost" fallbackHref="/customers" label="Torna ai clienti" />
          </div>
        }
      />

      <section className="card card-pad customer-detail-overview-card">
        <div className="customer-detail-overview-head">
          <div className="customer-detail-overview-copy">
            <span className="compact-kicker">Scheda cliente</span>
            <span className="pill">{customerTypeLabels[customer.type]}</span>
            <strong>{customer.name}</strong>
            <span className="subtle">
              {contactChips[0] || "Nessun contatto rapido disponibile"} • Aggiornato il {formatDateTime(lastCustomerUpdate)}
            </span>
          </div>
          <div className="customer-detail-overview-actions">
            <Link className="compact-link" href="#customer-orders-panel">
              Ordini
            </Link>
            <Link className="compact-link" href="#customer-quotes-panel">
              Preventivi
            </Link>
            <Link className="compact-link" href="#customer-purchase-notes-panel">
              Da ordinare
            </Link>
            <Link className="compact-link" href="#customer-billboards-panel">
              Cartelloni
            </Link>
            <Link className="compact-link" href="/activity/trash" prefetch={false}>
              Cestino
            </Link>
          </div>
        </div>

        <div className="customer-detail-stat-grid">
          <div className="customer-detail-stat">
            <span>Ordini</span>
            <strong>{customerOrders.length}</strong>
          </div>
          <div className="customer-detail-stat">
            <span>Preventivi</span>
            <strong>{customerQuotes.length}</strong>
          </div>
          <div className="customer-detail-stat">
            <span>Da ordinare aperti</span>
            <strong>{pendingNotes.length}</strong>
          </div>
          <div className="customer-detail-stat">
            <span>Cartelloni</span>
            <strong>{customer.billboardBookings.length}</strong>
          </div>
        </div>

        <div className="customer-detail-contact-row">
          {contactChips.length > 0 ? (
            contactChips.map((chip) => (
              <span className="customer-detail-contact-chip" key={chip}>
                {chip}
              </span>
            ))
          ) : (
            <span className="customer-detail-contact-chip is-muted">Completa i recapiti per trovarlo e contattarlo piu velocemente.</span>
          )}
        </div>
      </section>

      <div className="grid grid-2 customer-detail-grid">
        <section className="card card-pad">
          <div className="list-header customer-detail-section-head">
            <div>
              <span className="compact-kicker">Anagrafica</span>
              <h3>Aggiorna cliente</h3>
            </div>
          </div>
          <form action={updateCustomerAction} className="form-grid">
            <input name="id" type="hidden" value={customer.id} />
            <div className="field wide">
              <label htmlFor="name">Nome / Ragione sociale</label>
              <input defaultValue={customer.name} id="name" name="name" required />
            </div>
            <div className="field">
              <label htmlFor="type">Tipo cliente</label>
              <select defaultValue={customer.type} id="type" name="type">
                {Object.entries(customerTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="phone">Telefono</label>
              <input defaultValue={customer.phone || ""} id="phone" name="phone" placeholder="Facoltativo" />
            </div>
            <div className="field">
              <label htmlFor="whatsapp">WhatsApp</label>
              <input defaultValue={customer.whatsapp || ""} id="whatsapp" name="whatsapp" />
            </div>
            <div className="field wide">
              <label htmlFor="email">Email</label>
              <input defaultValue={customer.email || ""} id="email" name="email" type="email" />
            </div>
            <div className="field wide">
              <label htmlFor="pec">PEC</label>
              <input defaultValue={customer.pec || ""} id="pec" name="pec" type="email" />
            </div>
            <div className="field">
              <label htmlFor="vatNumber">P. IVA</label>
              <input defaultValue={customer.vatNumber || ""} id="vatNumber" name="vatNumber" />
            </div>
            <div className="field">
              <label htmlFor="taxCode">Codice fiscale</label>
              <input defaultValue={customer.taxCode || ""} id="taxCode" name="taxCode" />
            </div>
            <div className="field">
              <label htmlFor="uniqueCode">Codice univoco (CU)</label>
              <input defaultValue={customer.uniqueCode || ""} id="uniqueCode" name="uniqueCode" />
            </div>
            <div className="field full">
              <label htmlFor="notes">Note</label>
              <textarea defaultValue={customer.notes || ""} id="notes" name="notes" />
            </div>
            <div className="button-row customer-form-actions">
              <button className="primary" type="submit">
                Salva modifiche
              </button>
            </div>
          </form>
        </section>

        <section className="card card-pad">
          <div className="list-header customer-detail-section-head" id="customer-history-panel">
            <div>
              <span className="compact-kicker">Cronologia</span>
              <h3>Ultime modifiche</h3>
            </div>
            <span className="pill">{recentActivity.length}</span>
          </div>
          <div className="mini-list">
            {recentActivity.length === 0 ? (
              <div className="empty">Nessuna modifica registrata su questa scheda.</div>
            ) : (
              recentActivity.map((entry) => (
                <article className="mini-item" key={entry.id}>
                  <div className="list-header">
                    <strong>{entry.title}</strong>
                    <span>{formatDateTime(entry.createdAt)}</span>
                  </div>
                  <div className="customer-detail-activity-meta">
                    <span className="pill">{entry.categoryLabel}</span>
                    {entry.actorLabel ? <span className="subtle">{entry.actorLabel}</span> : null}
                  </div>
                  {entry.details ? <div className="subtle">{entry.details}</div> : null}
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-2 customer-detail-grid">
        <section className="card card-pad" id="customer-orders-panel">
          <div className="list-header customer-detail-section-head">
            <div>
              <span className="compact-kicker">Operativo</span>
              <h3>Ordini</h3>
            </div>
            <span className="pill">{customerOrders.length}</span>
          </div>
          <div className="mini-list">
            {customerOrders.length === 0 ? (
              <div className="empty">Nessun ordine collegato.</div>
            ) : (
              customerOrders.map((order) => (
                <article className="mini-item" key={order.id}>
                  <div className="list-header">
                    <Link href={`/orders/${order.id}`} prefetch={false}>
                      <strong>{getDisplayOrderLabel(order.orderCode, order.title)}</strong>
                    </Link>
                    <span>{formatCurrency(order.totalCents)}</span>
                  </div>
                  {order.title && order.title !== getDisplayOrderLabel(order.orderCode, order.title) ? (
                    <div className="subtle">{order.title}</div>
                  ) : null}
                  <div className="subtle">{formatDateTime(order.deliveryAt)}</div>
                  <StatusPills
                    isQuote={order.isQuote}
                    phase={order.mainPhase}
                    status={order.operationalStatus}
                    payment={order.paymentStatus}
                  />
                </article>
              ))
            )}
          </div>
        </section>

        <section className="card card-pad" id="customer-quotes-panel">
          <div className="list-header customer-detail-section-head">
            <div>
              <span className="compact-kicker">Commerciale</span>
              <h3>Preventivi</h3>
            </div>
            <span className="pill">{customerQuotes.length}</span>
          </div>
          <div className="mini-list">
            {customerQuotes.length === 0 ? (
              <div className="empty">Nessun preventivo collegato.</div>
            ) : (
              customerQuotes.map((order) => (
                <article className="mini-item" key={order.id}>
                  <div className="list-header">
                    <Link href={`/orders/${order.id}`} prefetch={false}>
                      <strong>{getDisplayOrderLabel(order.orderCode, order.title)}</strong>
                    </Link>
                    <span>{formatCurrency(order.totalCents)}</span>
                  </div>
                  {order.title && order.title !== getDisplayOrderLabel(order.orderCode, order.title) ? (
                    <div className="subtle">{order.title}</div>
                  ) : null}
                  <div className="subtle">{formatDateTime(order.deliveryAt)}</div>
                  <StatusPills
                    isQuote={order.isQuote}
                    phase={order.mainPhase}
                    status={order.operationalStatus}
                    payment={order.paymentStatus}
                  />
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-2 customer-detail-grid">
        <section className="card card-pad" id="customer-purchase-notes-panel">
          <div className="list-header customer-detail-section-head">
            <div>
              <span className="compact-kicker">Acquisti</span>
              <h3>Da ordinare</h3>
            </div>
            <span className="pill">{pendingNotes.length} aperte</span>
            <Link className="compact-link" href="/purchase-notes" prefetch={false}>
              Apri lista
            </Link>
          </div>
          <div className="mini-list">
            {customer.purchaseNotes.length === 0 ? (
              <div className="empty">Nessuna nota da ordinare collegata.</div>
            ) : (
              customer.purchaseNotes.map((note) => (
                <article className="mini-item" key={note.id}>
                  <div className="list-header">
                    <strong>{note.completedAt ? "Ordinato" : "Da fare"}</strong>
                    <span>{formatDateTime(note.completedAt || note.updatedAt)}</span>
                  </div>
                  <div className="customer-detail-activity-meta">
                    <span className={`pill ${note.urgency === "BLOCCANTE" ? "danger" : note.urgency === "URGENTE" ? "warning" : ""}`}>
                      {purchaseNoteUrgencyLabels[note.urgency]}
                    </span>
                    {note.order ? (
                      <Link className="compact-link" href={`/orders/${note.order.id}`} prefetch={false}>
                        {note.order.orderCode}
                      </Link>
                    ) : null}
                  </div>
                  <p className="customer-detail-note-copy">{note.content}</p>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="card card-pad" id="customer-billboards-panel">
          <div className="list-header customer-detail-section-head">
            <div>
              <span className="compact-kicker">Impianti</span>
              <h3>Cartelloni e monitor</h3>
            </div>
            <span className="pill">{customer.billboardBookings.length}</span>
          </div>
          <div className="mini-list">
            {customer.billboardBookings.length === 0 ? (
              <div className="empty">Nessuna prenotazione cartelloni collegata.</div>
            ) : (
              customer.billboardBookings.map((booking) => (
                <article className="mini-item" key={booking.id}>
                  <div className="list-header">
                    <Link href={`/billboards?date=${formatDateKey(booking.startsAt)}`} prefetch={false}>
                      <strong>{booking.billboardAsset.name}</strong>
                    </Link>
                    <span>{formatCurrency(booking.priceCents)}</span>
                  </div>
                  <div className="customer-detail-activity-meta">
                    <span className="pill status">{billboardAssetKindLabels[booking.billboardAsset.kind]}</span>
                    <span className="pill">{billboardBookingStatusLabels[booking.status]}</span>
                    {booking.monitorSlot ? <span className="subtle">{`Slot ${booking.monitorSlot}`}</span> : null}
                  </div>
                  <div className="subtle">
                    {booking.billboardAsset.code} • {formatDate(booking.startsAt)} - {formatDate(booking.endsAt)}
                  </div>
                  <div className="subtle">{`Pagato ${formatCurrency(booking.paidCents)} • Residuo ${formatCurrency(booking.balanceDueCents)}`}</div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="card card-pad danger-zone customer-detail-danger-card">
        <div className="stack">
          <div>
            <span className="compact-kicker">Zona delicata</span>
            <h3>Eliminazione cliente</h3>
            <span className="subtle">Disponibile solo se non ci sono collegamenti attivi.</span>
          </div>
          <form action={deleteCustomerAction} className="danger-zone-actions">
            <input name="id" type="hidden" value={customer.id} />
            <button className="secondary" disabled={!canDeleteCustomer} type="submit">
              Elimina cliente
            </button>
          </form>
          {!canDeleteCustomer ? (
            <p className="hint">Eliminazione bloccata: il cliente ha ordini, preventivi o cartelloni collegati.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
