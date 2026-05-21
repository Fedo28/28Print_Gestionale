"use client";

import type { InvoiceStatus, MainPhase, OperationalStatus, PaymentStatus, Priority } from "@prisma/client";
import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
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
  return customer.phone?.trim() || customer.whatsapp?.trim() || "Telefono non inserito";
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
  const selectAllRef = useRef<HTMLInputElement>(null);
  const deliveryColumnLabel = view === "DELIVERED" ? "Consegnato" : "Consegna";
  const sortableHeaders: Array<{ field: OrderSortField; label: string }> = [
    { field: "customer", label: "Cliente" },
    { field: "order", label: "Ordine" },
    { field: "delivery", label: deliveryColumnLabel },
    { field: "priority", label: "Priorita" },
    { field: "status", label: "Stato" },
    { field: "amount", label: "Importi" }
  ];

  function buildSortHref(field: OrderSortField) {
    const nextDirection = sortField === field && sortDirection === "asc" ? "desc" : "asc";
    return buildOrdersFilterHref({
      ...filters,
      sort: field,
      dir: nextDirection
    });
  }

  const allSelected = orders.length > 0 && selectedOrderIds.length === orders.length;
  const hasPartialSelection = selectedOrderIds.length > 0 && !allSelected;

  useEffect(() => {
    setSelectedOrderIds((current) => current.filter((orderId) => orders.some((order) => order.id === orderId)));
  }, [orders]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = hasPartialSelection;
    }
  }, [hasPartialSelection]);

  function toggleOrderSelection(orderId: string) {
    setSelectedOrderIds((current) =>
      current.includes(orderId) ? current.filter((entry) => entry !== orderId) : [...current, orderId]
    );
  }

  function toggleAllSelections() {
    setSelectedOrderIds((current) => (current.length === orders.length ? [] : orders.map((order) => order.id)));
  }

  return (
    <div className="stack orders-table-shell">
      <OrdersBulkToolbar onClearSelection={() => setSelectedOrderIds([])} selectedOrderIds={selectedOrderIds} />

      <table className="orders-table">
        <thead>
          <tr>
            <th className="orders-table-select-column">
              <input
                aria-label={allSelected ? "Deseleziona tutti gli ordini" : "Seleziona tutti gli ordini"}
                checked={allSelected}
                onChange={toggleAllSelections}
                ref={selectAllRef}
                type="checkbox"
              />
            </th>
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
            <th>Azioni</th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td colSpan={8}>
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
                    <td className="orders-table-select-column" data-label="Selezione">
                      <input
                        aria-label={`Seleziona ${displayLabel}`}
                        checked={isSelected}
                        onChange={() => toggleOrderSelection(order.id)}
                        type="checkbox"
                      />
                    </td>
                    <td data-label="Cliente">
                      <div className="order-mobile-card">
                        <div className="order-mobile-card-head">
                          <div className="order-inline-head order-inline-head-spread">
                            <div className="order-mobile-card-copy">
                              <Link href={`/orders/${order.id}`}>
                                <div className="order-code order-display-title">{order.customer.name}</div>
                              </Link>
                              <div className="subtle order-entry-meta">{customerContact}</div>
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
                            <MarkOrderInvoicedButton compact invoiceStatus={order.invoiceStatus} orderId={order.id} />
                            <ReadyWhatsAppButton
                              compact
                              disabled={order.mainPhase !== "SVILUPPO_COMPLETATO"}
                              hasPhone={order.hasWhatsapp}
                              notifiedAt={order.readyWhatsappSentAt}
                              orderId={order.id}
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
                          <Link href={`/orders/${order.id}`}>
                            <div className="order-code order-display-title">{order.customer.name}</div>
                          </Link>
                          <QuickOrderTriggerButton
                            ariaControls={panelId}
                            isOpen={isOpen}
                            onClick={() => setOpenOrderId((current) => (current === order.id ? null : order.id))}
                          />
                        </div>
                        <div className="subtle order-entry-meta">{customerContact}</div>
                      </div>
                    </td>
                    <td data-label="Ordine">
                      <div className="order-desktop-cell">
                        <div className="order-code order-display-title">{displayLabel}</div>
                        {entryMeta ? <div className="subtle order-entry-meta">{entryMeta}</div> : null}
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
                    <td data-label="Priorita">
                      <span className={`order-priority-chip${priorityToneClass ? ` ${priorityToneClass}` : ""}`}>{priorityLabels[order.priority]}</span>
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
                    <td data-label="Importi">
                      <div className="strong">{formatCurrency(order.totalCents)}</div>
                      <div className="subtle">Residuo {formatCurrency(order.balanceDueCents)}</div>
                    </td>
                    <td className="orders-table-actions-cell" data-label="Azioni">
                      <div className="orders-table-action-buttons">
                        <MarkOrderInvoicedButton compact invoiceStatus={order.invoiceStatus} orderId={order.id} />
                        <ReadyWhatsAppButton
                          compact
                          disabled={order.mainPhase !== "SVILUPPO_COMPLETATO"}
                          hasPhone={order.hasWhatsapp}
                          notifiedAt={order.readyWhatsappSentAt}
                          orderId={order.id}
                        />
                      </div>
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr className="order-row-details">
                      <td colSpan={8}>
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
