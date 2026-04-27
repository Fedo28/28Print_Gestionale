import Link from "next/link";
import { notFound } from "next/navigation";
import {
  cloneOrderItemAction,
  confirmQuoteAction,
  correctPaymentAction,
  deleteOrderItemAction,
  markReadyAction,
  recordPaymentAction,
  toggleOrderItemDeliveryAction,
  transitionPhaseAction,
  updateOrderAction,
  updateOrderStatusDetailAction
} from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { MarkOrderInvoicedButton } from "@/components/mark-order-invoiced-button";
import { ReadyWhatsAppButton } from "@/components/ready-whatsapp-button";
import { StatusPills } from "@/components/status-pills";
import { AttachmentUploadForm } from "@/components/attachment-upload-form";
import { DeleteOrderForm } from "@/components/delete-order-form";
import { OrderPrintBrandMenu } from "@/components/order-print-brand-menu";
import { OrderItemEditorForm } from "@/components/order-item-editor-form";
import { OrderEditToggleButton } from "@/components/order-edit-toggle-button";
import { OrderItemDeleteButton } from "@/components/order-item-delete-button";
import { formatAttachmentSize } from "@/lib/attachment-utils";
import { requireAuth } from "@/lib/auth";
import {
  getAppointmentNoteOptions,
  invoiceStatusLabels,
  operationalStatusLabels,
  paymentMethodLabels,
  priorityLabels
} from "@/lib/constants";
import { formatCurrency, formatDateTime, formatQuantity, toDateTimeLocalInput } from "@/lib/format";
import { buildOrdersFilterHref } from "@/lib/order-filters";
import { getOrderById, getServiceCatalogAdmin } from "@/lib/orders";
import { usesLineTotalQuantityTiers } from "@/lib/pricing";
import { resolveAttachmentStorageMode } from "@/lib/storage";

export const dynamic = "force-dynamic";

function getCustomerPrimaryContact(customer: { phone?: string | null; whatsapp?: string | null }) {
  return customer.phone?.trim() || customer.whatsapp?.trim() || "Telefono non inserito";
}

export default async function OrderDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: { needsScheduling?: string; edit?: string; item?: string };
}) {
  await requireAuth();
  const [order, services] = await Promise.all([getOrderById(params.id), getServiceCatalogAdmin()]);

  if (!order) {
    notFound();
  }

  const activePayments = order.payments.filter((payment) => payment.status === "ATTIVO");
  const guidedAction = getGuidedPhaseAction(order.mainPhase);
  const hasWhatsapp = Boolean((order.customer.whatsapp || order.customer.phone || "").replace(/[^\d+]/g, ""));
  const useDirectUpload = resolveAttachmentStorageMode() === "blob";
  const needsScheduling = searchParams?.needsScheduling === "1";
  const shouldOpenEditPanel = needsScheduling || searchParams?.edit === "1";
  const openItemId = searchParams?.item?.trim() || "";
  const isSchedulePendingQuote = order.isQuote && order.schedulePending;
  const appointmentNoteOptions = getAppointmentNoteOptions(order.appointmentNote);
  const deliveredItemsCount = order.items.filter((item) => Boolean(item.deliveredAt)).length;
  const hasPartialDelivery = deliveredItemsCount > 0 && deliveredItemsCount < order.items.length;
  const editPanelHref = `/orders/${order.id}?edit=1#order-edit-panel`;
  const deliveryTitle = order.mainPhase === "CONSEGNATO" && order.deliveredAt ? "Consegnato" : "Consegna";
  const deliveryDateLabel =
    isSchedulePendingQuote
      ? "Da definire"
      : order.mainPhase === "CONSEGNATO" && order.deliveredAt
        ? formatDateTime(order.deliveredAt)
        : formatDateTime(order.deliveryAt);
  const mobilePaymentSummary =
    order.balanceDueCents > 0 ? `Residuo ${formatCurrency(order.balanceDueCents)}` : "Pagato";
  const accountingSummary =
    activePayments.length === 0
      ? `Nessun movimento registrato • Residuo ${formatCurrency(order.balanceDueCents)}`
      : `${activePayments.length} movimenti • Pagato ${formatCurrency(order.paidCents)} • Residuo ${formatCurrency(order.balanceDueCents)}`;
  const operationalStatusSummary =
    order.operationalStatus === "ATTIVO"
      ? "Operativo"
      : order.operationalNote || operationalStatusLabels[order.operationalStatus];
  const hasOperationalBlock = order.operationalStatus !== "ATTIVO";

  return (
    <div className="stack order-detail-page-shell">
      <PageHeader
        title={order.orderCode}
        titleAction={<OrderEditToggleButton targetId="order-edit-panel" />}
        action={
          <div className="order-detail-header-actions order-detail-header-actions-simple">
            <OrderPrintBrandMenu orderId={order.id} />
            <Link className="button ghost" href={order.isQuote ? "/quotes" : order.mainPhase === "CONSEGNATO" ? "/orders?view=DELIVERED" : "/orders"}>
              {order.isQuote ? "Torna ai preventivi" : "Torna agli ordini"}
            </Link>
          </div>
        }
      />

      <details className="card card-pad order-detail-disclosure order-detail-edit-card" id="order-edit-panel" open={shouldOpenEditPanel}>
        <summary className="order-detail-edit-summary-hidden">
          Modifica ordine
        </summary>
        <div className="order-detail-edit-tray-head">
          <div>
            <strong>Modifica ordine</strong>
            <span className="subtle">
              {needsScheduling
                ? "Per confermare il preventivo come ordine devi impostare una consegna oppure un appuntamento."
                : "Consegna, stato, note e impostazioni principali"}
            </span>
          </div>
        </div>
        <div className="grid grid-2 order-detail-edit-grid">
          <div className="stack order-detail-edit-column">
            <form action={updateOrderAction} className="form-grid">
              <input name="id" type="hidden" value={order.id} />
              <div className="field wide">
                <label htmlFor="title">Titolo</label>
                <input defaultValue={order.title} id="title" name="title" required />
              </div>
              <div className="field">
                <label htmlFor="deliveryAt">{order.isQuote ? "Consegna (facoltativa)" : "Consegna"}</label>
                <input
                  className="date-time-input"
                  defaultValue={isSchedulePendingQuote && !order.appointmentAt ? "" : toDateTimeLocalInput(order.deliveryAt)}
                  id="deliveryAt"
                  name="deliveryAt"
                  type="datetime-local"
                  required={!order.isQuote}
                />
              </div>
              <div className="field wide">
                <label htmlFor="appointmentAt">Appuntamento programmato</label>
                <input
                  className="date-time-input"
                  defaultValue={order.appointmentAt ? toDateTimeLocalInput(order.appointmentAt) : ""}
                  id="appointmentAt"
                  name="appointmentAt"
                  type="datetime-local"
                />
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
              <p className="hint order-priority-auto-hint">
                Priorita automatica attuale: {priorityLabels[order.priority]}. Il sistema la ricalcola dalla consegna quando salvi.
              </p>
              <div className="field full">
                <label htmlFor="appointmentNote">Nota appuntamento</label>
                <select defaultValue={order.appointmentNote || ""} id="appointmentNote" name="appointmentNote">
                  <option value="">Seleziona nota appuntamento</option>
                  {appointmentNoteOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field full">
                <label htmlFor="notes">Note interne</label>
                <textarea defaultValue={order.notes || ""} id="notes" name="notes" />
              </div>
              <div className="button-row order-detail-submit-row">
                <button className="primary" type="submit">
                  Aggiorna ordine
                </button>
              </div>
            </form>
          </div>

          <div className="stack order-detail-edit-column">
            <form action={updateOrderStatusDetailAction} className="form-grid order-status-form">
              <input name="orderId" type="hidden" value={order.id} />
              <div className="field order-status-field">
                <label htmlFor="operationalStatus">Stato operativo</label>
                <select defaultValue={order.operationalStatus} id="operationalStatus" name="operationalStatus">
                  {Object.entries(operationalStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field wide order-status-note">
                <label htmlFor="statusNote">Nota stato</label>
                <input
                  defaultValue={order.operationalStatus === "ATTIVO" ? "" : order.operationalNote || ""}
                  id="statusNote"
                  name="note"
                  placeholder="Motivo sospensione o dettaglio operativo"
                />
              </div>
              <p className="hint">
                {order.operationalStatus === "ATTIVO"
                  ? "Nessun blocco operativo attivo."
                  : `Motivo corrente: ${order.operationalNote || "non indicato"}`}
              </p>
              <div className="button-row order-status-actions">
                <button className="secondary" type="submit">
                  Salva stato
                </button>
              </div>
            </form>
          </div>
        </div>
      </details>

      <div className="order-detail-title-pills">
        <StatusPills
          hideNeutralStatus
          linked={!order.isQuote}
          isQuote={order.isQuote}
          phase={order.mainPhase}
          status={order.operationalStatus}
          payment={order.paymentStatus}
        />
        <div className="toolbar status-cluster order-detail-title-secondary-pills">
          {order.isQuote ? (
            <span className="pill compact-pill">{invoiceStatusLabels[order.invoiceStatus]}</span>
          ) : (
            <Link className="pill compact-pill" href={buildOrdersFilterHref({ invoice: order.invoiceStatus })} prefetch={false}>
              {invoiceStatusLabels[order.invoiceStatus]}
            </Link>
          )}
          {order.isQuote ? (
            <span className={`pill compact-pill${order.priority === "URGENTE" ? " danger" : order.priority === "ALTA" ? " warning" : ""}`}>{priorityLabels[order.priority]}</span>
          ) : (
            <Link
              className={`pill compact-pill${order.priority === "URGENTE" ? " danger" : order.priority === "ALTA" ? " warning" : ""}`}
              href={buildOrdersFilterHref({ priority: order.priority })}
              prefetch={false}
            >
              {priorityLabels[order.priority]}
            </Link>
          )}
          {order.isQuote ? (
            <Link className="pill compact-pill quote" href="/quotes" prefetch={false}>
              Preventivo
            </Link>
          ) : null}
          {hasPartialDelivery ? <span className="pill compact-pill warning">{`Parziale ${deliveredItemsCount}/${order.items.length}`}</span> : null}
        </div>
      </div>

      <section className="order-detail-overview-card card card-pad">
        <div className="order-detail-overview-bar">
          <div className="order-detail-overview-main">
            <div className="order-detail-overview-head">
              <div>
                <h3>{order.customer.name}</h3>
                <p className="card-muted">{getCustomerPrimaryContact(order.customer)}</p>
              </div>
            </div>
          </div>

          <Link className={`order-detail-overview-delivery-card${hasOperationalBlock ? " is-alert" : ""}`} href={editPanelHref}>
            <strong>{deliveryTitle}</strong>
            <span className="order-detail-overview-delivery-date">{deliveryDateLabel}</span>
            {hasOperationalBlock ? <span className="subtle">{operationalStatusSummary}</span> : null}
            {order.appointmentAt ? <span className="subtle">{`Appuntamento ${formatDateTime(order.appointmentAt)}`}</span> : null}
          </Link>

          <div className="order-detail-overview-actions">
            <div className="order-detail-overview-top-actions">
              <MarkOrderInvoicedButton compact invoiceStatus={order.invoiceStatus} orderId={order.id} />
              <DeleteOrderForm compact isQuote={order.isQuote} orderId={order.id} />
              {order.mainPhase === "SVILUPPO_COMPLETATO" ? (
                <ReadyWhatsAppButton hasPhone={hasWhatsapp} notifiedAt={order.readyWhatsappSentAt} orderId={order.id} />
              ) : null}
            </div>

            {guidedAction?.kind === "deliver" ? (
              <form action={transitionPhaseAction} className="action-form action-form-wide order-detail-overview-primary-action">
                <input name="orderId" type="hidden" value={order.id} />
                <input name="nextPhase" type="hidden" value="CONSEGNATO" />
                {order.balanceDueCents > 0 ? (
                  <input
                    aria-label="Nota override consegna"
                    name="note"
                    placeholder="Nota facoltativa sulla consegna"
                  />
                ) : null}
                <button className="primary" type="submit">
                  Segna consegnato
                </button>
              </form>
            ) : order.mainPhase === "CONSEGNATO" ? (
              <div className="empty order-detail-overview-empty">
                {order.deliveredAt ? `Ordine gia consegnato il ${formatDateTime(order.deliveredAt)}.` : "Ordine gia consegnato."}
              </div>
            ) : isSchedulePendingQuote ? (
              <Link className="button primary order-detail-overview-primary-link" href={`/orders/${order.id}?needsScheduling=1&edit=1#order-edit-panel`}>
                Definisci data per confermare
              </Link>
            ) : order.isQuote ? (
              <form action={confirmQuoteAction} className="order-detail-header-inline-form order-detail-overview-primary-action">
                <input name="orderId" type="hidden" value={order.id} />
                <button className="primary" type="submit">
                  Conferma come ordine
                </button>
              </form>
            ) : guidedAction?.kind === "transition" ? (
              <form action={transitionPhaseAction} className="order-detail-header-inline-form order-detail-overview-primary-action">
                <input name="orderId" type="hidden" value={order.id} />
                <input name="nextPhase" type="hidden" value={guidedAction.nextPhase} />
                <button className="primary" type="submit">
                  {guidedAction.label}
                </button>
              </form>
            ) : guidedAction?.kind === "ready" ? (
              <form action={markReadyAction} className="order-detail-header-inline-form order-detail-overview-primary-action">
                <input name="orderId" type="hidden" value={order.id} />
                <button className="success" type="submit">
                  Segna pronto
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </section>

      <div className="order-detail-work-grid">
        <section className="card card-pad order-detail-lines-card">
          <div className="order-detail-section-head">
            <div>
              <h3>Righe ordine</h3>
              <span className="subtle">{order.items.length} lavorazioni</span>
            </div>
            <span className="action-icon-button" aria-hidden="true">
              <SectionGlyph kind="items" />
            </span>
          </div>
          <div className="mini-list">
            <details className="mini-item order-item-editor order-item-editor-new" name="order-items">
              <summary className="order-item-editor-summary">
                <div className="order-item-editor-copy">
                  <strong>Nuova riga</strong>
                  <span className="subtle">Aggiungi una lavorazione manuale o collegata al catalogo.</span>
                </div>
                <span className="order-item-editor-total">Aggiungi</span>
              </summary>
              <div className="order-item-editor-body">
                <OrderItemEditorForm fieldPrefix="new-item" mode="create" orderId={order.id} services={services} submitLabel="Crea riga" />
              </div>
            </details>
            {order.items.map((item) => (
              <details
                className={`mini-item order-item-editor${item.deliveredAt ? " is-delivered" : ""}`}
                id={`item-${item.id}`}
                key={item.id}
                name="order-items"
                open={openItemId === item.id}
              >
                <summary className="order-item-editor-summary">
                  <div className="order-item-editor-copy">
                    <strong>{item.label}</strong>
                    <span className="subtle">
                      {usesLineTotalQuantityTiers(item.serviceCatalog) ||
                      String(item.format || "").trim().toLowerCase().startsWith("calcolatore etichette")
                        ? `${formatQuantity(item.quantity)} pz • Scaglione ${formatCurrency(item.catalogBasePriceCents || item.unitPriceCents)}`
                        : `${formatQuantity(item.quantity)} x ${formatCurrency(item.catalogBasePriceCents || item.unitPriceCents)}`}
                    </span>
                    {item.notes?.trim() ? <span className="order-item-editor-note-preview">{item.notes}</span> : null}
                    {item.deliveredAt ? <span className="order-item-delivered-pill">{`Consegnata il ${formatDateTime(item.deliveredAt)}`}</span> : null}
                  </div>
                  <span className="order-item-editor-summary-actions">
                    <span className="order-item-editor-total">{formatCurrency(item.lineTotalCents)}</span>
                    <OrderItemDeleteButton action={deleteOrderItemAction} itemId={item.id} orderId={order.id} />
                  </span>
                </summary>
                <div className="order-item-editor-body">
                  <OrderItemEditorForm
                    fieldPrefix={`item-${item.id}`}
                    mode="update"
                    orderId={order.id}
                    services={services}
                    submitLabel="Salva riga"
                    values={{
                      id: item.id,
                      label: item.label,
                      serviceCatalogId: item.serviceCatalogId,
                      quantity: item.quantity,
                      catalogBasePriceCents: item.catalogBasePriceCents,
                      unitPriceCents: item.unitPriceCents,
                      discountMode: item.discountMode,
                      discountValue: item.discountValue,
                      extraMode: item.extraMode,
                      extraValue: item.extraValue,
                      format: item.format,
                      material: item.material,
                      finishing: item.finishing,
                      notes: item.notes
                    }}
                  />
                  <div className="button-row order-item-editor-actions">
                    <form action={cloneOrderItemAction}>
                      <input name="orderId" type="hidden" value={order.id} />
                      <input name="itemId" type="hidden" value={item.id} />
                      <button className="ghost" type="submit">
                        Clona riga
                      </button>
                    </form>
                  </div>
                  <div className="button-row order-item-editor-actions">
                    {item.deliveredAt ? <span className="subtle">{`Riga consegnata il ${formatDateTime(item.deliveredAt)}`}</span> : null}
                    <form action={toggleOrderItemDeliveryAction} className="order-item-delivery-action">
                      <input name="orderId" type="hidden" value={order.id} />
                      <input name="itemId" type="hidden" value={item.id} />
                      <input name="delivered" type="hidden" value={item.deliveredAt ? "false" : "true"} />
                      <button className="ghost" type="submit">
                        {item.deliveredAt ? "Riapri riga" : "Segna come consegnata"}
                      </button>
                    </form>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </section>

        <div className="order-detail-side-stack">
          <section className="card card-pad order-detail-notes-card">
          <div className="order-detail-section-head">
            <div>
              <h3>Note</h3>
              <span className="subtle">
                {order.notes?.trim() ? "Solo lettura. Per modificarle entra nella sezione di modifica." : "Nessuna nota interna salvata"}
              </span>
            </div>
            <span className="action-icon-button" aria-hidden="true">
              <SectionGlyph kind="notes" />
            </span>
          </div>
          <div className={`order-detail-note-panel${order.notes?.trim() ? "" : " is-empty"}`}>
            {order.notes?.trim() ? <p>{order.notes}</p> : <span>Nessuna nota disponibile per questo ordine.</span>}
          </div>
          </section>

          <details className="card card-pad order-detail-disclosure order-detail-cashflow-card">
          <summary className="order-detail-disclosure-summary">
            <div className="order-detail-disclosure-copy">
              <h3>Incassi</h3>
              <span className="subtle payment-summary-desktop">
                {activePayments.length === 0
                  ? `Nessun movimento • Residuo ${formatCurrency(order.balanceDueCents)}`
                  : `${activePayments.length} movimenti • Pagato ${formatCurrency(order.paidCents)} • Residuo ${formatCurrency(order.balanceDueCents)}`}
              </span>
              <span className="subtle payment-summary-mobile">{mobilePaymentSummary}</span>
            </div>
            <span className="action-icon-button" aria-hidden="true">
              <SectionGlyph kind="payments" />
            </span>
          </summary>
          <div className="order-detail-accounting-grid order-detail-cashflow-stats">
            <span className="order-detail-accounting-stat">
              <span className="subtle">Totale</span>
              <strong>{formatCurrency(order.totalCents)}</strong>
            </span>
            <span className="order-detail-accounting-stat">
              <span className="subtle">Acconto</span>
              <strong>{formatCurrency(order.depositCents)}</strong>
            </span>
            <span className="order-detail-accounting-stat">
              <span className="subtle">Pagato</span>
              <strong>{formatCurrency(order.paidCents)}</strong>
            </span>
            <span className="order-detail-accounting-stat">
              <span className="subtle">Residuo</span>
              <strong>{formatCurrency(order.balanceDueCents)}</strong>
            </span>
          </div>
          <form action={recordPaymentAction} className="form-grid payment-entry-form">
            <input name="orderId" type="hidden" value={order.id} />
            <div className="field">
              <label htmlFor="amount">Importo</label>
              <input className="currency-input" id="amount" inputMode="decimal" name="amount" placeholder="0,00" required />
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
                <article className="mini-item payment-entry-item" key={payment.id}>
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
                        className="currency-input"
                        defaultValue={(payment.amountCents / 100).toFixed(2).replace(".", ",")}
                        id={`correct-amount-${payment.id}`}
                        inputMode="decimal"
                        name="amount"
                        placeholder="0,00"
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
          </details>

          <div className="order-detail-side-bottom-grid">
            <details className="card card-pad order-detail-disclosure order-detail-attachments-card">
              <summary className="order-detail-disclosure-summary">
                <div className="order-detail-disclosure-copy">
                  <h3>Allegati</h3>
                  <span className="subtle">{order.attachments.length === 0 ? "Nessun file" : `${order.attachments.length} file`}</span>
                </div>
                <span className="action-icon-button" aria-hidden="true">
                  <SectionGlyph kind="attachments" />
                </span>
              </summary>
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
            </details>

            <details className="card card-pad order-detail-disclosure order-detail-history-card">
              <summary className="order-detail-disclosure-summary">
                <div className="order-detail-disclosure-copy">
                  <h3>Cronologia</h3>
                  <span className="subtle">{order.history.length} eventi</span>
                </div>
                <span className="action-icon-button" aria-hidden="true">
                  <SectionGlyph kind="history" />
                </span>
              </summary>
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
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionGlyph({
  kind
}: {
  kind: "edit" | "status" | "items" | "notes" | "payments" | "attachments" | "history";
}) {
  if (kind === "edit") {
    return (
      <svg aria-hidden="true" className="glyph" viewBox="0 0 24 24">
        <path d="m5 16 9.7-9.7a2.1 2.1 0 0 1 3 3L8 19H5v-3Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      </svg>
    );
  }

  if (kind === "status") {
    return (
      <svg aria-hidden="true" className="glyph" viewBox="0 0 24 24">
        <path d="M12 4 6 6.5v4.8c0 3.8 2.5 6.9 6 8.2 3.5-1.3 6-4.4 6-8.2V6.5L12 4Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      </svg>
    );
  }

  if (kind === "items") {
    return (
      <svg aria-hidden="true" className="glyph" viewBox="0 0 24 24">
        <path d="M8 7h11M8 12h11M8 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      </svg>
    );
  }

  if (kind === "notes") {
    return (
      <svg aria-hidden="true" className="glyph" viewBox="0 0 24 24">
        <path d="M7 5.5h10A1.5 1.5 0 0 1 18.5 7v10A1.5 1.5 0 0 1 17 18.5H7A1.5 1.5 0 0 1 5.5 17V7A1.5 1.5 0 0 1 7 5.5Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
        <path d="M8.5 9.5h7M8.5 12h7M8.5 14.5h4.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      </svg>
    );
  }

  if (kind === "payments") {
    return (
      <svg aria-hidden="true" className="glyph" viewBox="0 0 24 24">
        <path d="M12 4v16M16 7.5c0-1.4-1.8-2.5-4-2.5s-4 1.1-4 2.5 1.8 2.5 4 2.5 4 1.1 4 2.5-1.8 2.5-4 2.5-4-1.1-4-2.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      </svg>
    );
  }

  if (kind === "attachments") {
    return (
      <svg aria-hidden="true" className="glyph" viewBox="0 0 24 24">
        <path d="M8 10.5 12 14.5l4-4m-4 4V5M5 16.5v1a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="glyph" viewBox="0 0 24 24">
      <path d="M12 7v5l3 2m5-2a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
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
