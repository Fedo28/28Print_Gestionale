import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../lib/auth-core";
import { describeLoginFailure } from "../lib/auth";

describe("auth helpers", () => {
  it("hashes and verifies passwords", () => {
    const hash = hashPassword("admin123");
    expect(hash).toContain(":");
    expect(verifyPassword("admin123", hash)).toBe(true);
    expect(verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("maps missing auth secret to a readable login error", () => {
    expect(describeLoginFailure(new Error("AUTH_SECRET mancante in produzione."))).toMatch(/AUTH_SECRET/i);
  });

  it("maps database initialization issues to a readable login error", () => {
    expect(describeLoginFailure(new Error("database connection failed"))).toMatch(/database/i);
  });
});
