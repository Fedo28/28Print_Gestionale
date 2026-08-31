import type { MainPhase, Prisma } from "@prisma/client";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { getDisplayOrderLabel } from "@/lib/order-display";
import { prisma } from "@/lib/prisma";

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

export async function listPendingShopOnlineOperationalOrders(limit = 8) {
  const [count, orders] = await Promise.all([
    prisma.order.count({
      where: pendingShopOnlineOperationalOrderWhere
    }),
    prisma.order.findMany({
      where: pendingShopOnlineOperationalOrderWhere,
      orderBy: [{ createdAt: "desc" }],
      take: limit,
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
                orderCode: true,
                createdAt: true,
                totalCents: true
              }
            }
          }
        }
      }
    })
  ]);

  return {
    count,
    orders: orders.map((order) => {
      const shopOrder = order.salesOrderLinks[0]?.salesOrder;

      return {
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
        mainPhase: order.mainPhase
      };
    })
  };
}
