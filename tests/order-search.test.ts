import { describe, expect, it } from "vitest";
import { rankOrderSearchSuggestions, rankSearchableOrders } from "../lib/order-search";

const orders = [
  {
    id: "order-1",
    orderCode: "ORD-2026-001",
    title: "Insegna PVC fronte negozio",
    customer: {
      name: "Mario Rossi",
      phone: "+39 333 1111111",
      whatsapp: "+39 333 1111111",
      email: "mario.rossi@example.com",
      pec: null,
      taxCode: "RSSMRA80A01H501Z",
      vatNumber: null,
      uniqueCode: null
    }
  },
  {
    id: "order-2",
    orderCode: "ABC/900",
    title: "Biglietti da visita plastificati",
    customer: {
      name: "Officina Bianchi",
      phone: "+39 333 2222222",
      whatsapp: null,
      email: "info@officinabianchi.it",
      pec: "officinabianchi@pec.it",
      taxCode: null,
      vatNumber: "IT12345678901",
      uniqueCode: "XYZ7890"
    }
  }
];

describe("order search", () => {
  it("matches regardless of casing and separators", () => {
    expect(rankSearchableOrders(orders, "ord2026001").map((order) => order.id)).toEqual(["order-1"]);
    expect(rankSearchableOrders(orders, "ABC900").map((order) => order.id)).toEqual(["order-2"]);
  });

  it("matches customer details even with compact input", () => {
    expect(rankSearchableOrders(orders, "MARIOROSSI").map((order) => order.id)).toEqual(["order-1"]);
    expect(rankSearchableOrders(orders, "393332222222").map((order) => order.id)).toEqual(["order-2"]);
  });

  it("keeps near matches when terms are not in exact order", () => {
    expect(rankSearchableOrders(orders, "rossi mario").map((order) => order.id)).toEqual(["order-1"]);
    expect(rankSearchableOrders(orders, "visita biglietti").map((order) => order.id)).toEqual(["order-2"]);
  });

  it("suggests the newest matching customer orders before older ones regardless of delivery date", () => {
    const sameCustomerOrders = [
      { ...orders[0], id: "older", createdAt: new Date("2026-01-01"), deliveryAt: new Date("2026-12-01") },
      { ...orders[0], id: "newer", orderCode: "ORD-2026-002", createdAt: new Date("2026-10-01"), deliveryAt: new Date("2026-10-02") }
    ];
    expect(rankOrderSearchSuggestions(sameCustomerOrders, "Mario Rossi").map(order => order.id)).toEqual(["newer", "older"]);
  });

  it("keeps an exact order code ahead of newer partial matches", () => {
    const codeMatches = [
      { ...orders[0], id: "exact", createdAt: "2026-01-01" },
      { ...orders[0], id: "partial", orderCode: "ORD-2026-001-R", createdAt: "2026-10-01" }
    ];
    expect(rankOrderSearchSuggestions(codeMatches, "ORD-2026-001").map(order => order.id)).toEqual(["exact", "partial"]);
  });

  it("applies the quick suggestion limit after ranking by recency", () => {
    const history = Array.from({ length: 9 }, (_, index) => ({ ...orders[0], id: `order-${index + 1}`, orderCode: `ORD-2026-${index + 1}`, createdAt: `2026-10-${String(index + 1).padStart(2, "0")}` }));
    expect(rankOrderSearchSuggestions(history, "mariorossi").slice(0, 6).map(order => order.id)).toEqual(["order-9", "order-8", "order-7", "order-6", "order-5", "order-4"]);
  });
});
