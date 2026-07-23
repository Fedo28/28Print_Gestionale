import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const runDir = "/private/tmp/merge-clienti-20260723";
const sourceDir = path.join(runDir, "source-xlsx");
const previewDir = path.join(runDir, "aruba-integration-preview");
const outputDir = "/Users/federicopolichetti/Desktop/Gestionale V_GitHub/outputs/019f846b-e02d-7733-9dce-54695c99687f";
const summaryPath = path.join(runDir, "aruba-integration-summary.json");

const lists = [
  { id: "print", label: "28 Print", file: "28 print.xlsx", output: "Clienti_da_importare_28_Print.xlsx" },
  { id: "alt", label: "Alt", file: "Alt.xlsx", output: "Clienti_da_importare_Alt.xlsx" },
  { id: "pierre", label: "Pierre", file: "Pierre.xlsx", output: "Clienti_da_importare_Pierre.xlsx" },
  { id: "web", label: "Web", file: "Web.xlsx", output: "Clienti_da_importare_Web.xlsx" },
];

const colors = {
  navy: "#123B5D",
  blue: "#1565A8",
  sky: "#EAF4FB",
  paleBlue: "#F5F9FC",
  green: "#2F7D64",
  paleGreen: "#EAF6F1",
  amber: "#F0A428",
  paleAmber: "#FFF5DE",
  ink: "#1F2937",
  line: "#D9E2EA",
  white: "#FFFFFF",
};

function textValue(value) {
  return String(value ?? "").trim();
}

function normalizeIdentifier(value, numericLength = 0) {
  const compact = textValue(value)
    .toUpperCase()
    .replace(/^IT(?=\d)/, "")
    .replace(/[^A-Z0-9]/g, "");
  if (numericLength && /^\d+$/.test(compact) && compact.length < numericLength) {
    return compact.padStart(numericLength, "0");
  }
  return compact;
}

function canonical(value) {
  return textValue(value).replace(/\s+/g, " ").toUpperCase();
}

function nonEmptyCount(values) {
  return values.reduce((count, value) => count + (textValue(value) ? 1 : 0), 0);
}

class DisjointSet {
  constructor(size) {
    this.parent = Array.from({ length: size }, (_, index) => index);
    this.rank = Array(size).fill(0);
  }

  find(index) {
    if (this.parent[index] !== index) this.parent[index] = this.find(this.parent[index]);
    return this.parent[index];
  }

  union(left, right) {
    let leftRoot = this.find(left);
    let rightRoot = this.find(right);
    if (leftRoot === rightRoot) return;
    if (this.rank[leftRoot] < this.rank[rightRoot]) [leftRoot, rightRoot] = [rightRoot, leftRoot];
    this.parent[rightRoot] = leftRoot;
    if (this.rank[leftRoot] === this.rank[rightRoot]) this.rank[leftRoot] += 1;
  }
}

function selectAndMerge(group, headers, indexes, sourcePriority) {
  const ranked = [...group].sort((left, right) => {
    if (right.completeness !== left.completeness) return right.completeness - left.completeness;
    const priorityDifference = sourcePriority.get(left.listId) - sourcePriority.get(right.listId);
    if (priorityDifference !== 0) return priorityDifference;
    return left.sourceRow - right.sourceRow;
  });
  const base = ranked[0];
  const values = [...base.values];
  for (const candidate of ranked.slice(1)) {
    for (let column = 0; column < headers.length; column += 1) {
      if (!values[column] && candidate.values[column]) values[column] = candidate.values[column];
    }
  }

  const vatValues = [...new Set(group.map((record) => record.vat).filter(Boolean))];
  const taxValues = [...new Set(group.map((record) => record.taxCode).filter(Boolean))];
  values[indexes.vat] = base.vat || vatValues[0] || "";
  values[indexes.taxCode] = base.taxCode || taxValues[0] || "";
  return {
    values,
    vat: values[indexes.vat],
    taxCode: values[indexes.taxCode],
    group,
  };
}

function consolidate(records, headers, indexes, sourcePriority) {
  const withKey = records.filter((record) => record.vat || record.taxCode);
  const withoutKey = records.filter((record) => !record.vat && !record.taxCode);
  const disjointSet = new DisjointSet(withKey.length);
  const vatOwners = new Map();
  const taxOwners = new Map();

  for (let index = 0; index < withKey.length; index += 1) {
    const record = withKey[index];
    for (const [key, ownerMap] of [[record.vat, vatOwners], [record.taxCode, taxOwners]]) {
      if (!key) continue;
      if (ownerMap.has(key)) disjointSet.union(index, ownerMap.get(key));
      else ownerMap.set(key, index);
    }
  }

  const groups = new Map();
  for (let index = 0; index < withKey.length; index += 1) {
    const root = disjointSet.find(index);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(withKey[index]);
  }

  return {
    records: [...groups.values()].map((group) => selectAndMerge(group, headers, indexes, sourcePriority)),
    withoutKey,
  };
}

function addClientSheet(workbook, headers, rows, indexes) {
  const sheet = workbook.worksheets.add("Clienti");
  sheet.showGridLines = false;
  sheet.getRangeByIndexes(0, 0, rows.length + 1, headers.length).values = [headers, ...rows];
  if (rows.length) {
    const table = sheet.tables.add(`A1:W${rows.length + 1}`, true, "ClientiDaImportare");
    table.style = "TableStyleMedium2";
    table.showBandedRows = true;
    table.showFilterButton = true;
  }
  sheet.freezePanes.freezeRows(1);
  sheet.getRange("A1:W1").format = {
    fill: colors.blue,
    font: { bold: true, color: colors.white },
    verticalAlignment: "center",
    wrapText: true,
  };
  sheet.getRange("A1:W1").format.rowHeight = 34;
  if (rows.length) {
    sheet.getRange(`A2:W${rows.length + 1}`).format = {
      font: { color: colors.ink },
      verticalAlignment: "top",
    };
    sheet.getRange(`C2:C${rows.length + 1}`).format.numberFormat = "0000000";
    sheet.getRange(`H2:H${rows.length + 1}`).format.numberFormat = "00000000000";
    sheet.getRange(`I2:I${rows.length + 1}`).format.numberFormat = "00000000000";
    sheet.getRange(`O2:O${rows.length + 1}`).format.numberFormat = "00000";
    rows.forEach((row, rowIndex) => {
      const phone = textValue(row[indexes.phone]);
      if (/^\d+$/.test(phone)) sheet.getCell(rowIndex + 1, indexes.phone).format.numberFormat = "0".repeat(phone.length);
    });
  }
  const widths = [14, 12, 23, 31, 29, 16, 10, 16, 19, 46, 16, 16, 14, 10, 10, 11, 21, 38, 15, 18, 23, 20, 20];
  widths.forEach((width, index) => {
    sheet.getRangeByIndexes(0, index, rows.length + 1, 1).format.columnWidth = width;
  });
  return sheet;
}

function addSummarySheet(workbook, target, metrics, sourceRows) {
  const sheet = workbook.worksheets.add("Riepilogo");
  sheet.showGridLines = false;
  sheet.mergeCells("A1:H1");
  sheet.getRange("A1").values = [[`CLIENTI DA IMPORTARE IN ${target.label.toUpperCase()}`]];
  sheet.getRange("A1:H1").format = {
    fill: colors.navy,
    font: { bold: true, color: colors.white, size: 18 },
    verticalAlignment: "center",
  };
  sheet.getRange("A1:H1").format.rowHeight = 38;
  sheet.mergeCells("A2:H2");
  sheet.getRange("A2").values = [["Il foglio Clienti contiene esclusivamente le anagrafiche mancanti nella lista di destinazione, pronte per l'importazione Aruba."]];
  sheet.getRange("A2:H2").format = {
    fill: colors.sky,
    font: { color: colors.navy, italic: true },
    verticalAlignment: "center",
  };
  sheet.getRange("A2:H2").format.rowHeight = 26;

  const clientFormula = metrics.clientsToImport ? `=COUNTA('Clienti'!B2:B${metrics.clientsToImport + 1})` : "=0";
  sheet.getRange("A4:B10").values = [
    ["Indicatore", "Valore"],
    ["Righe nella lista di destinazione", metrics.targetRows],
    ["Righe ricevute dalle altre liste", metrics.incomingRows],
    ["Duplicati tra le liste accorpati", metrics.incomingDuplicates],
    ["Già presenti nella lista di destinazione", metrics.alreadyPresent],
    ["Righe senza chiave fiscale", metrics.withoutKey],
    ["Clienti da importare", null],
  ];
  sheet.getRange("B10").formulas = [[clientFormula]];
  sheet.getRange("A4:B4").format = {
    fill: colors.blue,
    font: { bold: true, color: colors.white },
  };
  sheet.getRange("A5:B10").format = {
    fill: colors.paleBlue,
    borders: { preset: "inside", style: "thin", color: colors.line },
  };
  sheet.getRange("B5:B10").format = {
    fill: colors.paleGreen,
    font: { bold: true, color: colors.green, size: 14 },
    horizontalAlignment: "center",
    numberFormat: "#,##0",
  };

  sheet.getRange("D4:E7").values = [
    ["Liste di provenienza", "Righe"],
    ...sourceRows,
  ];
  sheet.getRange("D4:E4").format = {
    fill: colors.amber,
    font: { bold: true, color: colors.ink },
  };
  sheet.getRange("D5:E7").format = {
    fill: colors.paleAmber,
    borders: { preset: "inside", style: "thin", color: colors.line },
  };
  sheet.mergeCells("D9:H10");
  sheet.getRange("D9").values = [["Criterio: P.IVA e codice fiscale identificano i duplicati. Per ogni cliente duplicato si conserva il record più completo e si completano solo i campi vuoti con i dati delle altre liste."]];
  sheet.getRange("D9:H10").format = {
    fill: colors.paleAmber,
    font: { color: colors.ink },
    verticalAlignment: "center",
    wrapText: true,
  };
  sheet.mergeCells("A12:H13");
  sheet.getRange("A12").values = [["Prima dell'importazione in Aruba, seleziona il foglio Clienti: non contiene anagrafiche già presenti nella lista di destinazione."]];
  sheet.getRange("A12:H13").format = {
    fill: colors.paleGreen,
    font: { bold: true, color: colors.green },
    verticalAlignment: "center",
    wrapText: true,
  };
  sheet.freezePanes.freezeRows(2);
  sheet.getRange("A1:H13").format.font.name = "Aptos";
  sheet.getRange("A1:A13").format.columnWidth = 35;
  sheet.getRange("B1:B13").format.columnWidth = 16;
  sheet.getRange("C1:C13").format.columnWidth = 5;
  sheet.getRange("D1:D13").format.columnWidth = 25;
  sheet.getRange("E1:H13").format.columnWidth = 18;
  return sheet;
}

const sourcePriority = new Map(lists.map((list, index) => [list.id, index]));
const loadedLists = new Map();
let headers = [];

for (const list of lists) {
  const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(path.join(sourceDir, list.file)));
  const sheet = workbook.worksheets.getItemAt(0);
  const rows = sheet.getUsedRange(true).values;
  const fileHeaders = rows[0].map(textValue);
  if (!headers.length) headers = fileHeaders;
  else if (JSON.stringify(headers) !== JSON.stringify(fileHeaders)) throw new Error(`Intestazioni non coerenti nel file ${list.file}.`);
  loadedLists.set(list.id, rows.slice(1)
    .filter((row) => row.some((value) => textValue(value)))
    .map((row, index) => ({
      listId: list.id,
      sourceRow: index + 2,
      values: headers.map((_, column) => textValue(row[column])),
    })));
}

const indexes = {
  vat: headers.indexOf("Partita Iva"),
  taxCode: headers.indexOf("Codice Fiscale"),
  phone: headers.indexOf("Telefono"),
  name: headers.indexOf("Denominazione"),
};
for (const required of [indexes.vat, indexes.taxCode, indexes.phone, indexes.name]) {
  if (required < 0) throw new Error("Manca una delle colonne necessarie per l'integrazione.");
}

for (const records of loadedLists.values()) {
  for (const record of records) {
    record.vat = normalizeIdentifier(record.values[indexes.vat], 11);
    record.taxCode = normalizeIdentifier(record.values[indexes.taxCode], 11);
    record.completeness = nonEmptyCount(record.values);
  }
}

await fs.mkdir(previewDir, { recursive: true });
await fs.mkdir(outputDir, { recursive: true });
const results = [];

for (const target of lists) {
  const targetRecords = loadedLists.get(target.id);
  const targetVatKeys = new Set(targetRecords.map((record) => record.vat).filter(Boolean));
  const targetTaxKeys = new Set(targetRecords.map((record) => record.taxCode).filter(Boolean));
  const incoming = lists
    .filter((list) => list.id !== target.id)
    .flatMap((list) => loadedLists.get(list.id));
  const consolidated = consolidate(incoming, headers, indexes, sourcePriority);
  const existing = [];
  const missing = [];

  for (const record of consolidated.records) {
    const vatMatch = record.group.some((source) => source.vat && targetVatKeys.has(source.vat));
    const taxMatch = record.group.some((source) => source.taxCode && targetTaxKeys.has(source.taxCode));
    if (vatMatch || taxMatch) existing.push({ record, vatMatch, taxMatch });
    else missing.push(record);
  }

  missing.sort((left, right) => {
    const nameDifference = canonical(left.values[indexes.name]).localeCompare(canonical(right.values[indexes.name]), "it");
    if (nameDifference !== 0) return nameDifference;
    return (left.vat || left.taxCode).localeCompare(right.vat || right.taxCode, "it");
  });
  const vatKeys = missing.map((record) => record.vat).filter(Boolean);
  const taxKeys = missing.map((record) => record.taxCode).filter(Boolean);
  const duplicateVatKeys = [...new Set(vatKeys.filter((key, index) => vatKeys.indexOf(key) !== index))];
  const duplicateTaxKeys = [...new Set(taxKeys.filter((key, index) => taxKeys.indexOf(key) !== index))];
  if (duplicateVatKeys.length || duplicateTaxKeys.length) {
    throw new Error(`${target.label}: chiavi duplicate nel file di integrazione.`);
  }

  const rows = missing.map((record) => record.values.map((value) => value || null));
  const metrics = {
    targetRows: targetRecords.length,
    incomingRows: incoming.length,
    incomingDuplicates: incoming.length - consolidated.records.length - consolidated.withoutKey.length,
    alreadyPresent: existing.length,
    withoutKey: consolidated.withoutKey.length,
    clientsToImport: rows.length,
    existingByVat: existing.filter((entry) => entry.vatMatch).length,
    existingByTaxCode: existing.filter((entry) => entry.taxMatch).length,
  };
  const workbook = Workbook.create();
  addClientSheet(workbook, headers, rows, indexes);
  addSummarySheet(
    workbook,
    target,
    metrics,
    lists
      .filter((list) => list.id !== target.id)
      .map((list) => [list.label, loadedLists.get(list.id).length]),
  );

  const summaryCheck = await workbook.inspect({
    kind: "table",
    range: "Riepilogo!A1:H13",
    include: "values,formulas",
    tableMaxRows: 15,
    tableMaxCols: 10,
    maxChars: 6000,
  });
  console.log(`${target.label}\n${summaryCheck.ndjson}`);
  const errors = await workbook.inspect({
    kind: "match",
    searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
    options: { useRegex: true, maxResults: 100 },
    summary: `${target.label} formula error scan`,
    maxChars: 2000,
  });
  console.log(errors.ndjson);

  for (const [sheetName, range] of [["Riepilogo", "A1:H13"], ["Clienti", `A1:W${Math.min(rows.length + 1, 18)}`]]) {
    const preview = await workbook.render({ sheetName, range, scale: 1, format: "png" });
    await fs.writeFile(
      path.join(previewDir, `${target.id}-${sheetName}.png`),
      new Uint8Array(await preview.arrayBuffer()),
    );
  }

  const outputPath = path.join(outputDir, target.output);
  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(outputPath);
  const exported = await SpreadsheetFile.importXlsx(await FileBlob.load(outputPath));
  const exportedValues = exported.worksheets.getItem("Clienti").getUsedRange(true).values;
  const exportedHeaders = exportedValues[0].map(textValue);
  const exportedRows = exportedValues.length - 1;
  if (JSON.stringify(exportedHeaders) !== JSON.stringify(headers) || exportedRows !== rows.length) {
    throw new Error(`${target.label}: struttura o numero di righe non coerente dopo l'esportazione.`);
  }
  const exportedVatKeys = [];
  const exportedTaxKeys = [];
  for (const row of exportedValues.slice(1)) {
    const vat = normalizeIdentifier(row[indexes.vat], 11);
    const taxCode = normalizeIdentifier(row[indexes.taxCode], 11);
    if (vat && targetVatKeys.has(vat)) throw new Error(`${target.label}: P.IVA già presente trovata nel file esportato.`);
    if (taxCode && targetTaxKeys.has(taxCode)) throw new Error(`${target.label}: codice fiscale già presente trovato nel file esportato.`);
    if (vat) exportedVatKeys.push(vat);
    if (taxCode) exportedTaxKeys.push(taxCode);
  }
  const duplicateExportedVat = [...new Set(exportedVatKeys.filter((key, index) => exportedVatKeys.indexOf(key) !== index))];
  const duplicateExportedTax = [...new Set(exportedTaxKeys.filter((key, index) => exportedTaxKeys.indexOf(key) !== index))];
  if (duplicateExportedVat.length || duplicateExportedTax.length) {
    throw new Error(`${target.label}: chiavi duplicate trovate dopo l'esportazione.`);
  }
  results.push({ target: target.label, outputPath, ...metrics });
}

await fs.writeFile(summaryPath, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
console.log(JSON.stringify({ summaryPath, results }, null, 2));
