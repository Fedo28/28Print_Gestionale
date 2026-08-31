import { describe, expect, it } from "vitest";
import {
  normalizeCustomerAccountEmail,
  normalizeCustomerAccountFullName,
  normalizeCustomerAccountPhone,
  validateCustomerAccountPassword
} from "../lib/customer-accounts";

describe("customer account helpers", () => {
  it("normalizes customer registration identity fields", () => {
    expect(normalizeCustomerAccountFullName("  Mario    Rossi  ")).toBe("Mario Rossi");
    expect(normalizeCustomerAccountPhone("  +39 333   1234567  ")).toBe("+39 333 1234567");
    expect(normalizeCustomerAccountEmail(" Mario.Rossi@Example.COM ")).toBe("mario.rossi@example.com");
  });

  it("rejects invalid customer account credentials", () => {
    expect(() => normalizeCustomerAccountEmail("mario")).toThrow(/email valida/i);
    expect(() => normalizeCustomerAccountPhone("12")).toThrow(/telefono valido/i);
    expect(() => validateCustomerAccountPassword("1234567")).toThrow(/8 caratteri/i);
  });
});
