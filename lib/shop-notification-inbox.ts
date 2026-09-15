import type { Prisma } from "@prisma/client";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { resolveShopNotificationSource, type ShopNotificationSourceTone } from "@/lib/shop-notification-source";

export const SHOP_SALES_ORDER_NOTIFICATION_TOPIC = "shop.sales_order.notification";
export const RICK_MANUAL_ORDER_NOTIFICATION_TOPIC = "staff.order.rick_notification";
const ORDER_NOTIFICATION_TOPICS = [
  SHOP_SALES_ORDER_NOTIFICATION_TOPIC,
  RICK_MANUAL_ORDER_NOTIFICATION_TOPIC
];

type ShopSalesOrderNotificationInput = {
  customerAccountEmail?: string | null;
  customerAccountEmailNormalized?: string | null;
  customerName: string;
  salesOrderCode: string;
  salesOrderId: string;
  staffEmail?: string | null;
  staffName?: string | null;
  staffNickname?: string | null;
  totalCents: number;
};

type RickManualOrderNotificationInput = {
  actorEmail?: string | null;
  actorName?: string | null;
  actorNickname?: string | null;
  actorUserId: string;
  customerName: string;
  orderCode: string;
  orderId: string;
  title: string;
  totalCents: number;
};

function getPayloadString(payload: Prisma.JsonValue | null, key: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const value = payload[key as keyof typeof payload];
  return typeof value === "string" ? value : null;
}

function getPayloadNumber(payload: Prisma.JsonValue | null, key: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const value = payload[key as keyof typeof payload];
  return typeof value === "number" ? value : null;
}

function getPayloadDate(payload: Prisma.JsonValue | null, key: string) {
  const value = getPayloadString(payload, key);
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function createShopSalesOrderNotification(input: ShopSalesOrderNotificationInput) {
  const source = resolveShopNotificationSource({
    customerAccountEmail: input.customerAccountEmail,
    customerAccountEmailNormalized: input.customerAccountEmailNormalized,
    customerName: input.customerName,
    staffEmail: input.staffEmail,
    staffName: input.staffName,
    staffNickname: input.staffNickname
  });
  const payload = {
    customerName: input.customerName,
    href: `/orders/shop-preview/${input.salesOrderId}`,
    salesOrderCode: input.salesOrderCode,
    salesOrderId: input.salesOrderId,
    sourceLabel: source.label,
    sourceTone: source.tone,
    totalCents: input.totalCents
  } satisfies Prisma.InputJsonObject;

  const event = await prisma.domainEvent.upsert({
    where: {
      dedupeKey: `shop.notification.sales_order:${input.salesOrderId}`
    },
    update: {
      payloadJson: payload,
      processedAt: null,
      status: "PENDING"
    },
    create: {
      topic: SHOP_SALES_ORDER_NOTIFICATION_TOPIC,
      entityType: "SalesOrder",
      entityId: input.salesOrderId,
      dedupeKey: `shop.notification.sales_order:${input.salesOrderId}`,
      payloadJson: payload,
      status: "PENDING"
    },
    select: {
      id: true
    }
  });

  return {
    eventId: event.id,
    source
  };
}

export async function createRickManualOrderNotification(input: RickManualOrderNotificationInput) {
  const payload = {
    actorEmail: input.actorEmail || null,
    actorName: input.actorName || null,
    actorNickname: input.actorNickname || null,
    actorUserId: input.actorUserId,
    customerName: input.customerName,
    href: `/orders/${input.orderId}`,
    orderCode: input.orderCode,
    orderId: input.orderId,
    sourceLabel: "Rick",
    sourceTone: "rick",
    title: input.title,
    totalCents: input.totalCents
  } satisfies Prisma.InputJsonObject;

  const event = await prisma.domainEvent.upsert({
    where: {
      dedupeKey: `staff.notification.rick_order:${input.orderId}`
    },
    update: {
      payloadJson: payload,
      processedAt: null,
      status: "PENDING"
    },
    create: {
      topic: RICK_MANUAL_ORDER_NOTIFICATION_TOPIC,
      entityType: "Order",
      entityId: input.orderId,
      dedupeKey: `staff.notification.rick_order:${input.orderId}`,
      payloadJson: payload,
      status: "PENDING"
    },
    select: {
      id: true
    }
  });

  return {
    eventId: event.id,
    source: {
      label: "Rick",
      tone: "rick" as const
    }
  };
}

export async function listUnreadShopSalesOrderNotifications(limit = 8) {
  const safeLimit = Math.max(1, limit);
  const where = {
    topic: {
      in: ORDER_NOTIFICATION_TOPICS
    },
    status: "PENDING"
  } satisfies Prisma.DomainEventWhereInput;
  const [count, events] = await Promise.all([
    prisma.domainEvent.count({ where }),
    prisma.domainEvent.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take: safeLimit,
      select: {
        createdAt: true,
        entityId: true,
        id: true,
        payloadJson: true,
        topic: true
      }
    })
  ]);

  return {
    count,
    orders: events.map((event) => {
      const payload = event.payloadJson;
      if (event.topic === RICK_MANUAL_ORDER_NOTIFICATION_TOPIC) {
        const orderId = getPayloadString(payload, "orderId") || event.entityId;
        const orderCode = getPayloadString(payload, "orderCode") || "Ordine Rick";
        const customerName = getPayloadString(payload, "customerName") || "Cliente";
        const totalCents = getPayloadNumber(payload, "totalCents") || 0;

        return {
          notificationId: event.id,
          id: event.id,
          href: getPayloadString(payload, "href") || `/orders/${orderId}`,
          orderCode,
          title: getPayloadString(payload, "title") || "Ordine Rick",
          customerName,
          totalLabel: formatCurrency(totalCents),
          createdLabel: formatDateTime(getPayloadDate(payload, "createdAt") || event.createdAt),
          deliveryLabel: "",
          shopOrderCode: orderCode,
          shopTotalLabel: formatCurrency(totalCents),
          sourceLabel: "Rick",
          sourceTone: "rick" as ShopNotificationSourceTone
        };
      }

      const salesOrderId = getPayloadString(payload, "salesOrderId") || event.entityId;
      const salesOrderCode = getPayloadString(payload, "salesOrderCode") || "Ordine shop";
      const customerName = getPayloadString(payload, "customerName") || "Cliente shop";
      const totalCents = getPayloadNumber(payload, "totalCents") || 0;
      const sourceTone = getPayloadString(payload, "sourceTone") === "rick" ? "rick" : "shop";

      return {
        notificationId: event.id,
        id: event.id,
        href: getPayloadString(payload, "href") || `/orders/shop-preview/${salesOrderId}`,
        orderCode: salesOrderCode,
        title: "Ordine shop",
        customerName,
        totalLabel: formatCurrency(totalCents),
        createdLabel: formatDateTime(getPayloadDate(payload, "createdAt") || event.createdAt),
        deliveryLabel: "",
        shopOrderCode: salesOrderCode,
        shopTotalLabel: formatCurrency(totalCents),
        sourceLabel: getPayloadString(payload, "sourceLabel") || (sourceTone === "rick" ? "Rick" : "Shop online"),
        sourceTone: sourceTone as ShopNotificationSourceTone
      };
    })
  };
}

export async function markShopSalesOrderNotificationRead(notificationId: string) {
  const id = notificationId.trim();
  if (!id) {
    return;
  }

  await prisma.domainEvent.updateMany({
    where: {
      id,
      topic: {
        in: ORDER_NOTIFICATION_TOPICS
      }
    },
    data: {
      processedAt: new Date(),
      status: "PROCESSED"
    }
  });
}
