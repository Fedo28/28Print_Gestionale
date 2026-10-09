import { prisma } from "@/lib/prisma";
import { RICK_MANUAL_ORDER_NOTIFICATION_TOPIC } from "@/lib/shop-notification-inbox";

export async function getOrderCreatorProfiles() {
  return prisma.user.findMany({
    select: { id: true, name: true, nickname: true, active: true },
    orderBy: [{ active: "desc" }, { name: "asc" }, { nickname: "asc" }]
  });
}

export async function getOrderIdsCreatedBy(userId: string) {
  const [creationLogs, legacyEvents] = await Promise.all([
    prisma.auditLog.findMany({
      where: { entityType: "ORDER", actionType: "CREATED", actorUserId: userId },
      select: { entityId: true }
    }),
    prisma.domainEvent.findMany({
      where: {
        entityType: "Order",
        payloadJson: { path: ["actorUserId"], equals: userId },
        OR: [
          { topic: RICK_MANUAL_ORDER_NOTIFICATION_TOPIC },
          {
            topic: "staff.order.rick_push",
            AND: { payloadJson: { path: ["stage"], equals: "created" } }
          }
        ]
      },
      select: { entityId: true }
    })
  ]);

  return [...new Set([...creationLogs, ...legacyEvents].map((entry) => entry.entityId))];
}
