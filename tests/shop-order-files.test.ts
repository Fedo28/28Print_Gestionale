import { describe, expect, it } from "vitest";
import { describeShopOrderFileFailure } from "../lib/shop-order-files";

describe("shop order files helpers", () => {
  it("maps supported upload validation failures to readable messages", () => {
    expect(describeShopOrderFileFailure(new Error("Formato file non supportato. Usa PDF, JPG o PNG."))).toBe(
      "Formato file non supportato. Usa PDF, JPG o PNG."
    );
  });

  it("falls back to a generic message for unknown errors", () => {
    expect(describeShopOrderFileFailure(new Error("boom"))).toBe("Upload file shop non riuscito.");
  });
});
