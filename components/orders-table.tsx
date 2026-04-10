"use client";

import type { MainPhase, OperationalStatus, PaymentStatus, Priority } from "@prisma/client";
import Link from "next/link";
import { Fragment, useState } from "react";
import { QuickOrderControlForms, QuickOrderTriggerButton } from "@/components/quick-order-controls";
import { ReadyWhatsAppButton } from "@/components/ready-whatsapp-button";
import { StatusPills } from "@/components/status-pills";
import { priorityLabels } from "@/lib/constants";
import { formatCurrency, formatDateTime } from "@/lib/format";

type OrderRow = {
  id: string;
  orderCode: string;
  title: string;
  isQuote: boolean;
  hasWhatsapp: boolean;
  deliveryAt: Date | string;
  priority: Priority;
  mainPhase: MainPhase;
  operationalStatus: OperationalStatus;
  paymentStatus: PaymentStatus;
  totalCents: number;
  balanceDueCents: number;
  customer: {
    name: string;
    phone: string | null;
  };
};

export function OrdersTable({ orders }: { orders: OrderRow[] }) {
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  return (
    <table>
      <thead>
        <tr>
          <th>Ordine</th>
          <th>Cliente</th>
          <th>Consegna</th>
          <th>Priorita</th>
          <th>Stato</th>
          <th>Importi</th>
          <th>WhatsApp</th>
        </tr>
      </thead>
      <tbody>
        {orders.length === 0 ? (
          <tr>
            <td colSpan={7}>
              <div className="empty">Nessun ordine trovato.</div>
            </td>
          </tr>
        ) : (
          orders.map((order) => {
            const isOpen = openOrderId === order.id;
            const panelId = `order-row-panel-${order.id}`;

            return (
              <Fragment key={order.id}>
                <tr className={isOpen ? "order-row-open" : ""} key={order.id}>
                  <td>
                    <div className="order-inline-head">
                      <QuickOrderTriggerButton
                        ariaControls={panelId}
                        isOpen={isOpen}
                        onClick={() => setOpenOrderId((current) => (current === order.id ? null : order.id))}
                      />
                      <Link href={`/orders/${order.id}`}>
                        <div className="order-code">{order.orderCode}</div>
                      </Link>
                    </div>
                    <div className="subtle">
                      {order.title}
                      {order.isQuote ? " • Preventivo" : ""}
                    </div>
                  </td>
                  <td>
                    <strong>{order.customer.name}</strong>
                    <div className="subtle">{order.customer.phone || "Telefono non disponibile"}</div>
                  </td>
                  <td>{formatDateTime(order.deliveryAt)}</td>
                  <td>{priorityLabels[order.priority]}</td>
                  <td>
                    <StatusPills
                      isQuote={order.isQuote}
                      phase={order.mainPhase}
                      status={order.operationalStatus}
                      payment={order.paymentStatus}
                    />
                  </td>
                  <td>
                    <div className="strong">{formatCurrency(order.totalCents)}</div>
                    <div className="subtle">Residuo {formatCurrency(order.balanceDueCents)}</div>
                  </td>
                  <td className="orders-table-whatsapp-cell">
                    <ReadyWhatsAppButton
                      compact
                      disabled={order.mainPhase !== "SVILUPPO_COMPLETATO"}
                      hasPhone={order.hasWhatsapp}
                      orderId={order.id}
                    />
                  </td>
                </tr>
                {isOpen ? (
                  <tr className="order-row-details">
                    <td colSpan={7}>
                      <div className="order-row-panel" id={panelId}>
                        <QuickOrderControlForms
                          hasWhatsapp={order.hasWhatsapp}
                          includeQuote
                          isQuote={order.isQuote}
                          orderId={order.id}
                          phase={order.mainPhase}
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
  );
}
