import { describe, expect, it } from "vitest";
import { getCustomerSearchScore, normalizeCustomerSearchValue, rankCustomers } from "../lib/customer-search";

const customers = [
  {
    id: "1",
    name: "Mario Rossi",
    phone: "+39 333 1111111",
    email: "mario.rossi@example.com",
    pec: null,
    whatsapp: "+39 333 1111111",
    taxCode: "RSSMRA80A01H501Z",
    vatNumber: null,
    uniqueCode: null,
    type: "PUBBLICO" as const
  },
  {
    id: "2",
    name: "Officina Rossi",
    phone: "+39 333 2222222",
    email: "info@officinarossi.it",
    pec: "officinarossi@pec.it",
    whatsapp: null,
    taxCode: null,
    vatNumber: "IT12345678901",
    uniqueCode: "ABC1234",
    type: "AZIENDA" as const
  }
];

describe("customer search", () => {
  it("normalizes accents and casing", () => {
    expect(normalizeCustomerSearchValue("  Àziènda Rossi ")).toBe("azienda rossi");
  });

  it("ranks exact name matches before broader partial matches", () => {
    const ranked = rankCustomers(customers, "Officina Rossi");
    expect(ranked.map((customer) => customer.id)).toEqual(["2"]);
  });

  it("matches on phone, email and fiscal data", () => {
    expect(rankCustomers(customers, "2222222").map((customer) => customer.id)).toEqual(["2"]);
    expect(rankCustomers(customers, "officinarossi").map((customer) => customer.id)).toEqual(["2"]);
    expect(rankCustomers(customers, "pec.it").map((customer) => customer.id)).toEqual(["2"]);
    expect(rankCustomers(customers, "RSSMRA80A01H501Z").map((customer) => customer.id)).toEqual(["1"]);
    expect(rankCustomers(customers, "IT12345678901").map((customer) => customer.id)).toEqual(["2"]);
    expect(rankCustomers(customers, "ABC1234").map((customer) => customer.id)).toEqual(["2"]);
  });

  it("returns no score for non matching customers", () => {
    expect(getCustomerSearchScore(customers[0], "beta prova")).toBe(Number.MAX_SAFE_INTEGER);
  });
});
