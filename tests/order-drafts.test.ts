import { describe, expect, it } from "vitest";
import {
  buildOrderDraftStorageKey,
  createEmptyOrderDraftFields,
  hasMeaningfulOrderDraft,
  parseOrderDraftSnapshot
} from "@/lib/order-drafts";

describe("order drafts", () => {
  it("builds stable storage keys", () => {
    expect(buildOrderDraftStorageKey("order")).toBe("gestionale.order-draft.order");
    expect(buildOrderDraftStorageKey("quote")).toBe("gestionale.order-draft.quote");
  });

  it("parses valid draft payloads", () => {
    const snapshot = parseOrderDraftSnapshot(
      JSON.stringify({
        version: 1,
        kind: "order",
        savedAt: "2026-04-08T18:00:00.000Z",
        selectedCustomerId: "customer-1",
        customerQuery: "Rossi",
        fields: {
          title: "Biglietti visita"
        },
        items: [
          {
            label: "Biglietti visita",
            quantity: 0.5,
            discountMode: "NONE"
          }
        ]
      })
    );

    expect(snapshot?.fields.title).toBe("Biglietti visita");
    expect(snapshot?.items[0]?.quantity).toBe("0,5");
    expect(snapshot?.selectedCustomerId).toBe("customer-1");
  });

  it("detects meaningful draft content", () => {
    expect(
      hasMeaningfulOrderDraft({
        selectedCustomerId: "",
        customerQuery: "",
        fields: createEmptyOrderDraftFields(),
        items: []
      })
    ).toBe(false);

    expect(
      hasMeaningfulOrderDraft({
        selectedCustomerId: "",
        customerQuery: "",
        fields: {
          ...createEmptyOrderDraftFields(),
          title: "Preventivo vetrina"
        },
        items: []
      })
    ).toBe(true);
  });
});
