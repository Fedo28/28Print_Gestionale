import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { getOrdersList, getOrdersListPage, getOrdersTabCounts } from "../lib/orders";
import { getShopNotificationRevision, RICK_MANUAL_ORDER_NOTIFICATION_TOPIC } from "../lib/shop-notification-inbox";

const url = process.env.PRINT_BRIDGE_TEST_DATABASE_URL;
if (url) {
  const target = new URL(url);
  if (target.hostname !== "127.0.0.1" || target.port !== "54339" || target.pathname !== "/fede_print_bridge_test" ||
    process.env.DATABASE_URL !== url) throw Error("Order count tests require the isolated local print database.");
}
describe.runIf(Boolean(url))("optimized order counts against PostgreSQL", () => {
  const customerId = randomUUID();
  const marker = `Count-${randomUUID()}`;
  beforeAll(async () => {
    await prisma.customer.create({ data: { id: customerId, name: marker, type: "AZIENDA" } });
    const phases = ["ACCETTATO", "IN_LAVORAZIONE", "CALENDARIZZATO", "SVILUPPO_COMPLETATO", "CONSEGNATO"] as const;
    for (const [index, mainPhase] of phases.entries()) {
      const id = randomUUID();
      await prisma.order.create({ data: { id, orderCode: id, customerId, title: `${marker} Caffè`,
        titleNormalized: id, createdOn: "2026-10-19", deliveryAt: new Date(Date.now() + index * 86400000), mainPhase,
        operationalStatus: index === 2 ? "IN_ATTESA_MATERIALE" : "ATTIVO",
        priority: "BASSA", paymentStatus: index % 2 ? "PAGATO" : "NON_PAGATO" } });
    }
  });
  afterAll(async () => {
    await prisma.order.deleteMany({ where: { customerId } });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.$disconnect();
  });
  it("pages match the existing lists under every sort, direction and view", async () => {
    const data = Array.from({ length: 110 }, (_, n) => {
      const id = randomUUID();
      return { id, orderCode: id, customerId, title: `${marker} Caffè ${n}`, titleNormalized: id,
        createdOn: "2026-10-19", deliveryAt: new Date(Date.now() + (n % 9) * 86400000),
        mainPhase: n % 2 ? "CONSEGNATO" as const : "ACCETTATO" as const,
        deliveredAt: n % 2 ? new Date(Date.now() - n * 1000) : null, totalCents: n * 100 };
    });
    await prisma.order.createMany({ data });
    for (const view of ["ACTIVE", "DELIVERED"] as const) {
      for (const sort of ["order", "customer", "delivery", "priority", "status", "amount"] as const) {
        for (const direction of ["asc", "desc"] as const) {
          const filters = { view, sort, direction, query: marker, quote: "ORDER" as const };
          const full = await getOrdersList(filters);
          const first = await getOrdersListPage(filters, 1);
          const second = await getOrdersListPage(filters, 2);
          expect(first.total).toBe(full.length);
          expect([...first.orders, ...second.orders].map(row => row.id)).toEqual(full.map(row => row.id));
        }
      }
    }
  });
  const tabs = ["TO_DO", "TO_START", "WORKING", "BLOCKED", "READY", "DELIVERED"] as const;
  it("notification revision detects payload edits, same-count replacements and read marks", async () => {
    const id = randomUUID();
    try {
      const empty = await getShopNotificationRevision();
      await prisma.domainEvent.create({ data: { id, topic: RICK_MANUAL_ORDER_NOTIFICATION_TOPIC,
        entityType: "Order", entityId: id, dedupeKey: id, payloadJson: { title: "A" } } });
      const first = await getShopNotificationRevision();
      expect(first).not.toBe(empty);
      expect(await getShopNotificationRevision()).toBe(first);
      await prisma.domainEvent.update({ where: { id }, data: { payloadJson: { title: "B" } } });
      expect(await getShopNotificationRevision()).not.toBe(first);
      await prisma.domainEvent.update({ where: { id }, data: { status: "PROCESSED" } });
      expect(await getShopNotificationRevision()).toBe(empty);
    } finally { await prisma.domainEvent.deleteMany({ where: { id } }); }
  });
  it.each([
    {}, { query: "caffe" }, { priority: "URGENTE" as const },
    { priority: "BASSA" as const, query: marker }, { payment: "NON_PAGATO" as const },
    { customerType: "AZIENDA" as const }, { shop: "ONLINE" as const }
  ])("matches the displayed lists for %j", async filters => {
    const counts = await getOrdersTabCounts({ ...filters, quote: "ORDER" });
    for (const tab of tabs) {
      const orders = await getOrdersList({ ...filters, quote: "ORDER",
        view: tab === "DELIVERED" ? "DELIVERED" : "ACTIVE", preset: tab === "DELIVERED" ? "ALL" : tab });
      expect(counts[tab], tab).toBe(orders.length);
    }
  });
});
