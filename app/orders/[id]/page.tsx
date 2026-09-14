import Link from "next/link";
import { notFound } from "next/navigation";
import type { MainPhase } from "@prisma/client";
import {
  cloneOrderItemAction,
  confirmQuoteAction,
  correctPaymentAction,
  deleteOrderItemAction,
  markReadyAction,
  quickUpdateQuoteFlagAction,
  restoreOrderHistoryAction,
  saveOrderMaterialNoteAction,
  toggleOrderItemDeliveryAction,
  updateOrderFinancialAdjustmentsAction,
  transitionPhaseAction,
  updateOrderAction,
  updateOrderStatusDetailAction
} from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { MarkOrderInvoicedButton } from "@/components/mark-order-invoiced-button";
import { ReadyWhatsAppButton } from "@/components/ready-whatsapp-button";
import { AttachmentUploadForm } from "@/components/attachment-upload-form";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { DeleteOrderForm } from "@/components/delete-order-form";
import { HistoryBackButton } from "@/components/history-back-button";
import { MaterialCategorySelectorField } from "@/components/material-category-selector-field";
import { OrderHistoryUndoShortcut } from "@/components/order-history-undo-shortcut";
import { OrderPrintBrandMenu } from "@/components/order-print-brand-menu";
import { OrderCustomerSwitchForm } from "@/components/order-customer-switch-form";
import { OrderItemEditorForm } from "@/components/order-item-editor-form";
import { OrderEditToggleButton } from "@/components/order-edit-toggle-button";
import { OrderItemDeleteButton } from "@/components/order-item-delete-button";
import { OrderPaymentEntryForm } from "@/components/order-payment-entry-form";
import { UndoButtonContent } from "@/components/undo-button-content";
import { formatAttachmentSize } from "@/lib/attachment-utils";
import { requireAuth } from "@/lib/auth";
import {
  getAppointmentNoteOptions,
  invoiceStatusLabels,
  mainPhaseLabels,
  normalizeMainPhaseForWorkflow,
  operationalStatusLabels,
  paymentStatusLabels,
  paymentMethodLabels,
  purchaseNoteUrgencyLabels
} from "@/lib/constants";
import { formatCurrency, formatDateTime, formatQuantity, toDateTimeLocalInput } from "@/lib/format";
import { isOrderPricingPending } from "@/lib/order-finance";
import { getDisplayOrderLabel } from "@/lib/order-display";
import { canConvertOrderToQuote, getOrderToQuoteDisabledReason } from "@/lib/order-quote";
import { buildOrdersFilterHref } from "@/lib/order-filters";
import { parseOrderMaterialNoteContent } from "@/lib/order-material-note";
import {
  formatOrderFinancialAdjustmentInput,
  getEffectiveOrderFinancialAdjustments,
  getOrderById,
  getServiceCatalogAdmin,
  hasOrderFinancialAdjustments
} from "@/lib/orders";
import { usesLineTotalQuantityTiers } from "@/lib/pricing";
import {
  buildShopDocumentBundleOverview,
  buildShopDocumentCardSummary,
  extractShopDocumentBundleFromConfiguration
} from "@/lib/shop-print-config";
import { resolveAttachmentStorageMode } from "@/lib/storage";

export const dynamic = "force-dynamic";

function getCustomerPrimaryContact(customer: { phone?: string | null; whatsapp?: string | null }) {
  return customer.phone?.trim() || customer.whatsapp?.trim() || "Telefono non inserito";
}

function getShopFileStaffDownloadHref(fileAssetId: string) {
  return `/api/orders/shop-files/${fileAssetId}`;
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
  const activeMaterialNote = order.purchaseNotes.find((note) => !note.completedAt) || null;
  const latestMaterialNote =
    activeMaterialNote ||
    [...order.purchaseNotes].sort(
      (left, right) =>
        new Date(right.completedAt || right.updatedAt).getTime() - new Date(left.completedAt || left.updatedAt).getTime()
    )[0] ||
    null;
  const latestRestorableHistoryEntry = order.history.find((entry) => Boolean(entry.snapshotBefore)) || null;
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
  const pricingPending = isOrderPricingPending(order);
  const orderLineSubtotalCents = order.items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const orderFinancialAdjustments = getEffectiveOrderFinancialAdjustments(order);
  const hasOrderWideAdjustments = hasOrderFinancialAdjustments(orderFinancialAdjustments);
  const globalDiscountInputValue = formatOrderFinancialAdjustmentInput(
    orderFinancialAdjustments.globalDiscountMode,
    orderFinancialAdjustments.globalDiscountValue
  );
  const globalExtraInputValue = formatOrderFinancialAdjustmentInput(
    orderFinancialAdjustments.globalExtraMode,
    orderFinancialAdjustments.globalExtraValue
  );
  const editPanelHref = `/orders/${order.id}?edit=1#order-edit-panel`;
  const deliveryTitle = order.mainPhase === "CONSEGNATO" && order.deliveredAt ? "Consegnato" : "Consegna";
  const visiblePhase = normalizeMainPhaseForWorkflow(order.mainPhase);
  const deliveryDateLabel =
    isSchedulePendingQuote
      ? "Da definire"
      : order.mainPhase === "CONSEGNATO" && order.deliveredAt
        ? formatDateTime(order.deliveredAt)
        : formatDateTime(order.deliveryAt);
  const mobilePaymentSummary = pricingPending
    ? "Da preventivare"
    : order.balanceDueCents > 0
      ? `Residuo ${formatCurrency(order.balanceDueCents)}`
      : "Pagato";
  const accountingSummary =
    pricingPending
      ? "Nessun movimento registrato • Prezzo da definire"
      : activePayments.length === 0
      ? `Nessun movimento registrato • Residuo ${formatCurrency(order.balanceDueCents)}`
      : `${activePayments.length} movimenti • Pagato ${formatCurrency(order.paidCents)} • Residuo ${formatCurrency(order.balanceDueCents)}`;
  const operationalStatusSummary =
    order.operationalStatus === "ATTIVO"
      ? "Operativo"
      : order.operationalNote || operationalStatusLabels[order.operationalStatus];
  const hasOperationalBlock = order.operationalStatus !== "ATTIVO";
  const workflowToneClass =
    visiblePhase === "CONSEGNATO"
      ? "is-emerald"
      : visiblePhase === "SVILUPPO_COMPLETATO"
        ? "is-violet"
        : visiblePhase === "IN_LAVORAZIONE"
          ? "is-indigo"
          : "is-azure";
  const totalToneClass = pricingPending ? "is-amber" : order.balanceDueCents > 0 ? "is-slate" : "is-teal";
  const workflowSummary = hasPartialDelivery ? `Parziale ${deliveredItemsCount}/${order.items.length}` : hasOperationalBlock ? operationalStatusSummary : "";
  const deliverySummary = order.appointmentAt ? `Appuntamento ${formatDateTime(order.appointmentAt)}` : hasOperationalBlock ? operationalStatusSummary : "";
  const totalSummary = pricingPending
    ? paymentStatusLabels[order.paymentStatus]
    : order.balanceDueCents > 0
      ? `Residuo ${formatCurrency(order.balanceDueCents)}`
      : "Saldo chiuso";
  const totalHeadline = pricingPending ? "Da preventivare" : formatCurrency(order.totalCents);
  const cashflowTone = pricingPending ? "tone-red" : order.balanceDueCents > 0 ? "tone-lime" : "tone-blue";
  const materialTone =
    activeMaterialNote?.urgency === "BLOCCANTE" || activeMaterialNote?.urgency === "URGENTE" ? "tone-red" : "tone-lime";
  const materialSummary = activeMaterialNote
    ? "Nota materiale attiva"
    : latestMaterialNote?.completedAt
      ? `Ultima nota chiusa il ${formatDateTime(latestMaterialNote.completedAt)}`
      : "Nessuna nota collegata";
  const activeMaterialNoteFormState = parseOrderMaterialNoteContent(activeMaterialNote?.content || "");
  const customerContactWarning =
    order.mainPhase === "SVILUPPO_COMPLETATO" && !hasWhatsapp ? "Manca un numero cliente valido: aggiorna telefono o WhatsApp." : null;
  const canConvertToQuote = canConvertOrderToQuote(order);
  const quoteDisabledReason = getOrderToQuoteDisabledReason(order);
  const linkedShopSalesOrder =
    order.salesOrderLinks.find((link) => link.salesOrder.origin === "SHOP_ONLINE")?.salesOrder || null;
  const linkedShopDocumentBundles = linkedShopSalesOrder
    ? linkedShopSalesOrder.items
        .map((item) => extractShopDocumentBundleFromConfiguration(item.configuration, Number(item.quantity)))
        .filter((bundle): bundle is NonNullable<typeof bundle> => Boolean(bundle))
    : [];
  const linkedShopDocumentCount = linkedShopDocumentBundles.reduce((sum, bundle) => sum + bundle.documents.length, 0);
  const linkedShopPrintUnits = linkedShopDocumentBundles.reduce((sum, bundle) => sum + bundle.totalPrintUnits, 0);
  const linkedShopFiles = linkedShopSalesOrder
    ? linkedShopSalesOrder.items.flatMap((item) => item.files.map((file) => file.fileAsset))
    : [];
  const linkedShopItemsSummary =
    linkedShopSalesOrder && linkedShopDocumentCount
      ? `${linkedShopDocumentCount} documenti shop`
      : linkedShopSalesOrder
        ? "Dettagli shop disponibili"
        : null;
  const pageTitle = linkedShopSalesOrder ? "Ordine shop" : order.customer.name;
  const orderDetailTone = getOrderDetailTone(order);
  const orderTitlePrimaryAction =
    guidedAction?.kind === "deliver" ? (
      <form action={transitionPhaseAction} className="action-form order-detail-title-primary-action">
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
      <div className="order-detail-title-actions-note">
        {order.deliveredAt ? `Ordine gia consegnato il ${formatDateTime(order.deliveredAt)}.` : "Ordine gia consegnato."}
      </div>
    ) : isSchedulePendingQuote ? (
      <Link className="button primary order-detail-title-primary-link" href={`/orders/${order.id}?needsScheduling=1&edit=1#order-edit-panel`}>
        Definisci data per confermare
      </Link>
    ) : order.isQuote ? (
      <form action={confirmQuoteAction} className="order-detail-header-inline-form order-detail-title-primary-action">
        <input name="orderId" type="hidden" value={order.id} />
        <button className="primary" type="submit">
          Conferma come ordine
        </button>
      </form>
    ) : guidedAction?.kind === "transition" ? (
      <form action={transitionPhaseAction} className="order-detail-header-inline-form order-detail-title-primary-action">
        <input name="orderId" type="hidden" value={order.id} />
        <input name="nextPhase" type="hidden" value={guidedAction.nextPhase} />
        <button className="primary" type="submit">
          {guidedAction.label}
        </button>
      </form>
    ) : guidedAction?.kind === "ready" ? (
      <form action={markReadyAction} className="order-detail-header-inline-form order-detail-title-primary-action">
        <input name="orderId" type="hidden" value={order.id} />
        <button className="success" type="submit">
          Segna pronto
        </button>
      </form>
    ) : null;

  return (
    <div className="stack order-detail-page-shell">
      <PageHeader
        title={pageTitle}
        action={
          <div className="order-detail-header-actions order-detail-header-actions-simple">
            <OrderPrintBrandMenu orderId={order.id} />
            <HistoryBackButton
              className="button ghost"
              fallbackHref={order.isQuote ? "/quotes" : order.mainPhase === "CONSEGNATO" ? "/orders?view=DELIVERED" : "/orders"}
              label="Torna indietro"
            />
          </div>
        }
      />

      <section className={`order-detail-command-card tone-${orderDetailTone}`}>
        <div className="order-detail-command-main">
          <span className="order-detail-command-kicker">{order.isQuote ? "Preventivo" : "Ordine"}</span>
          <h3 className="order-detail-command-title">{order.title}</h3>
          <div className="order-detail-command-meta-strip">
            <span>{getDisplayOrderLabel(order.orderCode, order.title)}</span>
            <span>{getCustomerPrimaryContact(order.customer)}</span>
            <span>{formatDateTime(order.createdAt)}</span>
            {linkedShopSalesOrder ? (
              <Link className="pill compact-pill shop-online-pill" href={buildOrdersFilterHref({ shop: "ONLINE" })} prefetch={false}>
                Shop online
              </Link>
            ) : null}
          </div>
          {customerContactWarning ? <p className="order-detail-command-warning">{customerContactWarning}</p> : null}
        </div>

        <div className="order-detail-command-stats">
          <Link
            className={`order-detail-command-stat ${workflowToneClass}`}
            href={order.isQuote ? "/quotes" : buildOrdersFilterHref({ phase: visiblePhase })}
            prefetch={false}
          >
            <span>Stato</span>
            <strong>{mainPhaseLabels[visiblePhase]}</strong>
            {workflowSummary ? <small>{workflowSummary}</small> : null}
          </Link>

          <Link className={`order-detail-command-stat ${hasOperationalBlock ? "is-coral" : "is-sky"}`} href={editPanelHref}>
            <span>{deliveryTitle}</span>
            <strong>{deliveryDateLabel}</strong>
            {deliverySummary ? <small>{deliverySummary}</small> : null}
          </Link>

          <Link className={`order-detail-command-stat ${totalToneClass}`} href="#order-detail-cashflow">
            <span>Totale</span>
            <strong>{totalHeadline}</strong>
            <small>{totalSummary}</small>
          </Link>
        </div>

        <div className="order-detail-command-footer">
          {orderTitlePrimaryAction ? <div className="order-detail-command-primary">{orderTitlePrimaryAction}</div> : null}
          <div className="order-detail-command-tools">
            <OrderEditToggleButton targetId="order-edit-panel" />
            <OrderHistoryUndoShortcut
              className="button ghost order-history-undo-button"
              historyId={latestRestorableHistoryEntry?.id}
              label="Annulla"
              orderId={order.id}
              returnTo={`/orders/${order.id}`}
            />
            <details className="order-detail-command-more">
              <summary className="button ghost order-detail-command-more-summary">Altro</summary>
              <div className="order-detail-command-more-panel">
                <Link className="button ghost" href={`/customers/${order.customer.id}`} prefetch={false}>
                  Cliente
                </Link>
                <Link className="button ghost" href="#order-detail-cashflow">
                  Incassi
                </Link>
                <Link className="button ghost" href="#order-history-panel">
                  Cronologia
                </Link>
                {order.isQuote ? (
                  <Link className="button ghost" href="/quotes" prefetch={false}>
                    Preventivo
                  </Link>
                ) : null}
                {!order.isQuote && canConvertToQuote ? (
                  <form action={quickUpdateQuoteFlagAction} className="order-detail-header-inline-form order-detail-title-primary-action">
                    <input name="orderId" type="hidden" value={order.id} />
                    <input name="isQuote" type="hidden" value="true" />
                    <ConfirmSubmitButton
                      className="button ghost"
                      confirmMessage="Trasformare questo ordine in preventivo? Verra escluso dal flusso operativo finche non lo confermi di nuovo come ordine."
                    >
                      Trasforma in preventivo
                    </ConfirmSubmitButton>
                  </form>
                ) : !order.isQuote && quoteDisabledReason ? (
                  <div className="order-detail-title-actions-note">{quoteDisabledReason}</div>
                ) : null}
                {order.mainPhase === "SVILUPPO_COMPLETATO" ? (
                  <ReadyWhatsAppButton compact hasPhone={hasWhatsapp} label="Messaggio" notifiedAt={order.readyWhatsappSentAt} orderId={order.id} showLabel />
                ) : null}
                <MarkOrderInvoicedButton compact invoiceStatus={order.invoiceStatus} orderId={order.id} />
                <DeleteOrderForm compact isQuote={order.isQuote} orderId={order.id} />
              </div>
            </details>
          </div>
        </div>
      </section>

      {linkedShopSalesOrder ? (
        <section className="card card-pad order-detail-shop-online-card" id="shop-online-panel">
          <div className="order-detail-shop-online-head">
            <div>
              <h3>Shop online</h3>
              <span className="subtle">{linkedShopSalesOrder.orderCode}</span>
            </div>
            <Link className="button ghost" href="#order-detail-attachments-card">
              File
            </Link>
          </div>

          <div className="order-detail-shop-online-summary">
            <span>
              <strong>{linkedShopDocumentCount || linkedShopSalesOrder.items.length}</strong>
              <small>Documenti</small>
            </span>
            <span>
              <strong>
                {linkedShopPrintUnits ||
                  formatQuantity(linkedShopSalesOrder.items.reduce((sum, item) => sum + Number(item.quantity), 0))}
              </strong>
              <small>Pagine stampa</small>
            </span>
            <span>
              <strong>{formatCurrency(linkedShopSalesOrder.totalCents)}</strong>
              <small>Totale</small>
            </span>
            <span>
              <strong>{linkedShopSalesOrder.invoiceRequested ? "Si" : "No"}</strong>
              <small>Fattura</small>
            </span>
          </div>

          <details className="order-detail-shop-online-details">
            <summary>
              <span>Preferenze e file</span>
              <strong>{linkedShopFiles.length} file</strong>
            </summary>
            <div className="order-detail-shop-online-grid">
              <div className="order-detail-shop-online-block">
                <strong>Preferenze</strong>
                <div className="mini-list">
                  {linkedShopSalesOrder.items.map((item) => {
                    const documentBundle = extractShopDocumentBundleFromConfiguration(item.configuration, Number(item.quantity));

                    return (
                      <article className="mini-item order-detail-shop-item" key={item.id}>
                        <div className="list-header">
                          <strong>{item.label}</strong>
                          <span className="pill compact-pill">{formatQuantity(item.quantity)}</span>
                        </div>
                        {documentBundle ? <div className="subtle">{buildShopDocumentBundleOverview(documentBundle)}</div> : null}
                        {documentBundle?.documents.map((document) => (
                          <div className="order-detail-shop-document-line" key={`${item.id}-${document.id}`}>
                            <span>{document.name}</span>
                            <small>{buildShopDocumentCardSummary(document, { compact: true })}</small>
                          </div>
                        ))}
                      </article>
                    );
                  })}
                </div>
              </div>

              <div className="order-detail-shop-online-block">
                <strong>File</strong>
                {linkedShopFiles.length ? (
                  <div className="mini-list">
                    {linkedShopFiles.map((file) => (
                      <a className="mini-item order-detail-shop-file-link" href={getShopFileStaffDownloadHref(file.id)} key={file.id}>
                        <strong>{file.originalName}</strong>
                        <span className="subtle">{formatAttachmentSize(file.fileSize)}</span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="empty">Nessun file collegato.</div>
                )}
                {linkedShopSalesOrder.notes?.trim() ? (
                  <div className="order-detail-shop-customer-note">
                    <strong>Nota cliente</strong>
                    <p>{linkedShopSalesOrder.notes}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </details>
        </section>
      ) : null}

      <details className="card card-pad order-detail-disclosure order-detail-edit-card" id="order-edit-panel" open={shouldOpenEditPanel}>
        <summary className="order-detail-edit-summary-hidden">
          Modifica ordine
        </summary>
        <div className="stack order-detail-edit-stack">
          <section className="order-detail-edit-section order-detail-edit-section-main">
            <div className="order-detail-edit-section-head">
              <div>
                <strong>Dati ordine</strong>
              </div>
              {needsScheduling ? <span className="order-detail-edit-inline-note">Manca ancora la data.</span> : null}
            </div>
            <form action={updateOrderAction} className="form-grid order-detail-edit-form">
              <input name="id" type="hidden" value={order.id} />
              <input name="isQuote" type="hidden" value={order.isQuote ? "true" : "false"} />
              <div className="field wide order-detail-edit-title-field">
                <label htmlFor="title">Titolo</label>
                <input defaultValue={order.title} id="title" name="title" required />
              </div>
              <div className="field order-detail-edit-delivery-field">
                <label htmlFor="deliveryAt">{order.isQuote ? "Consegna (facoltativa)" : "Consegna"}</label>
                <input
                  className="date-time-input"
                  defaultValue={isSchedulePendingQuote && !order.appointmentAt ? "" : toDateTimeLocalInput(order.deliveryAt)}
                  id="deliveryAt"
                  name="deliveryAt"
                  type="datetime-local"
                />
              </div>
              <div className="field wide order-detail-edit-appointment-field">
                <label htmlFor="appointmentAt">Appuntamento programmato</label>
                <input
                  className="date-time-input"
                  defaultValue={order.appointmentAt ? toDateTimeLocalInput(order.appointmentAt) : ""}
                  id="appointmentAt"
                  name="appointmentAt"
                  type="datetime-local"
                />
              </div>
              <div className="field order-detail-edit-invoice-field">
                <label htmlFor="invoiceStatus">Stato fatturazione</label>
                <select defaultValue={order.invoiceStatus} id="invoiceStatus" name="invoiceStatus">
                  {Object.entries(invoiceStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <details className="order-detail-compact-extra" open={Boolean(order.appointmentNote || order.notes)}>
                <summary>Note ordine</summary>
                <div className="order-detail-compact-extra-grid">
                  <div className="field full order-detail-edit-appointment-note-field">
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
                  <div className="field full order-detail-edit-notes-field">
                    <label htmlFor="notes">Note interne</label>
                    <textarea defaultValue={order.notes || ""} id="notes" name="notes" rows={3} />
                  </div>
                </div>
              </details>
              <div className="button-row order-detail-submit-row">
                <div className="button-row order-submit-action-cluster">
                  <button className="secondary" name="postSubmitAction" type="submit" value="new">
                    {order.isQuote ? "Aggiorna e nuovo preventivo" : "Aggiorna e nuovo ordine"}
                  </button>
                  <button className="primary" name="postSubmitAction" type="submit" value="detail">
                    {order.isQuote ? "Aggiorna preventivo" : "Aggiorna ordine"}
                  </button>
                </div>
              </div>
            </form>
          </section>

          <section className="order-detail-edit-section order-detail-edit-section-customer">
            <div className="order-detail-edit-section-head">
              <div>
                <strong>Cliente</strong>
              </div>
            </div>
            <OrderCustomerSwitchForm
              currentCustomerId={order.customer.id}
              currentCustomerName={order.customer.name}
              orderId={order.id}
              returnTo={`/orders/${order.id}?edit=1#order-edit-panel`}
            />
          </section>

          <section className="order-detail-edit-section order-detail-edit-section-status">
            <div className="order-detail-edit-section-head">
              <div>
                <strong>Stato</strong>
              </div>
            </div>
            <form action={updateOrderStatusDetailAction} className="form-grid order-status-form order-detail-edit-form">
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
              <div className="button-row order-status-actions">
                <button className="secondary" type="submit">
                  Salva stato
                </button>
              </div>
            </form>
          </section>

          {!order.isQuote ? (
            <details className="order-detail-edit-section order-detail-edit-section-material" open={Boolean(activeMaterialNote)}>
              <summary className="order-detail-edit-section-head">
                <div>
                  <strong>Materiali</strong>
                </div>
                <span className="order-detail-edit-inline-note">{materialSummary}</span>
              </summary>
              <form action={saveOrderMaterialNoteAction} className="form-grid order-status-form order-material-form">
                <input name="orderId" type="hidden" value={order.id} />
                <MaterialCategorySelectorField
                  defaultValue={activeMaterialNoteFormState.categoryCounts}
                  idPrefix={`order-detail-material-${order.id}`}
                  inputNamePrefix="materialCategoryCount"
                />
                <div className="field full order-status-note order-detail-edit-material-note-field">
                  <label htmlFor="materialNoteContent">Note</label>
                  <textarea
                    defaultValue={activeMaterialNoteFormState.content}
                    id="materialNoteContent"
                    name="materialNoteContent"
                    rows={3}
                  />
                </div>
                <div className="field order-status-field">
                  <label htmlFor="materialNoteUrgency">Urgenza</label>
                  <select defaultValue={activeMaterialNote?.urgency || "NORMALE"} id="materialNoteUrgency" name="materialNoteUrgency">
                    {Object.entries(purchaseNoteUrgencyLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field wide">
                  <label className="toggle-field" htmlFor="materialNoteBlockOrder">
                    <input
                      defaultChecked={order.operationalStatus === "IN_ATTESA_MATERIALE"}
                      id="materialNoteBlockOrder"
                      name="materialNoteBlockOrder"
                      type="checkbox"
                    />
                    <span>Metti o lascia l'ordine in attesa materiale</span>
                  </label>
                </div>
                <div className="button-row order-status-actions">
                  <Link className="button ghost" href="/purchase-notes" prefetch={false}>
                    Apri Da ordinare
                  </Link>
                  <button className="secondary" type="submit">
                    {activeMaterialNote ? "Aggiorna nota materiale" : "Crea nota materiale"}
                  </button>
                </div>
              </form>
            </details>
          ) : null}
        </div>
      </details>

      <div className="order-detail-work-grid">
        <section className="card card-pad order-detail-lines-card" id="order-lines-card">
          <div className="order-detail-section-head">
            <div>
              <h3>Lavorazioni</h3>
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
                </div>
                <span className="order-item-editor-summary-actions">
                  <span className="order-item-editor-open-chip">Crea</span>
                </span>
              </summary>
              <div className="order-item-editor-body">
                <OrderItemEditorForm fieldPrefix="new-item" mode="create" orderId={order.id} services={services} submitLabel="Crea riga" />
              </div>
            </details>
            {order.items.map((item) => {
              const itemTone = item.deliveredAt ? "tone-lime" : item.lineTotalCents <= 0 ? "tone-red" : "tone-blue";
              const itemPricingLabel =
                usesLineTotalQuantityTiers(item.serviceCatalog) ||
                String(item.format || "").trim().toLowerCase().startsWith("calcolatore etichette")
                  ? `${formatQuantity(item.quantity)} pz • Scaglione ${formatCurrency(item.catalogBasePriceCents || item.unitPriceCents)}`
                  : `${formatQuantity(item.quantity)} x ${formatCurrency(item.catalogBasePriceCents || item.unitPriceCents)}`;

              return (
                <details
                  className={`mini-item order-item-editor ${itemTone}${item.deliveredAt ? " is-delivered" : ""}`}
                  id={`item-${item.id}`}
                  key={item.id}
                  name="order-items"
                  open={openItemId === item.id}
                >
                  <summary className="order-item-editor-summary">
                    <div className="order-item-editor-copy">
                      <strong>{item.label}</strong>
                      <span className="subtle">{itemPricingLabel}</span>
                      {linkedShopItemsSummary ? (
                        <span className="order-item-editor-note-preview">{linkedShopItemsSummary}</span>
                      ) : item.notes?.trim() ? (
                        <span className="order-item-editor-note-preview">{item.notes}</span>
                      ) : null}
                      {item.deliveredAt ? <span className="order-item-delivered-pill">{`Consegnata il ${formatDateTime(item.deliveredAt)}`}</span> : null}
                    </div>
                    <span className="order-item-editor-summary-actions">
                      <span className="order-item-editor-total">{formatCurrency(item.lineTotalCents)}</span>
                      <span className="order-item-editor-open-chip" aria-hidden="true">
                        <span className="order-item-editor-open-label">Modifica</span>
                        <span className="order-item-editor-close-label">Chiudi</span>
                      </span>
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
                    <div className="button-row order-item-editor-actions order-item-editor-secondary-actions">
                      <form action={cloneOrderItemAction}>
                        <input name="orderId" type="hidden" value={order.id} />
                        <input name="itemId" type="hidden" value={item.id} />
                        <button className="ghost" type="submit">
                          Clona riga
                        </button>
                      </form>
                      <form action={toggleOrderItemDeliveryAction} className="order-item-delivery-action">
                        <input name="orderId" type="hidden" value={order.id} />
                        <input name="itemId" type="hidden" value={item.id} />
                        <input name="delivered" type="hidden" value={item.deliveredAt ? "false" : "true"} />
                        <button className={item.deliveredAt ? "ghost" : "secondary"} type="submit">
                          {item.deliveredAt ? "Riapri riga" : "Segna consegnata"}
                        </button>
                      </form>
                      <OrderItemDeleteButton
                        action={deleteOrderItemAction}
                        className="ghost order-line-remove-button"
                        itemId={item.id}
                        label="Elimina riga"
                        orderId={order.id}
                      />
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </section>

        <div className="order-detail-side-stack">
          <details className={`card card-pad order-detail-disclosure order-detail-cashflow-card ${cashflowTone}`} id="order-detail-cashflow">
          <summary className="order-detail-disclosure-summary">
            <div className="order-detail-disclosure-copy">
              <h3>Incassi</h3>
              <span className="subtle payment-summary-desktop">{accountingSummary}</span>
              <span className="subtle payment-summary-mobile">{mobilePaymentSummary}</span>
            </div>
            <span className="action-icon-button" aria-hidden="true">
              <SectionGlyph kind="payments" />
            </span>
          </summary>
          <div className="order-detail-accounting-grid order-detail-cashflow-stats">
            <span className="order-detail-accounting-stat">
              <span className="subtle">Totale</span>
              <strong>{pricingPending ? "Da preventivare" : formatCurrency(order.totalCents)}</strong>
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
              <strong>{pricingPending ? "Prezzo da definire" : formatCurrency(order.balanceDueCents)}</strong>
            </span>
          </div>

          <form
            action={updateOrderFinancialAdjustmentsAction}
            className={`order-detail-adjustments-form${hasOrderWideAdjustments ? " is-active" : ""}`}
          >
            <input name="orderId" type="hidden" value={order.id} />
            <div className="order-detail-adjustments-head">
              <strong>Rettifiche</strong>
              {hasOrderWideAdjustments ? (
                <span>
                  {formatCurrency(orderLineSubtotalCents)} / {formatCurrency(order.totalCents)}
                </span>
              ) : null}
            </div>
            <div className="order-detail-adjustments-grid">
              <div className="field">
                <label htmlFor="globalDiscount">Sconto</label>
                <input
                  className="currency-input"
                  defaultValue={globalDiscountInputValue}
                  id="globalDiscount"
                  inputMode="decimal"
                  name="globalDiscount"
                  placeholder="0,00 o 10%"
                />
              </div>
              <div className="field">
                <label htmlFor="globalExtra">Extra</label>
                <input
                  className="currency-input"
                  defaultValue={globalExtraInputValue}
                  id="globalExtra"
                  inputMode="decimal"
                  name="globalExtra"
                  placeholder="0,00 o 10%"
                />
              </div>
              <button className="secondary order-detail-adjustments-submit" type="submit">
                Salva
              </button>
            </div>
          </form>
          <OrderPaymentEntryForm orderId={order.id} />

          <div className="mini-list">
            {activePayments.length === 0 ? (
              <div className="empty">
                {pricingPending ? "Nessun pagamento registrato: prezzo ancora da definire." : "Nessun pagamento registrato."}
              </div>
            ) : (
              activePayments.map((payment) => (
                <article className="mini-item payment-entry-item" key={payment.id}>
                  <div className="list-header">
                    <strong>{formatCurrency(payment.amountCents)}</strong>
                    <span>{paymentMethodLabels[payment.method]}</span>
                  </div>
                  <div className="subtle">{formatDateTime(payment.createdAt)}</div>
                  <div className="subtle">{payment.note || "Nessuna nota"}</div>
                  <details className="payment-correction-disclosure">
                    <summary className="payment-correction-summary">Correggi</summary>
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
                          Salva correzione
                        </button>
                      </div>
                    </form>
                  </details>
                </article>
              ))
            )}
          </div>
          </details>

          {order.notes?.trim() || latestMaterialNote ? (
            <section className={`card card-pad order-detail-notes-card ${latestMaterialNote ? materialTone : "tone-blue"}`}>
              <div className="order-detail-section-head">
                <div>
                  <h3>{order.notes?.trim() ? "Note" : "Materiali"}</h3>
                  <span className="subtle">{order.notes?.trim() ? "Interne" : "Da ordinare"}</span>
                </div>
                <span className="action-icon-button" aria-hidden="true">
                  <SectionGlyph kind="notes" />
                </span>
              </div>
              {order.notes?.trim() ? (
                <div className="order-detail-note-panel">
                  <p>{order.notes}</p>
                </div>
              ) : null}
              {latestMaterialNote ? (
                <div className={`order-detail-note-panel order-detail-material-note${activeMaterialNote ? " is-linked" : ""}`}>
                  <div className="list-header">
                    <div className="order-detail-note-head">
                      <span className="compact-kicker">Materiali</span>
                      <strong>{activeMaterialNote ? "Da ordinare attivo" : "Ultima nota materiale"}</strong>
                    </div>
                    <Link className="button ghost" href="/purchase-notes" prefetch={false}>
                      Apri lista
                    </Link>
                  </div>
                  <p>{latestMaterialNote.content}</p>
                  <span className="subtle">
                    {activeMaterialNote
                      ? `Creata il ${formatDateTime(activeMaterialNote.createdAt)}`
                      : `Archiviata il ${formatDateTime(latestMaterialNote.completedAt || latestMaterialNote.updatedAt)}`}
                  </span>
                </div>
              ) : null}
            </section>
          ) : null}

          <div className="order-detail-side-bottom-grid">
            <details className="card card-pad order-detail-disclosure order-detail-attachments-card" id="order-detail-attachments-card">
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

            <details className="card card-pad order-detail-disclosure order-detail-history-card" id="order-history-panel">
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
                {order.history.map((entry) => {
                  const entryContent = (
                    <>
                      <div className="list-header">
                        <strong>{entry.description}</strong>
                        <div className="timeline-item-actions">
                          <span className="subtle">{formatDateTime(entry.createdAt)}</span>
                        </div>
                      </div>
                      {entry.details ? <div className="subtle">{entry.details}</div> : null}
                    </>
                  );

                  if (!entry.snapshotBefore) {
                    return (
                      <article className="timeline-item" key={entry.id}>
                        {entryContent}
                      </article>
                    );
                  }

                  return (
                    <form action={restoreOrderHistoryAction} className="timeline-item timeline-item-restorable" key={entry.id}>
                      <input name="orderId" type="hidden" value={order.id} />
                      <input name="historyId" type="hidden" value={entry.id} />
                      <ConfirmSubmitButton
                        className="timeline-item-button"
                        confirmMessage="Vuoi ripristinare questo stato precedente?"
                      >
                        {entryContent}
                        <span className="timeline-item-cta">
                          <UndoButtonContent label="Torna a questo stato" />
                        </span>
                      </ConfirmSubmitButton>
                    </form>
                  );
                })}
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}

function getOrderDetailTone(order: {
  deliveryAt: Date | string;
  mainPhase: MainPhase;
  operationalStatus: string;
  priority: string;
}) {
  const isOverdue = new Date(order.deliveryAt).getTime() < Date.now() && order.mainPhase !== "CONSEGNATO";

  if (order.operationalStatus !== "ATTIVO" || isOverdue || order.priority === "URGENTE") {
    return "red";
  }

  if (order.mainPhase === "SVILUPPO_COMPLETATO" || order.mainPhase === "ACCETTATO") {
    return "lime";
  }

  if (order.mainPhase === "IN_LAVORAZIONE" || order.mainPhase === "CALENDARIZZATO") {
    return "blue";
  }

  return "ink";
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
