import Link from "next/link";
import { notFound } from "next/navigation";
import {
  deleteOrderAction,
  markReadyAction,
  recordPaymentAction,
  transitionPhaseAction,
  updateOrderAction,
  updateOrderStatusAction
} from "@/app/actions";
import { ReadyWhatsAppButton } from "@/components/ready-whatsapp-button";
import { PageHeader } from "@/components/page-header";
import { StatusPills } from "@/components/status-pills";
import { requireAuth } from "@/lib/auth";
import {
  invoiceStatusLabels,
  mainPhaseLabels,
  operationalStatusLabels,
  paymentMethodLabels,
  paymentStatusLabels,
  priorityLabels
} from "@/lib/constants";
import { formatCurrency, formatDateTime, toDateTimeLocalInput } from "@/lib/format";
import { getOrderById } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  await requireAuth();
  const order = await getOrderById(params.id);

  if (!order) {
    notFound();
  }

  return (
    <div className="stack">
      <PageHeader
        title={order.orderCode}
        description={`Titolo corrente: ${order.title}`}
        action={
          <div className="button-row">
            <Link className="button ghost" href="/orders">
              Torna agli ordini
            </Link>
            <ReadyWhatsAppButton
              hasPhone={Boolean(order.customer.whatsapp || order.customer.phone)}
              orderId={order.id}
            />
          </div>
        }
      />

      <section className="hero-strip">
        <article className="card card-pad hero-card order-hero-card">
          <div className="stack">
            <div className="list-header">
              <div>
                <h3>{order.customer.name}</h3>
                <p className="card-muted">{order.customer.phone}</p>
              </div>
              <StatusPills phase={order.mainPhase} status={order.operationalStatus} payment={order.paymentStatus} />
            </div>

            <div className="grid grid-4 order-metric-grid">
              <div className="metric">
                <span className="subtle">Totale</span>
                <strong>{formatCurrency(order.totalCents)}</strong>
              </div>
              <div className="metric">
                <span className="subtle">Acconto</span>
                <strong>{formatCurrency(order.depositCents)}</strong>
              </div>
              <div className="metric">
                <span className="subtle">Pagato</span>
                <strong>{formatCurrency(order.paidCents)}</strong>
              </div>
              <div className="metric">
                <span className="subtle">Residuo</span>
                <strong>{formatCurrency(order.balanceDueCents)}</strong>
              </div>
            </div>

            <div className="toolbar status-cluster">
              <span className="pill phase">{mainPhaseLabels[order.mainPhase]}</span>
              <span className="pill status">{operationalStatusLabels[order.operationalStatus]}</span>
              <span className="pill warning">{paymentStatusLabels[order.paymentStatus]}</span>
              <span className="pill">{invoiceStatusLabels[order.invoiceStatus]}</span>
              <span className="pill">{priorityLabels[order.priority]}</span>
            </div>
          </div>
        </article>

        <article className="card card-pad action-panel">
          <div className="stack">
            <div>
              <h3>Ritiro e produzione</h3>
              <p className="card-muted">Consegna prevista {formatDateTime(order.deliveryAt)}</p>
            </div>
            <p className="hint action-note">{order.notes || "Nessuna nota interna."}</p>
            <div className="button-row action-row">
              <form action={transitionPhaseAction} className="action-form">
                <input name="orderId" type="hidden" value={order.id} />
                <input name="nextPhase" type="hidden" value="CALENDARIZZATO" />
                <button className="secondary" type="submit">
                  Porta a calendarizzato
                </button>
              </form>
              <form action={transitionPhaseAction} className="action-form">
                <input name="orderId" type="hidden" value={order.id} />
                <input name="nextPhase" type="hidden" value="IN_LAVORAZIONE" />
                <button className="secondary" type="submit">
                  Porta in lavorazione
                </button>
              </form>
              <form action={markReadyAction} className="action-form">
                <input name="orderId" type="hidden" value={order.id} />
                <button className="success" type="submit">
                  Segna pronto
                </button>
              </form>
              <form action={transitionPhaseAction} className="action-form action-form-wide">
                <input name="orderId" type="hidden" value={order.id} />
                <input name="nextPhase" type="hidden" value="CONSEGNATO" />
                <input aria-label="Nota override consegna" name="note" placeholder="Nota override se c'e saldo aperto" />
                <button className="primary" type="submit">
                  Segna consegnato
                </button>
              </form>
            </div>
          </div>
        </article>
      </section>

      <div className="grid grid-2">
        <section className="card card-pad">
          <h3>Dettagli ordine</h3>
          <form action={updateOrderAction} className="form-grid">
            <input name="id" type="hidden" value={order.id} />
            <div className="field wide">
              <label htmlFor="title">Titolo</label>
              <input defaultValue={order.title} id="title" name="title" required />
            </div>
            <div className="field">
              <label htmlFor="deliveryAt">Consegna</label>
              <input defaultValue={toDateTimeLocalInput(order.deliveryAt)} id="deliveryAt" name="deliveryAt" type="datetime-local" required />
            </div>
            <div className="field">
              <label htmlFor="priority">Priorita</label>
              <select defaultValue={order.priority} id="priority" name="priority">
                {Object.entries(priorityLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="invoiceStatus">Stato fatturazione</label>
              <select defaultValue={order.invoiceStatus} id="invoiceStatus" name="invoiceStatus">
                {Object.entries(invoiceStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field full">
              <label htmlFor="notes">Note interne</label>
              <textarea defaultValue={order.notes || ""} id="notes" name="notes" />
            </div>
            <div className="button-row">
              <button className="primary" type="submit">
                Aggiorna ordine
              </button>
            </div>
          </form>
        </section>

        <section className="card card-pad">
          <div className="stack">
            <div>
              <h3>Stato operativo</h3>
              <p className="card-muted">Blocchi e attese non alterano il codice ordine.</p>
            </div>
            <form action={updateOrderStatusAction} className="form-grid">
              <input name="orderId" type="hidden" value={order.id} />
              <div className="field">
                <label htmlFor="operationalStatus">Stato</label>
                <select defaultValue={order.operationalStatus} id="operationalStatus" name="operationalStatus">
                  {Object.entries(operationalStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field wide">
                <label htmlFor="statusNote">Nota</label>
                <input id="statusNote" name="note" placeholder="Motivo blocco o dettaglio operativo" />
              </div>
              <div className="button-row">
                <button className="secondary" type="submit">
                  Salva stato operativo
                </button>
              </div>
            </form>
            <form action={deleteOrderAction}>
              <input name="id" type="hidden" value={order.id} />
              <button className="secondary" type="submit">
                Elimina ordine
              </button>
            </form>
          </div>
        </section>
      </div>

      <div className="grid grid-3">
        <section className="card card-pad">
          <h3>Righe ordine</h3>
          <div className="mini-list">
            {order.items.map((item) => (
              <article className="mini-item" key={item.id}>
                <div className="list-header">
                  <strong>{item.label}</strong>
                  <span>{formatCurrency(item.lineTotalCents)}</span>
                </div>
                <div className="subtle">
                  {item.quantity} x {formatCurrency(item.unitPriceCents)}
                </div>
                <div className="subtle">{[item.format, item.material, item.finishing].filter(Boolean).join(" - ") || "Lavorazione personalizzata"}</div>
              </article>
            ))}
          </div>
        </section>

        <section className="card card-pad">
          <h3>Pagamenti</h3>
          <form action={recordPaymentAction} className="form-grid">
            <input name="orderId" type="hidden" value={order.id} />
            <div className="field">
              <label htmlFor="amount">Importo</label>
              <input id="amount" name="amount" placeholder="0,00" required />
            </div>
            <div className="field">
              <label htmlFor="method">Metodo</label>
              <select id="method" name="method">
                {Object.entries(paymentMethodLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field wide">
              <label htmlFor="paymentNote">Nota</label>
              <input id="paymentNote" name="note" placeholder="Acconto, saldo, riferimento cassa" />
            </div>
            <div className="button-row">
              <button className="primary" type="submit">
                Registra pagamento
              </button>
            </div>
          </form>

          <div className="mini-list">
            {order.payments.length === 0 ? (
              <div className="empty">Nessun pagamento registrato.</div>
            ) : (
              order.payments.map((payment) => (
                <article className="mini-item" key={payment.id}>
                  <div className="list-header">
                    <strong>{formatCurrency(payment.amountCents)}</strong>
                    <span>{paymentMethodLabels[payment.method]}</span>
                  </div>
                  <div className="subtle">{formatDateTime(payment.createdAt)}</div>
                  <div className="subtle">{payment.note || "Nessuna nota"}</div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="card card-pad">
          <h3>Allegati</h3>
          <form
            action={`/api/orders/${order.id}/attachments`}
            className="stack"
            encType="multipart/form-data"
            method="post"
          >
            <input name="file" required type="file" />
            <button className="secondary" type="submit">
              Carica allegato
            </button>
          </form>
          <div className="mini-list">
            {order.attachments.length === 0 ? (
              <div className="empty">Nessun file caricato.</div>
            ) : (
              order.attachments.map((attachment) => (
                <a className="mini-item" href={attachment.filePath} key={attachment.id} rel="noreferrer" target="_blank">
                  <strong>{attachment.fileName}</strong>
                  <span className="subtle">{formatDateTime(attachment.createdAt)}</span>
                </a>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="card card-pad">
        <h3>Cronologia</h3>
        <div className="timeline">
          {order.history.map((entry) => (
            <article className="timeline-item" key={entry.id}>
              <div className="list-header">
                <strong>{entry.description}</strong>
                <span className="subtle">{formatDateTime(entry.createdAt)}</span>
              </div>
              {entry.details ? <div className="subtle">{entry.details}</div> : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
