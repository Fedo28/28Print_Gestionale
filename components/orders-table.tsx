"use client";

import type { InvoiceStatus, MainPhase, OperationalStatus, PaymentStatus, Priority } from "@prisma/client";
import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { MarkOrderInvoicedButton } from "@/components/mark-order-invoiced-button";
import { OrdersBulkToolbar } from "@/components/orders-bulk-toolbar";
import { QuickOrderControlForms, QuickOrderTriggerButton } from "@/components/quick-order-controls";
import { ReadyWhatsAppButton } from "@/components/ready-whatsapp-button";
import { StatusPills } from "@/components/status-pills";
import { getDisplayOrderLabel } from "@/lib/order-display";
import { priorityLabels } from "@/lib/constants";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { buildOrdersFilterHref, type OrderListFilters, type OrderListView, type OrderSortDirection, type OrderSortField } from "@/lib/order-filters";
import { getPriorityToneClass } from "@/lib/priorities";

type OrderRow = {
  id: string;
  orderCode: string;
  title: string;
  isQuote: boolean;
  hasWhatsapp: boolean;
  readyWhatsappSentAt?: Date | string | null;
  deliveryAt: Date | string;
  deliveredAt?: Date | string | null;
  priority: Priority;
  mainPhase: MainPhase;
  operationalStatus: OperationalStatus;
  paymentStatus: PaymentStatus;
  invoiceStatus: InvoiceStatus;
  totalCents: number;
  balanceDueCents: number;
  customer: {
    name: string;
    phone?: string | null;
    whatsapp?: string | null;
  };
  items: {
    id: string;
    deliveredAt?: Date | string | null;
  }[];
};

function getCustomerContact(customer: { phone?: string | null; whatsapp?: string | null }) {
  return customer.phone?.trim() || customer.whatsapp?.trim() || null;
}

function getPartialDeliveryMeta(items: Array<{ deliveredAt?: Date | string | null }>) {
  const deliveredCount = items.filter((item) => Boolean(item.deliveredAt)).length;
  return {
    deliveredCount,
    totalCount: items.length,
    isPartial: deliveredCount > 0 && deliveredCount < items.length,
    isFullyDeliveredByItems: items.length > 0 && deliveredCount === items.length
  };
}

function SortGlyph({ active, direction }: { active: boolean; direction: OrderSortDirection }) {
  return (
    <span className={`orders-table-sort-icon${active ? " active" : ""}`} aria-hidden="true">
      {active ? (direction === "asc" ? "↑" : "↓") : "↕"}
    </span>
  );
}

function OrderPrimaryAction({
  hasWhatsapp,
  href,
  invoiceStatus,
  mainPhase,
  orderId,
  readyWhatsappSentAt
}: {
  hasWhatsapp: boolean;
  href: string;
  invoiceStatus: InvoiceStatus;
  mainPhase: MainPhase;
  orderId: string;
  readyWhatsappSentAt?: Date | string | null;
}) {
  if (mainPhase === "SVILUPPO_COMPLETATO" && hasWhatsapp) {
    return <ReadyWhatsAppButton compact hasPhone={hasWhatsapp} notifiedAt={readyWhatsappSentAt} orderId={orderId} showLabel />;
  }

  if ((mainPhase === "SVILUPPO_COMPLETATO" || mainPhase === "CONSEGNATO") && invoiceStatus === "DA_FATTURARE") {
    return <MarkOrderInvoicedButton compact invoiceStatus={invoiceStatus} orderId={orderId} showLabel />;
  }

  return (
    <Link className="button ghost orders-row-open-button" href={href}>
      Apri
    </Link>
  );
}

export function OrdersTable({
  orders,
  view = "ACTIVE",
  filters,
  sortField,
  sortDirection
}: {
  orders: OrderRow[];
  view?: OrderListView;
  filters: OrderListFilters;
  sortField: OrderSortField;
  sortDirection: OrderSortDirection;
}) {
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const deliveryColumnLabel = view === "DELIVERED" ? "Consegnato" : "Consegna";
  const sortableHeaders: Array<{ field: OrderSortField; label: string }> = [
    { field: "customer", label: "Cliente e lavoro" },
    { field: "delivery", label: deliveryColumnLabel },
    { field: "status", label: "Stato" },
    { field: "amount", label: "Saldo" }
  ];
  const tableColumnCount = sortableHeaders.length + 1;

  function buildSortHref(field: OrderSortField) {
    const nextDirection = sortField === field && sortDirection === "asc" ? "desc" : "asc";
    return buildOrdersFilterHref({
      ...filters,
      sort: field,
      dir: nextDirection
    });
  }

  const allSelected = orders.length > 0 && selectedOrderIds.length === orders.length;

  useEffect(() => {
    setSelectedOrderIds((current) => current.filter((orderId) => orders.some((order) => order.id === orderId)));
  }, [orders]);

  function toggleOrderSelection(orderId: string) {
    setSelectedOrderIds((current) =>
      current.includes(orderId) ? current.filter((entry) => entry !== orderId) : [...current, orderId]
    );
  }

  function toggleAllSelections() {
    setSelectedOrderIds((current) => (current.length === orders.length ? [] : orders.map((order) => order.id)));
  }

  function toggleSelectionMode() {
    setIsSelectionMode((current) => {
      if (current) {
        setSelectedOrderIds([]);
      }
      return !current;
    });
  }

  return (
    <div className="stack orders-table-shell">
      <div className="orders-list-selection-bar">
        <span className="hint">
          {isSelectionMode
            ? selectedOrderIds.length > 0
              ? `${selectedOrderIds.length} selezionati`
              : "Scegli gli ordini da aggiornare insieme."
            : "Per aggiornare piu ordini insieme, attiva la selezione."}
        </span>
        <div className="orders-list-selection-actions">
          {isSelectionMode ? (
            <button className="button ghost orders-selection-button" onClick={toggleAllSelections} type="button">
              {allSelected ? "Nessuno" : "Tutti"}
            </button>
          ) : null}
          <button className="button ghost orders-selection-button" onClick={toggleSelectionMode} type="button">
            {isSelectionMode ? "Fine" : "Seleziona"}
          </button>
        </div>
      </div>
      <OrdersBulkToolbar onClearSelection={() => setSelectedOrderIds([])} selectedOrderIds={selectedOrderIds} />

      <table className="orders-table">
        <thead>
          <tr>
            {sortableHeaders.map((header) => {
              const isActive = sortField === header.field;

              return (
                <th key={header.field}>
                  <Link
                    className={`orders-table-sort-link${isActive ? " active" : ""}`}
                    href={buildSortHref(header.field)}
                    prefetch={false}
                    scroll={false}
                  >
                    <span>{header.label}</span>
                    <SortGlyph active={isActive} direction={sortDirection} />
                  </Link>
                </th>
              );
            })}
            <th>Adesso</th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td colSpan={tableColumnCount}>
                <div className="empty">Nessun ordine trovato.</div>
              </td>
            </tr>
          ) : (
            orders.map((order) => {
              const isOpen = openOrderId === order.id;
              const isSelected = selectedOrderIds.includes(order.id);
              const panelId = `order-row-panel-${order.id}`;
              const displayLabel = getDisplayOrderLabel(order.orderCode, order.title);
              const secondaryLabel = order.title?.trim() && order.title.trim() !== displayLabel ? order.title.trim() : null;
              const entryMeta = [secondaryLabel, order.isQuote ? "Preventivo" : null].filter(Boolean).join(" • ");
              const customerContact = getCustomerContact(order.customer);
              const priorityToneClass = view === "ACTIVE" ? getPriorityToneClass(order.priority) : "";
              const deliveredLabel = order.deliveredAt ? formatDateTime(order.deliveredAt) : formatDateTime(order.deliveryAt);
              const whatsappNotified = order.mainPhase === "SVILUPPO_COMPLETATO" && Boolean(order.readyWhatsappSentAt);
              const partialDelivery = getPartialDeliveryMeta(order.items);
              const deliveryPrimaryLabel = view === "DELIVERED" ? deliveredLabel : formatDateTime(order.deliveryAt);
              const deliverySecondaryLabel =
                view === "DELIVERED"
                  ? order.deliveredAt
                    ? `Prevista ${formatDateTime(order.deliveryAt)}`
                    : "Consegnato"
                  : priorityLabels[order.priority];

              return (
                <Fragment key={order.id}>
                  <tr
                    className={`${isOpen ? "order-row-open" : ""}${isSelected ? " order-row-selected" : ""}${priorityToneClass ? ` order-row-${priorityToneClass}` : ""}${whatsappNotified ? " order-row-whatsapp-notified" : ""}`}
                    key={order.id}
                  >
                    <td data-label="Cliente e lavoro">
                      <div className="order-mobile-card">
                        <div className="order-mobile-card-summary">
                          <div className="order-mobile-card-head">
                          <div className="order-inline-head order-inline-head-spread">
                            <div className="order-list-customer-group">
                              {isSelectionMode ? (
                                <input
                                  aria-label={`Seleziona ${order.customer.name}`}
                                  checked={isSelected}
                                  className="orders-row-selection-input"
                                  onChange={() => toggleOrderSelection(order.id)}
                                  type="checkbox"
                                />
                              ) : null}
                              <div className="order-mobile-card-copy">
                                <Link href={`/orders/${order.id}`}>
                                  <div className="order-code order-display-title">{order.customer.name}</div>
                                </Link>
                                {customerContact ? <div className="subtle order-entry-meta">{customerContact}</div> : null}
                              </div>
                            </div>
                            <QuickOrderTriggerButton
                              ariaControls={panelId}
                              isOpen={isOpen}
                              onClick={() => setOpenOrderId((current) => (current === order.id ? null : order.id))}
                            />
                          </div>
                          <div className="order-mobile-card-total">
                            <strong>{formatCurrency(order.totalCents)}</strong>
                            <span>Residuo {formatCurrency(order.balanceDueCents)}</span>
                          </div>
                          </div>

                          <div className="order-mobile-card-customer">
                            <strong>{displayLabel}</strong>
                            {entryMeta ? <span>{entryMeta}</span> : null}
                          </div>
                        </div>

                        <div className="order-mobile-card-meta">
                          <div
                            className={`order-deadline-chip order-mobile-card-deadline${priorityToneClass ? ` ${priorityToneClass}` : ""}${view === "DELIVERED" ? " delivered" : ""}`}
                          >
                            <strong>{deliveryPrimaryLabel}</strong>
                            <span>{deliverySecondaryLabel}</span>
                          </div>
                          <div className={`order-mobile-card-priority${priorityToneClass ? ` ${priorityToneClass}` : ""}`}>
                            <span>Priorita</span>
                            <strong>{priorityLabels[order.priority]}</strong>
                          </div>
                          <div className="order-mobile-card-actions">
                            <OrderPrimaryAction
                              hasWhatsapp={order.hasWhatsapp}
                              href={`/orders/${order.id}`}
                              invoiceStatus={order.invoiceStatus}
                              mainPhase={order.mainPhase}
                              orderId={order.id}
                              readyWhatsappSentAt={order.readyWhatsappSentAt}
                            />
                          </div>
                        </div>

                        <div className="order-mobile-card-status">
                          <StatusPills
                            hideNeutralStatus
                            isQuote={order.isQuote}
                            linked={false}
                            phase={order.mainPhase}
                            status={order.operationalStatus}
                            payment={order.paymentStatus}
                          />
                          {partialDelivery.isPartial ? (
                            <span className="pill warning">{`Parziale ${partialDelivery.deliveredCount}/${partialDelivery.totalCount}`}</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="order-desktop-cell">
                        <div className="order-inline-head order-inline-head-spread">
                          <div className="order-list-customer-group">
                            {isSelectionMode ? (
                              <input
                                aria-label={`Seleziona ${order.customer.name}`}
                                checked={isSelected}
                                className="orders-row-selection-input"
                                onChange={() => toggleOrderSelection(order.id)}
                                type="checkbox"
                              />
                            ) : null}
                            <div>
                              <Link href={`/orders/${order.id}`}>
                                <div className="order-code order-display-title">{order.customer.name}</div>
                              </Link>
                              <Link className="subtle order-entry-meta order-list-work-link" href={`/orders/${order.id}`}>
                                {displayLabel}
                              </Link>
                              {customerContact ? <div className="subtle order-entry-meta">{customerContact}</div> : null}
                            </div>
                          </div>
                          <QuickOrderTriggerButton
                            ariaControls={panelId}
                            isOpen={isOpen}
                            onClick={() => setOpenOrderId((current) => (current === order.id ? null : order.id))}
                          />
                        </div>
                      </div>
                    </td>
                    <td
                      className={`orders-table-delivery-cell${priorityToneClass ? ` ${priorityToneClass}` : ""}`}
                      data-label={deliveryColumnLabel}
                    >
                      <div className={`order-deadline-chip${priorityToneClass ? ` ${priorityToneClass}` : ""}${view === "DELIVERED" ? " delivered" : ""}`}>
                        <strong>{view === "DELIVERED" ? deliveredLabel : formatDateTime(order.deliveryAt)}</strong>
                        <span>{deliverySecondaryLabel}</span>
                        {view === "DELIVERED" && order.deliveredAt ? <span>Prevista {formatDateTime(order.deliveryAt)}</span> : null}
                      </div>
                    </td>
                    <td data-label="Stato">
                      <StatusPills
                        hideNeutralStatus
                        isQuote={order.isQuote}
                        phase={order.mainPhase}
                        status={order.operationalStatus}
                        payment={order.paymentStatus}
                      />
                      {partialDelivery.isPartial ? <div className="subtle order-partial-delivery-note">{`Parziale ${partialDelivery.deliveredCount}/${partialDelivery.totalCount}`}</div> : null}
                    </td>
                    <td className={order.balanceDueCents > 0 ? "orders-table-balance-due" : "orders-table-balance-settled"} data-label="Saldo">
                      <div className="strong">{order.balanceDueCents > 0 ? formatCurrency(order.balanceDueCents) : "Pagato"}</div>
                      <div className="subtle">{order.balanceDueCents > 0 ? "Da incassare" : "Saldo chiuso"}</div>
                    </td>
                    <td className="orders-table-actions-cell" data-label="Adesso">
                      <div className="orders-table-action-buttons">
                        <OrderPrimaryAction
                          hasWhatsapp={order.hasWhatsapp}
                          href={`/orders/${order.id}`}
                          invoiceStatus={order.invoiceStatus}
                          mainPhase={order.mainPhase}
                          orderId={order.id}
                          readyWhatsappSentAt={order.readyWhatsappSentAt}
                        />
                      </div>
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr className="order-row-details">
                      <td colSpan={tableColumnCount}>
                        <div className="order-row-panel" id={panelId}>
                          <QuickOrderControlForms
                            hasWhatsapp={order.hasWhatsapp}
                            includeQuote
                            isQuote={order.isQuote}
                            orderId={order.id}
                            phase={order.mainPhase}
                            readyWhatsappSentAt={order.readyWhatsappSentAt}
                            showWhatsapp={false}
                            status={order.operationalStatus}
                          />
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
