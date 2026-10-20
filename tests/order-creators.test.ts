import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  auditLog: { findMany: vi.fn() },
  domainEvent: { findMany: vi.fn() },
  order: { findMany: vi.fn(), count: vi.fn() },
  $transaction: vi.fn()
}));

vi.mock("../lib/prisma", () => ({ prisma: db }));

import { getOrderIdsCreatedBy } from "../lib/order-creators";
import { buildOrdersFilterHref, parseOrderCreatorFilter } from "../lib/order-filters";
import { createOrder, getOrdersList, getOrdersListPage, getOrderSearchSuggestions, getOrdersTabCounts } from "../lib/orders";

beforeEach(() => {
  vi.resetAllMocks();
  db.auditLog.findMany.mockResolvedValue([]);
  db.domainEvent.findMany.mockResolvedValue([]);
  db.order.findMany.mockResolvedValue([]);
  db.order.count.mockResolvedValue(0);
});

describe("order creator filtering", () => {
  it("expands at most 50 rows and keeps pagination after sorting", async () => {
    const rows = Array.from({ length: 121 }, (_, n) => ({
      id: String(n), orderCode: String(n).padStart(3, "0"), title: `Ordine ${n}`,
      createdAt: new Date(), deliveryAt: new Date("2026-12-20"), deliveredAt: new Date("2026-12-20"),
      priority: "BASSA", mainPhase: "CONSEGNATO", operationalStatus: "ATTIVO", paymentStatus: "NON_PAGATO",
      totalCents: n, balanceDueCents: n, customer: { name: "Caffè" }
    }));
    db.order.findMany.mockImplementation(async args => args.select ? rows : [...rows].reverse().filter(row => args.where.id.in.includes(row.id)));
    const result = await getOrdersListPage({ view: "DELIVERED", sort: "order", direction: "asc", query: "caffe" }, 2);
    expect(result).toMatchObject({ total: 121, page: 2, pages: 3, pageSize: 50 });
    expect(result.orders.map(row => row.id)).toEqual(rows.slice(50, 100).map(row => row.id));
    const candidateQuery = db.order.findMany.mock.calls[0][0];
    expect(candidateQuery.include).toBeUndefined();
    expect(candidateQuery.select.workTasks).toBeUndefined();
    expect(candidateQuery.select.notes).toBeUndefined();
    expect(db.order.findMany.mock.calls[1][0].where.id.in).toHaveLength(50);
    expect((await getOrdersListPage({ view: "DELIVERED" }, 999)).page).toBe(3);
    expect((await getOrdersListPage({ view: "DELIVERED" }, NaN)).page).toBe(1);
  });

  it("suggestions use only searchable fields, without expanding order relations", async () => {
    await getOrderSearchSuggestions({ query: "caffe" });
    const args = db.order.findMany.mock.calls[0][0];
    expect(args.include).toBeUndefined();
    expect(args.select.workTasks).toBeUndefined();
    expect(args.select.customer.select.email).toBe(true);
  });

  it("combines recorded creators and historical Rick notifications without duplicates", async () => {
    db.auditLog.findMany.mockResolvedValue([{ entityId: "new-order" }, { entityId: "both-sources" }]);
    db.domainEvent.findMany.mockResolvedValue([{ entityId: "old-order" }, { entityId: "both-sources" }]);

    expect(await getOrderIdsCreatedBy("rick-id")).toEqual(["new-order", "both-sources", "old-order"]);
    expect(db.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { entityType: "ORDER", actionType: "CREATED", actorUserId: "rick-id" }
    }));
    expect(db.domainEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        entityType: "Order",
        payloadJson: { path: ["actorUserId"], equals: "rick-id" }
      })
    }));
  });

  it("keeps results, counts and search suggestions empty for a profile with no attributed orders", async () => {
    expect(await getOrdersList({ createdBy: "unused-profile", quote: "ORDER" })).toEqual([]);
    expect(await getOrderSearchSuggestions({ createdBy: "unused-profile", query: "biglietti" })).toEqual([]);
    expect(await getOrdersTabCounts({ createdBy: "unused-profile", quote: "ORDER" })).toEqual({
      TO_DO: 0, TO_START: 0, WORKING: 0, BLOCKED: 0, READY: 0, DELIVERED: 0
    });
    expect(db.order.findMany).not.toHaveBeenCalled();
  });

  it("combines the creator with other list filters and applies it to every tab and search", async () => {
    db.auditLog.findMany.mockResolvedValue([{ entityId: "rick-order" }]);
    await getOrdersList({ createdBy: "rick-id", payment: "NON_PAGATO", quote: "ORDER", view: "DELIVERED" });
    expect(db.order.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: { in: ["rick-order"] }, mainPhase: "CONSEGNATO", paymentStatus: "NON_PAGATO", isQuote: false
      })
    }));
    db.order.findMany.mockClear();
    await getOrdersTabCounts({ createdBy: "rick-id", quote: "ORDER" });
    await getOrderSearchSuggestions({ createdBy: "rick-id", query: "biglietti", quote: "ORDER" });
    expect(db.order.findMany).toHaveBeenCalledTimes(1);
    expect(db.order.count).toHaveBeenCalledTimes(6);
    for (const [args] of [...db.order.findMany.mock.calls, ...db.order.count.mock.calls]) {
      expect(args.where.id).toEqual({ in: ["rick-order"] });
    }
  });

  it("preserves the creator in links and removes it when selecting all profiles", () => {
    expect(parseOrderCreatorFilter(" ALL ")).toBeUndefined();
    expect(parseOrderCreatorFilter(null)).toBeUndefined();
    expect(parseOrderCreatorFilter(" rick-id ")).toBe("rick-id");
    const href = buildOrdersFilterHref({ view: "DELIVERED", createdBy: "rick-id", q: "biglietti", sort: "customer" });
    expect(new URL(href, "http://localhost").searchParams.get("createdBy")).toBe("rick-id");
    expect(buildOrdersFilterHref({ createdBy: "ALL" })).toBe("/orders");
    expect(buildOrdersFilterHref({ createdBy: undefined })).toBe("/orders");
  });

  it("counts directly in SQL with the same payment, customer and shop constraints", async () => {
    db.order.count.mockResolvedValue(17);
    expect(await getOrdersTabCounts({ payment: "NON_PAGATO", customerType: "PUBBLICO", shop: "ONLINE", quote: "ORDER" }))
      .toEqual({ TO_DO: 17, TO_START: 17, WORKING: 17, BLOCKED: 17, READY: 17, DELIVERED: 17 });
    expect(db.order.findMany).not.toHaveBeenCalled();
    for (const [args] of db.order.count.mock.calls) {
      expect(args.where).toMatchObject({ paymentStatus: "NON_PAGATO", customer: { type: "PUBBLICO" },
        salesOrderLinks: { some: { salesOrder: { origin: "SHOP_ONLINE" } } }, isQuote: false });
    }
    expect(db.order.count.mock.calls.map(([args]) => args.where.mainPhase)).toEqual([
      { notIn: ["CONSEGNATO", "SVILUPPO_COMPLETATO"] }, "ACCETTATO",
      { in: ["IN_LAVORAZIONE", "CALENDARIZZATO"] }, { not: "CONSEGNATO" }, "SVILUPPO_COMPLETATO", "CONSEGNATO"
    ]);
  });

  it("preserves accent-insensitive search without fetching notes, work assignments or items", async () => {
    db.order.findMany.mockResolvedValue([
      { id: "1", orderCode: "ORD-1", title: "Caffè", customer: { name: "Cliente" } },
      { id: "2", orderCode: "ORD-2", title: "Altro", customer: { name: "Cliente" } }
    ]);
    const counts = await getOrdersTabCounts({ query: "caffe" });
    expect(Object.values(counts)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(db.order.count).not.toHaveBeenCalled();
    for (const [args] of db.order.findMany.mock.calls) {
      expect(args.include).toBeUndefined();
      expect(args.select.notes).toBeUndefined();
      expect(args.select.items).toBeUndefined();
      expect(args.select.workTasks).toBeUndefined();
      expect(args.select.customer.select.name).toBe(true);
    }
  });

  it("uses automatic priority only for active orders and stored priority for delivered orders", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T12:00:00Z"));
    try {
      db.order.findMany.mockResolvedValue([
        { id: "1", deliveryAt: new Date("2026-10-19T12:00:00Z"), priority: "BASSA", mainPhase: "ACCETTATO" },
        { id: "2", deliveryAt: new Date("2026-11-19T12:00:00Z"), priority: "URGENTE", mainPhase: "ACCETTATO" }
      ]);
      db.order.count.mockResolvedValue(3);
      expect(await getOrdersTabCounts({ priority: "URGENTE" })).toEqual({
        TO_DO: 1, TO_START: 1, WORKING: 1, BLOCKED: 1, READY: 1, DELIVERED: 3
      });
      expect(db.order.count).toHaveBeenCalledWith({ where: { mainPhase: "CONSEGNATO", priority: "URGENTE" } });
      expect(db.order.findMany.mock.calls[0][0].select.customer).toBeUndefined();
    } finally { vi.useRealTimers(); }
  });
});

describe("creator registration", () => {
  it.each([false, true])("records the authenticated profile in the creation transaction (quote: %s)", async (isQuote) => {
    const tx = {
      order: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "new-order", orderCode: "ORD-1", title: "Biglietti", isQuote })
      },
      customer: { findUnique: vi.fn().mockResolvedValue({ id: "customer-1", name: "Cliente" }) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "creation-log" }) }
    };
    db.$transaction.mockImplementation(async (callback) => callback(tx));

    await createOrder({
      createdByUserId: "fedo-id", customerId: "customer-1", customer: {}, title: "Biglietti", isQuote,
      invoiceStatus: "DA_FATTURARE", items: [{ label: "Stampa", quantity: 1, unitPriceCents: 1000 }]
    });

    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      entityType: "ORDER", entityId: "new-order", actionType: "CREATED", actorUserId: "fedo-id"
    }) });
  });
});
