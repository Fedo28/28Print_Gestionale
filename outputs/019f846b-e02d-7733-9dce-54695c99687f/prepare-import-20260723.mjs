import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const runDir = "/private/tmp/merge-clienti-20260723";
const sourceDir = path.join(runDir, "source-xlsx");
const previewDir = path.join(runDir, "merged-preview");
const outputDir = "/Users/federicopolichetti/Desktop/Gestionale V_GitHub/outputs/019f846b-e02d-7733-9dce-54695c99687f";
const workbookPath = path.join(outputDir, "Clienti_unificati_2026-07-23.xlsx");
const sourceJsonPath = path.join(runDir, "customer-import-source.json");
const files = ["28 print.xlsx", "Alt.xlsx", "Pierre.xlsx", "Web.xlsx"];

const colors = {
  navy: "#123B5D",
  blue: "#1565A8",
  sky: "#EAF4FB",
  paleBlue: "#F5F9FC",
  amber: "#F0A428",
  paleAmber: "#FFF5DE",
  green: "#2F7D64",
  paleGreen: "#EAF6F1",
  red: "#B54747",
  paleRed: "#FCEEEE",
  ink: "#1F2937",
  muted: "#5E6B78",
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

function cleanCustomerName(value) {
  const compact = textValue(value).replace(/\s+/g, " ");
  const quoteCount = (compact.match(/"/g) || []).length;
  return compact.startsWith('"') && quoteCount === 1 ? compact.slice(1).trim() : compact;
}

function sourceLabel(file) {
  return path.parse(file).name;
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

function distinctValues(group, column) {
  const seen = new Set();
  const values = [];
  for (const record of group) {
    const value = textValue(record.values[column]);
    const key = canonical(value);
    if (!value || seen.has(key)) continue;
    seen.add(key);
    values.push(value);
  }
  return values;
}

function addTableOrHeader(sheet, range, tableName, hasRows) {
  if (!hasRows) return;
  const table = sheet.tables.add(range, true, tableName);
  table.style = "TableStyleMedium2";
  table.showBandedRows = true;
  table.showFilterButton = true;
}

const sourcePriority = new Map(files.map((file, index) => [sourceLabel(file), index]));
const records = [];
const sourceCounts = [];
let headers = [];

for (const file of files) {
  const workbook = await SpreadsheetFile.importXlsx(
    await FileBlob.load(path.join(sourceDir, file)),
  );
  const worksheet = workbook.worksheets.getItemAt(0);
  const rows = worksheet.getUsedRange(true).values;
  const fileHeaders = rows[0].map(textValue);
  if (!headers.length) {
    headers = fileHeaders;
  } else if (JSON.stringify(headers) !== JSON.stringify(fileHeaders)) {
    throw new Error(`Le intestazioni non coincidono nel file ${file}.`);
  }

  const vatIndex = headers.indexOf("Partita Iva");
  const taxCodeIndex = headers.indexOf("Codice Fiscale");
  let count = 0;
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    if (!rows[rowIndex].some((value) => textValue(value))) continue;
    const values = headers.map((_, column) => textValue(rows[rowIndex][column]));
    records.push({
      id: records.length,
      source: sourceLabel(file),
      sourceRow: rowIndex + 1,
      values,
      vat: normalizeIdentifier(values[vatIndex], 11),
      taxCode: normalizeIdentifier(values[taxCodeIndex], 11),
      completeness: nonEmptyCount(values),
    });
    count += 1;
  }
  sourceCounts.push([sourceLabel(file), count]);
}

const nameIndex = headers.indexOf("Denominazione");
const vatIndex = headers.indexOf("Partita Iva");
const taxCodeIndex = headers.indexOf("Codice Fiscale");
const phoneIndex = headers.indexOf("Telefono");
for (const requiredIndex of [nameIndex, vatIndex, taxCodeIndex]) {
  if (requiredIndex < 0) throw new Error("Manca una colonna obbligatoria.");
}

const keyedRecords = records.filter((record) => record.vat || record.taxCode);
const withoutKey = records.filter((record) => !record.vat && !record.taxCode);
const disjointSet = new DisjointSet(keyedRecords.length);
const vatOwners = new Map();
const taxOwners = new Map();

for (let index = 0; index < keyedRecords.length; index += 1) {
  const record = keyedRecords[index];
  for (const [key, owners] of [[record.vat, vatOwners], [record.taxCode, taxOwners]]) {
    if (!key) continue;
    if (owners.has(key)) disjointSet.union(index, owners.get(key));
    else owners.set(key, index);
  }
}

const groups = new Map();
for (let index = 0; index < keyedRecords.length; index += 1) {
  const root = disjointSet.find(index);
  if (!groups.has(root)) groups.set(root, []);
  groups.get(root).push(keyedRecords[index]);
}

function rankGroup(group) {
  return [...group].sort((left, right) => {
    if (right.completeness !== left.completeness) return right.completeness - left.completeness;
    const priority = sourcePriority.get(left.source) - sourcePriority.get(right.source);
    if (priority !== 0) return priority;
    return left.sourceRow - right.sourceRow;
  });
}

const merged = [];
const duplicateRows = [];
for (const group of groups.values()) {
  const ranked = rankGroup(group);
  const base = ranked[0];
  const values = [...base.values];
  for (const candidate of ranked.slice(1)) {
    for (let column = 0; column < headers.length; column += 1) {
      if (!values[column] && candidate.values[column]) values[column] = candidate.values[column];
    }
  }

  const vatValues = [...new Set(group.map((record) => record.vat).filter(Boolean))];
  const taxValues = [...new Set(group.map((record) => record.taxCode).filter(Boolean))];
  const selectedVat = base.vat || vatValues[0] || "";
  const selectedTaxCode = base.taxCode || taxValues[0] || "";
  values[nameIndex] = cleanCustomerName(values[nameIndex]);
  values[vatIndex] = selectedVat;
  values[taxCodeIndex] = selectedTaxCode;
  merged.push({
    values,
    vat: selectedVat,
    taxCode: selectedTaxCode,
    base,
    group,
  });

  if (group.length > 1) {
    const differingFields = headers
      .map((header, column) => ({ header, values: distinctValues(group, column) }))
      .filter(({ values: fieldValues }) => fieldValues.length > 1);
    duplicateRows.push([
      selectedVat ? "P.IVA / C.F." : "Codice fiscale",
      selectedVat || selectedTaxCode,
      values[nameIndex],
      group.length,
      group.length - 1,
      `${base.source}, riga ${base.sourceRow}`,
      group.map((record) => `${record.source} riga ${record.sourceRow}`).join("; "),
      differingFields.map(({ header }) => header).join(", "),
      differingFields.map(({ header, values: fieldValues }) => `${header}: ${fieldValues.join(" | ")}`).join("; "),
    ]);
  }
}

merged.sort((left, right) => {
  const nameDiff = canonical(left.values[nameIndex]).localeCompare(canonical(right.values[nameIndex]), "it");
  if (nameDiff !== 0) return nameDiff;
  return (left.vat || left.taxCode).localeCompare(right.vat || right.taxCode, "it");
});
duplicateRows.sort((left, right) => canonical(left[2]).localeCompare(canonical(right[2]), "it"));

const vatKeys = merged.map((record) => record.vat).filter(Boolean);
const taxKeys = merged.map((record) => record.taxCode).filter(Boolean);
const duplicateVatKeys = [...new Set(vatKeys.filter((key, index) => vatKeys.indexOf(key) !== index))];
const duplicateTaxKeys = [...new Set(taxKeys.filter((key, index) => taxKeys.indexOf(key) !== index))];
if (duplicateVatKeys.length || duplicateTaxKeys.length) {
  throw new Error(JSON.stringify({ duplicateVatKeys, duplicateTaxKeys }, null, 2));
}

const mergedRows = merged.map((record) => record.values.map((value) => value || null));
const importRecords = merged.map((record, index) => ({
  sourceRow: index + 2,
  vatNumberNormalized: record.vat,
  taxCodeNormalized: record.taxCode,
  values: Object.fromEntries(headers.map((header, column) => [header, record.values[column]])),
}));
const metadata = {
  generatedAt: new Date().toISOString(),
  sourceFiles: files,
  sourceCounts: Object.fromEntries(sourceCounts),
  sourceRows: records.length,
  mergedRows: merged.length,
  duplicateGroups: duplicateRows.length,
  duplicateRowsRemoved: keyedRecords.length - merged.length,
  rowsWithoutFiscalKey: withoutKey.length,
};

await fs.mkdir(runDir, { recursive: true });
await fs.writeFile(
  sourceJsonPath,
  JSON.stringify({ workbookPath, headers, records: importRecords, metadata }, null, 2),
);

const workbook = Workbook.create();
const clientsSheet = workbook.worksheets.add("Clienti");
const summarySheet = workbook.worksheets.add("Riepilogo");
const duplicatesSheet = workbook.worksheets.add("Duplicati");
const excludedSheet = workbook.worksheets.add("Senza chiave fiscale");

clientsSheet.showGridLines = false;
clientsSheet.getRangeByIndexes(0, 0, mergedRows.length + 1, headers.length).values = [headers, ...mergedRows];
addTableOrHeader(clientsSheet, `A1:W${mergedRows.length + 1}`, "ClientiUnificati20260723", mergedRows.length > 0);
clientsSheet.freezePanes.freezeRows(1);
clientsSheet.getRange("A1:W1").format = {
  fill: colors.blue,
  font: { bold: true, color: colors.white },
  verticalAlignment: "center",
  wrapText: true,
};
clientsSheet.getRange("A1:W1").format.rowHeight = 34;
if (mergedRows.length) {
  clientsSheet.getRange(`A2:W${mergedRows.length + 1}`).format = {
    font: { color: colors.ink },
    verticalAlignment: "top",
  };
  clientsSheet.getRange(`C2:C${mergedRows.length + 1}`).format.numberFormat = "0000000";
  clientsSheet.getRange(`H2:H${mergedRows.length + 1}`).format.numberFormat = "00000000000";
  clientsSheet.getRange(`I2:I${mergedRows.length + 1}`).format.numberFormat = "00000000000";
  clientsSheet.getRange(`O2:O${mergedRows.length + 1}`).format.numberFormat = "00000";
  mergedRows.forEach((row, index) => {
    const phone = textValue(row[phoneIndex]);
    if (/^\d+$/.test(phone)) {
      clientsSheet.getCell(index + 1, phoneIndex).format.numberFormat = "0".repeat(phone.length);
    }
  });
}
const clientWidths = [14, 12, 23, 31, 29, 16, 10, 16, 19, 46, 16, 16, 14, 10, 10, 11, 21, 38, 15, 18, 23, 20, 20];
clientWidths.forEach((width, index) => {
  clientsSheet.getRangeByIndexes(0, index, mergedRows.length + 1, 1).format.columnWidth = width;
});

summarySheet.showGridLines = false;
summarySheet.mergeCells("A1:H1");
summarySheet.getRange("A1").values = [["ANAGRAFICHE CLIENTI CONSOLIDATE"]];
summarySheet.getRange("A1:H1").format = {
  fill: colors.navy,
  font: { bold: true, color: colors.white, size: 18 },
  verticalAlignment: "center",
};
summarySheet.getRange("A1:H1").format.rowHeight = 38;
summarySheet.mergeCells("A2:H2");
summarySheet.getRange("A2").values = [["P.IVA e codice fiscale sono normalizzati e usati per eliminare le anagrafiche duplicate."]];
summarySheet.getRange("A2:H2").format = {
  fill: colors.sky,
  font: { color: colors.navy, italic: true },
  verticalAlignment: "center",
};
summarySheet.getRange("A4:B9").values = [
  ["Indicatore", "Valore"],
  ["Righe nei quattro file", records.length],
  ["Anagrafiche consolidate", merged.length],
  ["Gruppi duplicati", duplicateRows.length],
  ["Righe duplicate eliminate", metadata.duplicateRowsRemoved],
  ["Righe senza P.IVA e C.F.", withoutKey.length],
];
summarySheet.getRange("A4:B4").format = {
  fill: colors.blue,
  font: { bold: true, color: colors.white },
};
summarySheet.getRange("A5:B9").format = {
  fill: colors.paleBlue,
  borders: { preset: "inside", style: "thin", color: colors.line },
};
summarySheet.getRange("B5:B9").format = {
  fill: colors.paleGreen,
  font: { bold: true, color: colors.green, size: 14 },
  horizontalAlignment: "center",
  numberFormat: "#,##0",
};
summarySheet.getRange("D4:E8").values = [
  ["File sorgente", "Righe"],
  ...sourceCounts,
];
summarySheet.getRange("D4:E4").format = {
  fill: colors.amber,
  font: { bold: true, color: colors.ink },
};
summarySheet.getRange("D5:E8").format = {
  fill: colors.paleAmber,
  borders: { preset: "inside", style: "thin", color: colors.line },
};
summarySheet.mergeCells("A11:H13");
summarySheet.getRange("A11").values = [[
  "Regola: i record che condividono P.IVA o codice fiscale vengono accorpati. Si mantiene il record più completo e si compilano soltanto i campi vuoti con i dati presenti nelle altre righe.",
]];
summarySheet.getRange("A11:H13").format = {
  fill: colors.paleAmber,
  font: { color: colors.ink },
  verticalAlignment: "center",
  wrapText: true,
};
summarySheet.getRange("A1:A13").format.columnWidth = 34;
summarySheet.getRange("B1:B13").format.columnWidth = 16;
summarySheet.getRange("C1:C13").format.columnWidth = 5;
summarySheet.getRange("D1:D13").format.columnWidth = 24;
summarySheet.getRange("E1:H13").format.columnWidth = 16;
summarySheet.freezePanes.freezeRows(2);

const duplicateHeaders = [
  "Chiave",
  "Valore selezionato",
  "Anagrafica risultante",
  "Occorrenze",
  "Righe eliminate",
  "Record base",
  "Righe sorgente",
  "Campi discordanti",
  "Valori rilevati",
];
duplicatesSheet.showGridLines = false;
duplicatesSheet.getRangeByIndexes(0, 0, duplicateRows.length + 1, duplicateHeaders.length).values = [
  duplicateHeaders,
  ...duplicateRows,
];
addTableOrHeader(duplicatesSheet, `A1:I${duplicateRows.length + 1}`, "Duplicati20260723", duplicateRows.length > 0);
duplicatesSheet.freezePanes.freezeRows(1);
duplicatesSheet.getRange("A1:I1").format = {
  fill: colors.amber,
  font: { bold: true, color: colors.ink },
  wrapText: true,
};
const duplicateWidths = [17, 20, 36, 12, 15, 28, 48, 36, 72];
duplicateWidths.forEach((width, index) => {
  duplicatesSheet.getRangeByIndexes(0, index, duplicateRows.length + 1, 1).format.columnWidth = width;
});
if (duplicateRows.length) duplicatesSheet.getRange(`A2:I${duplicateRows.length + 1}`).format.wrapText = true;

const excludedRows = withoutKey.map((record) => [
  record.source,
  record.sourceRow,
  record.values[nameIndex],
  ...record.values,
]);
const excludedHeaders = ["File", "Riga", "Denominazione", ...headers];
excludedSheet.showGridLines = false;
excludedSheet.getRangeByIndexes(0, 0, excludedRows.length + 1, excludedHeaders.length).values = [
  excludedHeaders,
  ...excludedRows,
];
addTableOrHeader(
  excludedSheet,
  `A1:Z${excludedRows.length + 1}`,
  "SenzaChiaveFiscale20260723",
  excludedRows.length > 0,
);
excludedSheet.freezePanes.freezeRows(1);
excludedSheet.getRange("A1:Z1").format = {
  fill: colors.red,
  font: { bold: true, color: colors.white },
  wrapText: true,
};
excludedSheet.getRange("A1:A1").format.columnWidth = 20;
excludedSheet.getRange("B1:B1").format.columnWidth = 10;
excludedSheet.getRange("C1:C1").format.columnWidth = 42;

const errorScan = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "formula error scan",
  maxChars: 3000,
});
console.log(errorScan.ndjson);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });
for (const [sheetName, range] of [
  ["Riepilogo", "A1:H13"],
  ["Clienti", `A1:W${Math.min(mergedRows.length + 1, 18)}`],
  ["Duplicati", `A1:I${Math.min(duplicateRows.length + 1, 14)}`],
]) {
  const preview = await workbook.render({ sheetName, range, scale: 1, format: "png" });
  await fs.writeFile(
    path.join(previewDir, `${sheetName}.png`),
    new Uint8Array(await preview.arrayBuffer()),
  );
}

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(workbookPath);
const exported = await SpreadsheetFile.importXlsx(await FileBlob.load(workbookPath));
const exportedRows = exported.worksheets.getItem("Clienti").getUsedRange(true).values.length - 1;
if (exportedRows !== mergedRows.length) {
  throw new Error(`Verifica post-esportazione fallita: ${exportedRows} righe invece di ${mergedRows.length}.`);
}

console.log(JSON.stringify({
  workbookPath,
  sourceJsonPath,
  ...metadata,
  vatKeys: vatKeys.length,
  taxKeys: taxKeys.length,
  duplicateVatKeys,
  duplicateTaxKeys,
}, null, 2));
