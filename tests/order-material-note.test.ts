import { describe, expect, it } from "vitest";
import {
  buildOrderMaterialNoteContent,
  createEmptyOrderMaterialCategoryCounts,
  parseOrderMaterialNoteContent
} from "../lib/order-material-note";

describe("order material note utils", () => {
  it("builds material note content from categories and free notes", () => {
    expect(
      buildOrderMaterialNoteContent({
        content: "Stampare anche il campione colore.",
        categoryEntries: [
          { key: "adesivi", label: "Adesivi", quantity: 2 },
          { key: "uv", label: "UV", quantity: 1 }
        ]
      })
    ).toBe("Categorie:\n- Adesivi: 2\n- UV: 1\n\nStampare anche il campione colore.");
  });

  it("parses composed material note content back into counters and note body", () => {
    const parsed = parseOrderMaterialNoteContent(
      "Categorie:\n- Abbigliamento: 3\n- Carta plotter: 1\n\nConfermare il fornitore prima di ordinare."
    );

    expect(parsed.content).toBe("Confermare il fornitore prima di ordinare.");
    expect(parsed.categoryCounts).toEqual({
      ...createEmptyOrderMaterialCategoryCounts(),
      abbigliamento: "3",
      carta_plotter: "1"
    });
  });
});
