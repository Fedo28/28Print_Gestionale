import type { MainPhase, Prisma, SalesOrderStatus } from "@prisma/client";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { getDisplayOrderLabel } from "@/lib/order-display";
import { prisma } from "@/lib/prisma";
import { resolveShopNotificationSource } from "@/lib/shop-notification-source";

const pendingShopOnlineOperationalOrderWhere = {
  isQuote: false,
  mainPhase: { notIn: ["SVILUPPO_COMPLETATO", "CONSEGNATO"] as MainPhase[] },
  salesOrderLinks: {
    some: {
      salesOrder: {
        origin: "SHOP_ONLINE"
      }
    }
  }
} satisfies Prisma.OrderWhereInput;

const pendingIncomingShopSalesOrderWhere = {
  origin: "SHOP_ONLINE",
  status: { in: ["PENDING_PAYMENT", "PAID"] as SalesOrderStatus[] },
  jobLinks: {
    none: {}
  }
} satisfies Prisma.SalesOrderWhereInput;

function getPayloadString(payload: Prisma.JsonValue | null, key: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const value = payload[key as keyof typeof payload];
  return typeof value === "string" ? value : null;
}

export async function listPendingShopOnlineOperationalOrders(limit = 8) {
  const safeLimit = Math.max(1, limit);
  const [operationalCount, orders, incomingCount, incomingSalesOrders] = await Promise.all([
    prisma.order.count({
      where: pendingShopOnlineOperationalOrderWhere
    }),
    prisma.order.findMany({
      where: pendingShopOnlineOperationalOrderWhere,
      orderBy: [{ createdAt: "desc" }],
      take: safeLimit,
      select: {
        id: true,
        orderCode: true,
        title: true,
        createdAt: true,
        deliveryAt: true,
        mainPhase: true,
        totalCents: true,
        customer: {
          select: {
            name: true
          }
        },
        salesOrderLinks: {
          where: {
            salesOrder: {
              origin: "SHOP_ONLINE"
            }
          },
          orderBy: [{ createdAt: "desc" }],
          take: 1,
          select: {
            salesOrder: {
              select: {
                id: true,
                orderCode: true,
                createdAt: true,
                totalCents: true,
                customerAccount: {
                  select: {
                    email: true,
                    emailNormalized: true
                  }
                }
              }
            }
          }
        }
      }
    }),
    prisma.salesOrder.count({
      where: pendingIncomingShopSalesOrderWhere
    }),
    prisma.salesOrder.findMany({
      where: pendingIncomingShopSalesOrderWhere,
      orderBy: [{ createdAt: "desc" }],
      take: safeLimit,
      select: {
        id: true,
        orderCode: true,
        status: true,
        totalCents: true,
        placedAt: true,
        createdAt: true,
        customer: {
          select: {
            name: true
          }
        },
        customerAccount: {
          select: {
            email: true,
            emailNormalized: true
          }
        },
        items: {
          orderBy: [{ createdAt: "asc" }],
          take: 1,
          select: {
            label: true
          }
        }
      }
    })
  ]);

  const salesOrderIds = [
    ...orders.map((order) => order.salesOrderLinks[0]?.salesOrder?.id).filter((id): id is string => Boolean(id)),
    ...incomingSalesOrders.map((order) => order.id)
  ];
  const createdEvents = salesOrderIds.length
    ? await prisma.domainEvent.findMany({
        where: {
          entityId: {
            in: salesOrderIds
          },
          entityType: "SalesOrder",
          topic: "shop.sales_order.created"
        },
        select: {
          entityId: true,
          payloadJson: true
        }
      })
    : [];
  const createdEventBySalesOrderId = new Map(
    createdEvents.map((event) => [event.entityId, event.payloadJson])
  );
  const resolveSalesOrderSource = (input: {
    customerAccount?: { email: string; emailNormalized: string } | null;
    customerName: string;
    salesOrderId?: string | null;
  }) => {
    const payload = input.salesOrderId ? createdEventBySalesOrderId.get(input.salesOrderId) ?? null : null;

    return resolveShopNotificationSource({
      customerAccountEmail: input.customerAccount?.email,
      customerAccountEmailNormalized: input.customerAccount?.emailNormalized,
      customerName: input.customerName,
      staffEmail: getPayloadString(payload, "staffActorEmail"),
      staffName: getPayloadString(payload, "staffActorName"),
      staffNickname: getPayloadString(payload, "staffActorNickname")
    });
  };

  const operationalEntries = orders.map((order) => {
    const shopOrder = order.salesOrderLinks[0]?.salesOrder;
    const notificationSource = resolveSalesOrderSource({
      customerAccount: shopOrder?.customerAccount,
      customerName: order.customer.name,
      salesOrderId: shopOrder?.id
    });

    return {
      sortAt: shopOrder?.createdAt || order.createdAt,
      id: order.id,
      href: `/orders/${order.id}`,
      orderCode: order.orderCode,
      title: getDisplayOrderLabel(order.orderCode, order.title),
      customerName: order.customer.name,
      totalLabel: formatCurrency(order.totalCents),
      createdLabel: formatDateTime(shopOrder?.createdAt || order.createdAt),
      deliveryLabel: formatDateTime(order.deliveryAt),
      shopOrderCode: shopOrder?.orderCode || "Shop online",
      shopTotalLabel: shopOrder ? formatCurrency(shopOrder.totalCents) : formatCurrency(order.totalCents),
      mainPhase: order.mainPhase,
      sourceLabel: notificationSource.label,
      sourceTone: notificationSource.tone
    };
  });
  const incomingEntries = incomingSalesOrders.map((salesOrder) => {
    const notificationSource = resolveSalesOrderSource({
      customerAccount: salesOrder.customerAccount,
      customerName: salesOrder.customer.name,
      salesOrderId: salesOrder.id
    });

    return {
      sortAt: salesOrder.placedAt || salesOrder.createdAt,
      id: salesOrder.id,
      href: `/orders/shop-preview/${salesOrder.id}`,
      orderCode: salesOrder.orderCode,
      title: salesOrder.items[0]?.label || "Ordine shop",
      customerName: salesOrder.customer.name,
      totalLabel: formatCurrency(salesOrder.totalCents),
      createdLabel: formatDateTime(salesOrder.placedAt || salesOrder.createdAt),
      deliveryLabel: salesOrder.status === "PAID" ? "Da convertire" : "Pagamento",
      shopOrderCode: salesOrder.orderCode,
      shopTotalLabel: formatCurrency(salesOrder.totalCents),
      mainPhase: "ACCETTATO" as MainPhase,
      sourceLabel: notificationSource.label,
      sourceTone: notificationSource.tone
    };
  });

  return {
    count: operationalCount + incomingCount,
    orders: [...operationalEntries, ...incomingEntries]
      .sort((first, second) => second.sortAt.getTime() - first.sortAt.getTime())
      .slice(0, safeLimit)
      .map(({ sortAt: _sortAt, ...entry }) => entry)
  };
}
