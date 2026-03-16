import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../lib/auth-core";

describe("auth helpers", () => {
  it("hashes and verifies passwords", () => {
    const hash = hashPassword("admin123");
    expect(hash).toContain(":");
    expect(verifyPassword("admin123", hash)).toBe(true);
    expect(verifyPassword("wrong-password", hash)).toBe(false);
  });
});
