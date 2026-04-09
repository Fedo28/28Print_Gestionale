import { readFile } from "fs/promises";
import * as XLSX from "xlsx";
import { normalizeServiceCode, syncServiceCatalogEntries } from "@/lib/orders";
import { normalizeQuantityTiers } from "@/lib/pricing";

export type ServiceCatalogImportRow = {
  code: string;
  name: string;
  description?: string;
  basePriceCents: number;
  quantityTiers?: string;
  active: boolean;
};

export type ServiceCatalogImportError = {
  row: number;
  message: string;
  code?: string;
};

export type ServiceCatalogImportParseResult = {
  validRows: ServiceCatalogImportRow[];
  errors: ServiceCatalogImportError[];
  totalRows: number;
};

export type ServiceCatalogImportExecutionResult = {
  created: number;
  updated: number;
  errors: ServiceCatalogImportError[];
  validRows: number;
  totalRows: number;
};

export type ServiceCatalogBootstrapResult = ServiceCatalogImportExecutionResult & {
  skipped: boolean;
  existingCount: number;
  templatePath: string;
};

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function resolveCatalogSheetName(workbook: XLSX.WorkBook) {
  const preferredSheet = workbook.SheetNames.find((sheetName) => normalizeHeader(sheetName) === "catalogo");
  if (preferredSheet) {
    return preferredSheet;
  }

  const requiredHeaderGroups = [
    ["code", "name"],
    ["base_price", "prezzo_base"]
  ];

  return workbook.SheetNames.find((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return false;
    }

    const firstRow = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      blankrows: false
    })[0];

    if (!Array.isArray(firstRow)) {
      return false;
    }

    const normalizedHeaders = new Set(
      firstRow
        .map((value) => normalizeHeader(String(value || "")))
        .filter(Boolean)
    );

    return requiredHeaderGroups.every((group) => group.some((header) => normalizedHeaders.has(header)));
  });
}

function parseBasePriceToCents(value: unknown) {
  if (typeof value === "number") {
    return Math.max(0, Math.round(value * 100));
  }

  const normalized = String(value || "").trim().replace(/\./g, "").replace(",", ".");
  if (!normalized) {
    throw new Error("Prezzo base mancante.");
  }

  const parsed = Number.parseFloat(normalized);
  if (Number.isNaN(parsed)) {
    throw new Error("Prezzo base non valido.");
  }

  return Math.max(0, Math.round(parsed * 100));
}

function parseActiveValue(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return ["true", "1", "si", "sì", "yes", "y", "attivo"].includes(normalized);
}

export function parseServiceCatalogWorkbook(buffer: Buffer): ServiceCatalogImportParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = resolveCatalogSheetName(workbook);

  if (!sheetName) {
    throw new Error("Il file Excel non contiene un foglio catalogo valido.");
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
    defval: ""
  });

  if (!rawRows.length) {
    throw new Error("Il file Excel non contiene righe dati.");
  }

  const errors: ServiceCatalogImportError[] = [];
  const validRows: ServiceCatalogImportRow[] = [];
  const seenCodes = new Set<string>();

  rawRows.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const row = Object.fromEntries(
      Object.entries(rawRow).map(([key, value]) => [normalizeHeader(key), value])
    );

    try {
      const code = normalizeServiceCode(String(row.code || ""));
      const name = String(row.name || "").trim();

      if (!name) {
        throw new Error("Nome servizio mancante.");
      }

      if (seenCodes.has(code)) {
        throw new Error("Codice duplicato nel file.");
      }

      seenCodes.add(code);
      validRows.push({
        code,
        name,
        description: String(row.description || "").trim() || undefined,
        basePriceCents: parseBasePriceToCents(row.base_price || row.prezzo_base),
        quantityTiers: normalizeQuantityTiers(
          String(row.quantity_tiers || row.scaglioni_quantita || row.scaglioni || "").trim()
        ),
        active: parseActiveValue(row.active)
      });
    } catch (error) {
      errors.push({
        row: rowNumber,
        code: String(row.code || "").trim() || undefined,
        message: error instanceof Error ? error.message : "Errore di import non previsto."
      });
    }
  });

  return {
    validRows,
    errors,
    totalRows: rawRows.length
  };
}

export async function loadServiceCatalogWorkbookFromFile(filePath: string) {
  const buffer = await readFile(filePath);
  return parseServiceCatalogWorkbook(buffer);
}

export async function importServiceCatalogWorkbookBuffer(buffer: Buffer): Promise<ServiceCatalogImportExecutionResult> {
  const parsed = parseServiceCatalogWorkbook(buffer);
  const result = await syncServiceCatalogEntries(parsed.validRows);

  return {
    ...result,
    errors: parsed.errors,
    validRows: parsed.validRows.length,
    totalRows: parsed.totalRows
  };
}

export async function importServiceCatalogWorkbookFile(filePath: string): Promise<ServiceCatalogImportExecutionResult> {
  const buffer = await readFile(filePath);
  return importServiceCatalogWorkbookBuffer(buffer);
}

export async function bootstrapServiceCatalogTemplateIfEmpty(options: {
  templatePath: string;
  countServices: () => Promise<number>;
  importWorkbookFile: (filePath: string) => Promise<ServiceCatalogImportExecutionResult>;
  logger?: Pick<Console, "log" | "warn">;
}): Promise<ServiceCatalogBootstrapResult> {
  const { templatePath, countServices, importWorkbookFile, logger = console } = options;
  const existingCount = await countServices();

  if (existingCount > 0) {
    logger.log(`Service catalog bootstrap skipped. Existing services: ${existingCount}.`);
    return {
      skipped: true,
      existingCount,
      templatePath,
      created: 0,
      updated: 0,
      errors: [],
      validRows: 0,
      totalRows: 0
    };
  }

  const result = await importWorkbookFile(templatePath);
  if (result.validRows === 0) {
    throw new Error("Il template catalogo non contiene righe valide.");
  }

  logger.log(
    `Service catalog bootstrap completed from ${templatePath}. Created: ${result.created}. Updated: ${result.updated}. Valid rows: ${result.validRows}.`
  );

  if (result.errors.length > 0) {
    logger.warn(`Service catalog bootstrap skipped ${result.errors.length} invalid rows from the template.`);
  }

  return {
    skipped: false,
    existingCount,
    templatePath,
    ...result
  };
}
