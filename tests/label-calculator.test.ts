import { describe, expect, it } from "vitest";
import { isLabelCalculatorMaterialService } from "../lib/label-calculator";

describe("label calculator materials", () => {
  it("recognizes legacy exact material names", () => {
    expect(isLabelCalculatorMaterialService({ name: "Etichette - Polimerico stampa e taglio" })).toBe(true);
    expect(isLabelCalculatorMaterialService({ name: "Etichette - Monomerico laminato stampa e taglio" })).toBe(true);
  });

  it("recognizes label materials even with naming variations", () => {
    expect(isLabelCalculatorMaterialService({ name: "Etichette polimerico stampa taglio lucido" })).toBe(true);
    expect(isLabelCalculatorMaterialService({ code: "ETICHETTE_PRINT_CUT_POLYMERIC" })).toBe(true);
  });

  it("ignores unrelated catalog services", () => {
    expect(isLabelCalculatorMaterialService({ name: "Biglietti da visita" })).toBe(false);
    expect(isLabelCalculatorMaterialService({ name: "Etichette semplici pretagliate" })).toBe(false);
  });
});
