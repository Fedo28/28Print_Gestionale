import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  auditLog: { findMany: vi.fn() },
  domainEvent: { findMany: vi.fn() },
  order: { findMany: vi.fn() },
  $transaction: vi.fn()
}));

vi.mock("../lib/prisma", () => ({ prisma: db }));

import { getOrderIdsCreatedBy } from "../lib/order-creators";
import { buildOrdersFilterHref, parseOrderCreatorFilter } from "../lib/order-filters";
import { createOrder, getOrdersList, getOrderSearchSuggestions, getOrdersTabCounts } from "../lib/orders";

beforeEach(() => {
  vi.resetAllMocks();
  db.auditLog.findMany.mockResolvedValue([]);
  db.domainEvent.findMany.mockResolvedValue([]);
  db.order.findMany.mockResolvedValue([]);
});

describe("order creator filtering", () => {
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
    expect(db.order.findMany).toHaveBeenCalledTimes(7);
    for (const [args] of db.order.findMany.mock.calls) {
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
