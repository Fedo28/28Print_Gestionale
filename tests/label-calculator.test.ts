import { describe, expect, it } from "vitest";
import {
  buildShopLabelSummaryLines,
  computeShopLabelQuote,
  isLabelCalculatorMaterialService
} from "../lib/label-calculator";

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

  it("calculates shop labels with the gestionale margin and a one-square-meter minimum", () => {
    const smallRun = computeShopLabelQuote({
      heightCm: 5,
      material: "polimerico",
      pricePerSqmCents: 4800,
      quantity: 100,
      widthCm: 5
    });

    expect(smallRun).toMatchObject({
      calculationSqm: 1.001,
      billableSqm: 1,
      labelAreaSqm: 0.695,
      minimumQuantity: 278,
      quantity: 278,
      totalCents: 6800
    });

    const largerRun = computeShopLabelQuote({
      heightCm: 5,
      material: "polimerico",
      pricePerSqmCents: 4800,
      quantity: 500,
      widthCm: 5
    });

    expect(largerRun).toMatchObject({
      calculationSqm: 1.8,
      billableSqm: 2,
      quantity: 500,
      totalCents: 11600
    });

    const nextStepRun = computeShopLabelQuote({
      heightCm: 5,
      material: "polimerico",
      pricePerSqmCents: 4800,
      quantity: 300,
      widthCm: 5
    });

    expect(nextStepRun).toMatchObject({
      calculationSqm: 1.08,
      billableSqm: 1.5,
      quantity: 300,
      totalCents: 9200
    });
    expect(buildShopLabelSummaryLines(smallRun)).toEqual([
      "Materiale: Polimerico",
      "Formato etichetta: 5x5 cm",
      "Etichette: 278 pz",
      "Area calcolo: 1,0 mq",
      "Area conteggiata: 1 mq",
      "Impianto: 20,00 EUR"
    ]);
  });
});
