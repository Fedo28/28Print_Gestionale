import Link from "next/link";
import { notFound } from "next/navigation";
import {
  confirmQuoteAction,
  correctPaymentAction,
  markReadyAction,
  recordPaymentAction,
  transitionPhaseAction,
  updateOrderAction,
  updateOrderStatusAction
} from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { ReadyWhatsAppButton } from "@/components/ready-whatsapp-button";
import { StatusPills } from "@/components/status-pills";
import { AttachmentUploadForm } from "@/components/attachment-upload-form";
import { DeleteOrderForm } from "@/components/delete-order-form";
import { formatAttachmentSize } from "@/lib/attachment-utils";
import { requireAuth } from "@/lib/auth";
import {
  invoiceStatusLabels,
  operationalStatusLabels,
  paymentMethodLabels,
  priorityLabels
} from "@/lib/constants";
import { formatCurrency, formatDateTime, toDateTimeLocalInput } from "@/lib/format";
import { buildOrdersFilterHref } from "@/lib/order-filters";
import { getOrderById } from "@/lib/orders";
import { formatDiscountSummary } from "@/lib/pricing";
import { resolveAttachmentStorageMode } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  await requireAuth();
  const order = await getOrderById(params.id);

  if (!order) {
    notFound();
  }

  const activePayments = order.payments.filter((payment) => payment.status === "ATTIVO");
  const guidedAction = getGuidedPhaseAction(order.mainPhase);
  const hasWhatsapp = Boolean((order.customer.whatsapp || order.customer.phone || "").replace(/[^\d+]/g, ""));
  const useDirectUpload = resolveAttachmentStorageMode() === "blob";

  return (
    <div className="stack">
      <PageHeader
        title={order.orderCode}
        description={`Titolo corrente: ${order.title}`}
        action={
          <Link className="button ghost" href={order.isQuote ? "/quotes" : "/orders"}>
            {order.isQuote ? "Torna ai preventivi" : "Torna agli ordini"}
          </Link>
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
              <StatusPills
                linked={!order.isQuote}
                isQuote={order.isQuote}
                phase={order.mainPhase}
                status={order.operationalStatus}
                payment={order.paymentStatus}
              />
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
              {order.isQuote ? (
                <span className="pill">{invoiceStatusLabels[order.invoiceStatus]}</span>
              ) : (
                <Link className="pill" href={buildOrdersFilterHref({ invoice: order.invoiceStatus })} prefetch={false}>
                  {invoiceStatusLabels[order.invoiceStatus]}
                </Link>
              )}
              {order.isQuote ? (
                <span className="pill">{priorityLabels[order.priority]}</span>
              ) : (
                <Link className="pill" href={buildOrdersFilterHref({ priority: order.priority })} prefetch={false}>
                  {priorityLabels[order.priority]}
                </Link>
              )}
              {order.isQuote ? (
                <Link className="pill quote" href="/quotes" prefetch={false}>
                  Preventivo
                </Link>
              ) : null}
            </div>
          </div>
        </article>

        <article className="card card-pad action-panel">
          <div className="stack">
            <div>
              <h3>Prossimo passo</h3>
              <p className="card-muted">Consegna prevista {formatDateTime(order.deliveryAt)}</p>
            </div>
            <p className="hint action-note">
              {order.isQuote
                ? "Questo record e un preventivo: confermalo nei dettagli per farlo entrare nel flusso operativo."
                : order.operationalStatus !== "ATTIVO"
                  ? order.operationalNote || "Ordine sospeso senza motivo specificato."
                  : order.notes || "Nessuna nota interna."}
            </p>
            {order.isQuote ? (
              <form action={confirmQuoteAction} className="action-form action-form-wide">
                <input name="orderId" type="hidden" value={order.id} />
                <button className="primary" type="submit">
                  Conferma come ordine
                </button>
              </form>
            ) : guidedAction?.kind === "transition" ? (
              <form action={transitionPhaseAction} className="action-form action-form-wide">
                <input name="orderId" type="hidden" value={order.id} />
                <input name="nextPhase" type="hidden" value={guidedAction.nextPhase} />
                <button className="primary" type="submit">
                  {guidedAction.label}
                </button>
              </form>
            ) : guidedAction?.kind === "ready" ? (
              <form action={markReadyAction} className="action-form action-form-wide">
                <input name="orderId" type="hidden" value={order.id} />
                <button className="success" type="submit">
                  Segna pronto
                </button>
              </form>
            ) : guidedAction?.kind === "deliver" ? (
              <div className="button-row action-row">
                <form action={transitionPhaseAction} className="action-form action-form-wide">
                  <input name="orderId" type="hidden" value={order.id} />
                  <input name="nextPhase" type="hidden" value="CONSEGNATO" />
                  <input
                    aria-label="Nota override consegna"
                    name="note"
                    placeholder={order.balanceDueCents > 0 ? "Nota override obbligatoria con saldo aperto" : "Nota consegna opzionale"}
                  />
                  <button className="primary" type="submit">
                    Segna consegnato
                  </button>
                </form>
                <ReadyWhatsAppButton hasPhone={hasWhatsapp} orderId={order.id} />
              </div>
            ) : (
              <div className="empty">Ordine gia consegnato.</div>
            )}
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
            <div className="field wide">
              <label htmlFor="appointmentAt">Appuntamento programmato</label>
              <input
                defaultValue={order.appointmentAt ? toDateTimeLocalInput(order.appointmentAt) : ""}
                id="appointmentAt"
                name="appointmentAt"
                type="datetime-local"
              />
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
            <div className="field">
              <label className="toggle-field" htmlFor="isQuote">
                <input defaultChecked={order.isQuote} id="isQuote" name="isQuote" type="checkbox" />
                <span>Preventivo</span>
              </label>
            </div>
            <div className="field full">
              <label htmlFor="appointmentNote">Nota appuntamento</label>
              <input
                defaultValue={order.appointmentNote || ""}
                id="appointmentNote"
                name="appointmentNote"
                placeholder="Installazione, appuntamento cliente, lavorazione programmata"
              />
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
              <p className="card-muted">Usalo solo per blocchi o attese: la fase principale resta il riferimento del lavoro.</p>
            </div>
            <p className="hint">
              {order.operationalStatus === "ATTIVO"
                ? "Nessun blocco operativo attivo."
                : `Motivo corrente: ${order.operationalNote || "non indicato"}`}
            </p>
            <form action={updateOrderStatusAction} className="form-grid order-status-form" id="order-status-form">
              <input name="orderId" type="hidden" value={order.id} />
              <div className="field order-status-field">
                <label htmlFor="operationalStatus">Stato</label>
                <select defaultValue={order.operationalStatus} id="operationalStatus" name="operationalStatus">
                  {Object.entries(operationalStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field wide order-status-note">
                <label htmlFor="statusNote">Nota</label>
                <input
                  defaultValue={order.operationalStatus === "ATTIVO" ? "" : order.operationalNote || ""}
                  id="statusNote"
                  name="note"
                  placeholder="Motivo sospensione o dettaglio operativo"
                />
              </div>
            </form>
            <div className="button-row order-status-actions">
              <button className="secondary" form="order-status-form" type="submit">
                Salva stato
              </button>
            </div>
            <DeleteOrderForm isQuote={order.isQuote} orderId={order.id} />
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
                <div className="subtle order-item-pricing">
                  Listino {formatCurrency(item.catalogBasePriceCents || item.unitPriceCents)}
                  {item.discountMode !== "NONE" ? ` • ${formatDiscountSummary(item.discountMode, item.discountValue)}` : ""}
                </div>
                <div className="subtle">{[item.format, item.material, item.finishing].filter(Boolean).join(" - ") || "Lavorazione personalizzata"}</div>
              </article>
            ))}
          </div>
        </section>

        <section className="card card-pad">
          <h3>Pagamenti</h3>
          <form action={recordPaymentAction} className="form-grid payment-entry-form">
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
            <div className="button-row payment-form-actions">
              <button className="primary" type="submit">
                Registra pagamento
              </button>
            </div>
          </form>

          <div className="mini-list">
            {activePayments.length === 0 ? (
              <div className="empty">Nessun pagamento registrato.</div>
            ) : (
              activePayments.map((payment) => (
                <article className="mini-item" key={payment.id}>
                  <div className="list-header">
                    <strong>{formatCurrency(payment.amountCents)}</strong>
                    <span>{paymentMethodLabels[payment.method]}</span>
                  </div>
                  <div className="subtle">{formatDateTime(payment.createdAt)}</div>
                  <div className="subtle">{payment.note || "Nessuna nota"}</div>
                  <form action={correctPaymentAction} className="form-grid payment-correction-form">
                    <input name="orderId" type="hidden" value={order.id} />
                    <input name="paymentId" type="hidden" value={payment.id} />
                    <div className="field">
                      <label htmlFor={`correct-amount-${payment.id}`}>Importo corretto</label>
                      <input
                        defaultValue={(payment.amountCents / 100).toFixed(2).replace(".", ",")}
                        id={`correct-amount-${payment.id}`}
                        name="amount"
                        required
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`correct-method-${payment.id}`}>Metodo</label>
                      <select defaultValue={payment.method} id={`correct-method-${payment.id}`} name="method">
                        {Object.entries(paymentMethodLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field wide">
                      <label htmlFor={`correct-note-${payment.id}`}>Nota correzione</label>
                      <input
                        defaultValue={payment.note || ""}
                        id={`correct-note-${payment.id}`}
                        name="note"
                        placeholder="Motivo della correzione"
                      />
                    </div>
                    <div className="button-row payment-form-actions">
                      <button className="secondary" type="submit">
                        Correggi pagamento
                      </button>
                    </div>
                  </form>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="card card-pad">
          <h3>Allegati</h3>
          <AttachmentUploadForm orderId={order.id} useDirectUpload={useDirectUpload} />
          <div className="mini-list">
            {order.attachments.length === 0 ? (
              <div className="empty">Nessun file caricato.</div>
            ) : (
              order.attachments.map((attachment) => (
                <a className="mini-item" href={attachment.filePath} key={attachment.id} rel="noreferrer" target="_blank">
                  <strong>{attachment.fileName}</strong>
                  <span className="subtle">
                    {formatAttachmentSize(attachment.sizeBytes)} • {formatDateTime(attachment.createdAt)}
                  </span>
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

function getGuidedPhaseAction(phase: import("@prisma/client").MainPhase) {
  if (phase === "ACCETTATO") {
    return { kind: "transition" as const, nextPhase: "IN_LAVORAZIONE" as const, label: "Avvia lavorazione" };
  }

  if (phase === "CALENDARIZZATO" || phase === "IN_LAVORAZIONE") {
    return { kind: "ready" as const };
  }

  if (phase === "SVILUPPO_COMPLETATO") {
    return { kind: "deliver" as const };
  }

  return null;
}
