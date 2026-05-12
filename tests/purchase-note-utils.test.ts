import { describe, expect, it } from "vitest";
import {
  normalizePurchaseNoteContent,
  normalizePurchaseNoteCustomerName,
  sortCompletedPurchaseNotes,
  sortPendingPurchaseNotes
} from "../lib/purchase-note-utils";

describe("purchase note utils", () => {
  it("normalizes customer names by trimming and collapsing spaces", () => {
    expect(normalizePurchaseNoteCustomerName("  Officina   Rossi   ")).toBe("Officina Rossi");
  });

  it("trims content while preserving line breaks", () => {
    expect(normalizePurchaseNoteContent("\n  pannelli forex\nurgente  \n")).toBe("pannelli forex\nurgente");
  });

  it("sorts pending notes from newest to oldest", () => {
    const notes = [
      { id: "a", createdAt: "2026-05-09T09:00:00.000Z", urgency: "NORMALE" as const },
      { id: "b", createdAt: "2026-05-11T08:00:00.000Z", urgency: "URGENTE" as const },
      { id: "c", createdAt: "2026-05-12T08:00:00.000Z", urgency: "NORMALE" as const },
      { id: "d", createdAt: "2026-05-08T08:00:00.000Z", urgency: "BLOCCANTE" as const }
    ];

    expect(sortPendingPurchaseNotes(notes).map((note) => note.id)).toEqual(["d", "b", "c", "a"]);
  });

  it("sorts completed notes by completion date before fallback creation date", () => {
    const notes = [
      { id: "a", createdAt: "2026-05-08T08:00:00.000Z", completedAt: "2026-05-10T09:00:00.000Z", urgency: "NORMALE" as const },
      { id: "b", createdAt: "2026-05-10T08:00:00.000Z", completedAt: "2026-05-11T10:00:00.000Z", urgency: "URGENTE" as const },
      { id: "c", createdAt: "2026-05-11T07:00:00.000Z", completedAt: "2026-05-11T10:00:00.000Z", urgency: "BLOCCANTE" as const }
    ];

    expect(sortCompletedPurchaseNotes(notes).map((note) => note.id)).toEqual(["c", "b", "a"]);
  });
});
