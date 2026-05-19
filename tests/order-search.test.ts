import { describe, expect, it } from "vitest";
import { rankSearchableOrders } from "../lib/order-search";

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
});
