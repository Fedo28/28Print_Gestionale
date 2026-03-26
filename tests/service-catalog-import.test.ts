import path from "path";
import * as XLSX from "xlsx";
import { describe, expect, it, vi } from "vitest";
import {
  bootstrapServiceCatalogTemplateIfEmpty,
  loadServiceCatalogWorkbookFromFile,
  parseServiceCatalogWorkbook
} from "@/lib/service-catalog-import";

function buildWorkbook(rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, "Catalogo");
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
}

describe("service catalog import", () => {
  it("reads the bundled template workbook", async () => {
    const templatePath = path.resolve(process.cwd(), "catalogo_servizi_template.xlsx");
    const result = await loadServiceCatalogWorkbookFromFile(templatePath);

    expect(result.errors).toEqual([]);
    expect(result.validRows.length).toBeGreaterThan(0);
    expect(result.validRows[0]).toMatchObject({
      code: "ADESIVO_DA_MURO_PREZZO_AL_MQ",
      name: "Adesivo da muro - Prezzo al mq",
      basePriceCents: 7000,
      active: true
    });
  });

  it("keeps valid rows and reports invalid ones", () => {
    const buffer = buildWorkbook([
      ["code", "name", "base_price", "description", "quantity_tiers", "active"],
      ["BIGLIETTI_VISITA", "Biglietti da visita", "12,50", "", "1-9:12,50 | 10+:10,00", "true"],
      ["BIGLIETTI_VISITA", "Duplicato", "9,00", "", "", "true"],
      ["MANCANTE_PREZZO", "Servizio senza prezzo", "", "", "", "true"]
    ]);

    const result = parseServiceCatalogWorkbook(buffer);

    expect(result.validRows).toHaveLength(1);
    expect(result.validRows[0]).toMatchObject({
      code: "BIGLIETTI_VISITA",
      name: "Biglietti da visita",
      basePriceCents: 1250,
      quantityTiers: "1-9:12,50 | 10+:10,00",
      active: true
    });
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]?.message).toBe("Codice duplicato nel file.");
    expect(result.errors[1]?.message).toBe("Prezzo base mancante.");
  });
});

describe("service catalog bootstrap", () => {
  it("imports the template when the catalog is empty", async () => {
    const countServices = vi.fn().mockResolvedValue(0);
    const importWorkbookFile = vi.fn().mockResolvedValue({
      created: 3,
      updated: 0,
      errors: [{ row: 4, message: "Codice duplicato nel file." }],
      validRows: 3,
      totalRows: 4
    });
    const logger = {
      log: vi.fn(),
      warn: vi.fn()
    };

    const result = await bootstrapServiceCatalogTemplateIfEmpty({
      templatePath: "/tmp/catalogo.xlsx",
      countServices,
      importWorkbookFile,
      logger
    });

    expect(importWorkbookFile).toHaveBeenCalledWith("/tmp/catalogo.xlsx");
    expect(result).toMatchObject({
      skipped: false,
      existingCount: 0,
      created: 3,
      updated: 0,
      validRows: 3,
      totalRows: 4
    });
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining("Service catalog bootstrap completed"));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("1 invalid rows"));
  });

  it("skips the bootstrap when the catalog already exists", async () => {
    const countServices = vi.fn().mockResolvedValue(12);
    const importWorkbookFile = vi.fn();
    const logger = {
      log: vi.fn(),
      warn: vi.fn()
    };

    const result = await bootstrapServiceCatalogTemplateIfEmpty({
      templatePath: "/tmp/catalogo.xlsx",
      countServices,
      importWorkbookFile,
      logger
    });

    expect(importWorkbookFile).not.toHaveBeenCalled();
    expect(result.skipped).toBe(true);
    expect(result.existingCount).toBe(12);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining("Service catalog bootstrap skipped"));
  });
});
