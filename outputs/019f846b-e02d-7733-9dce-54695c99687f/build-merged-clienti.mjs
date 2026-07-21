import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const sourceDir = "/private/tmp/merge-clienti-019f846b/source-xlsx";
const previewDir = "/private/tmp/merge-clienti-019f846b/final-preview";
const outputDir = "/Users/federicopolichetti/Desktop/Gestionale V_GitHub/outputs/019f846b-e02d-7733-9dce-54695c99687f";
const outputPath = path.join(outputDir, "Clienti_unificati_senza_duplicati.xlsx");
const files = [
  "ReportClienti 28 Print.xlsx",
  "ReportClienti 28 WEB.xlsx",
  "ReportClienti Pierre.xlsx",
  "ReportClienti.xlsx",
];

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
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeVat(value) {
  const raw = textValue(value).toUpperCase().replace(/^IT/, "");
  const compact = raw.replace(/[^A-Z0-9]/g, "");
  if (/^\d+$/.test(compact) && compact.length < 11) return compact.padStart(11, "0");
  return compact;
}

function normalizeTaxCode(value) {
  const compact = textValue(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (/^\d+$/.test(compact) && compact.length < 11) return compact.padStart(11, "0");
  return compact;
}

function canonical(value) {
  return textValue(value).replace(/\s+/g, " ").toUpperCase();
}

function nonEmptyCount(values) {
  return values.reduce((count, value) => count + (textValue(value) ? 1 : 0), 0);
}

function sourceLabel(file) {
  return path.parse(file).name;
}

const sourcePriority = new Map(files.map((file, index) => [sourceLabel(file), index]));
const records = [];
let headers = [];

for (const file of files) {
  const workbook = await SpreadsheetFile.importXlsx(
    await FileBlob.load(path.join(sourceDir, file)),
  );
  const sourceSheet = workbook.worksheets.getItemAt(0);
  const rows = sourceSheet.getUsedRange(true).values;
  const fileHeaders = rows[0].map(textValue);
  if (!headers.length) {
    headers = fileHeaders;
  } else if (JSON.stringify(headers) !== JSON.stringify(fileHeaders)) {
    throw new Error(`Le intestazioni non coincidono nel file ${file}.`);
  }

  const vatIndex = headers.indexOf("Partita Iva");
  const taxCodeIndex = headers.indexOf("Codice Fiscale");
  for (let index = 1; index < rows.length; index += 1) {
    if (!rows[index].some((value) => textValue(value))) continue;
    const values = rows[index].map(textValue);
    records.push({
      source: sourceLabel(file),
      sourceRow: index + 1,
      values,
      vat: normalizeVat(values[vatIndex]),
      taxCode: normalizeTaxCode(values[taxCodeIndex]),
      completeness: nonEmptyCount(values),
    });
  }
}

const vatIndex = headers.indexOf("Partita Iva");
const nameIndex = headers.indexOf("Denominazione");
const taxCodeIndex = headers.indexOf("Codice Fiscale");
const phoneIndex = headers.indexOf("Telefono");

const byVat = new Map();
const byTaxCode = new Map();
const withoutKey = [];
for (const record of records) {
  if (record.vat) {
    if (!byVat.has(record.vat)) byVat.set(record.vat, []);
    byVat.get(record.vat).push(record);
    continue;
  }
  if (record.taxCode) {
    if (!byTaxCode.has(record.taxCode)) byTaxCode.set(record.taxCode, []);
    byTaxCode.get(record.taxCode).push(record);
    continue;
  }
  withoutKey.push(record);
}

function rankedGroup(group) {
  return [...group].sort((left, right) => {
    if (right.completeness !== left.completeness) return right.completeness - left.completeness;
    const priorityDiff = sourcePriority.get(left.source) - sourcePriority.get(right.source);
    if (priorityDiff !== 0) return priorityDiff;
    return left.sourceRow - right.sourceRow;
  });
}

function mergeGroup(group) {
  const ranked = rankedGroup(group);
  const base = ranked[0];
  const values = [...base.values];
  for (const candidate of ranked.slice(1)) {
    for (let column = 0; column < values.length; column += 1) {
      if (!values[column] && candidate.values[column]) values[column] = candidate.values[column];
    }
  }
  if (base.vat) values[vatIndex] = base.vat;
  if (base.taxCode) values[taxCodeIndex] = base.taxCode;
  return { base, values };
}

function distinctValues(group, column) {
  const result = [];
  const seen = new Set();
  for (const record of group) {
    const value = textValue(record.values[column]);
    const key = canonical(value);
    if (!value || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

const mergedWithMeta = [];
const duplicateSummaries = [];
function appendGroups(groups, keyType) {
  for (const [key, group] of groups.entries()) {
    const merged = mergeGroup(group);
    mergedWithMeta.push({ values: merged.values, key, source: merged.base.source });

    if (group.length > 1) {
      const differing = headers
        .map((header, column) => ({ header, values: distinctValues(group, column) }))
        .filter(({ values }) => values.length > 1);
      duplicateSummaries.push([
        keyType,
        key,
        group.length,
        group.length - 1,
        merged.values[nameIndex],
        `${merged.base.source} - riga ${merged.base.sourceRow}`,
        group.map((record) => `${record.source} riga ${record.sourceRow}`).join("; "),
        differing.map(({ header }) => header).join(", "),
        differing.map(({ header, values }) => `${header}: ${values.join(" | ")}`).join("; "),
      ]);
    }
  }
}

appendGroups(byVat, "P.IVA");
appendGroups(byTaxCode, "Codice fiscale");

for (const record of withoutKey) {
  mergedWithMeta.push({ values: [...record.values], key: "", source: record.source });
}

mergedWithMeta.sort((left, right) => {
  const nameDiff = canonical(left.values[nameIndex]).localeCompare(canonical(right.values[nameIndex]), "it");
  if (nameDiff !== 0) return nameDiff;
  return left.key.localeCompare(right.key, "it");
});
duplicateSummaries.sort((left, right) => canonical(left[4]).localeCompare(canonical(right[4]), "it"));

const mergedRows = mergedWithMeta.map(({ values }) => values.map((value) => (value === "" ? null : value)));

const workbook = Workbook.create();
const clientsSheet = workbook.worksheets.add("Clienti");
const summarySheet = workbook.worksheets.add("Riepilogo");
const duplicatesSheet = workbook.worksheets.add("Duplicati");

// Clienti: stesso schema dei quattro file sorgente, pronto per filtri o reimportazione.
clientsSheet.showGridLines = false;
clientsSheet.getRangeByIndexes(0, 0, mergedRows.length + 1, headers.length).values = [headers, ...mergedRows];
const clientsTable = clientsSheet.tables.add(`A1:W${mergedRows.length + 1}`, true, "ClientiUnificatiTable");
clientsTable.style = "TableStyleMedium2";
clientsTable.showBandedRows = true;
clientsTable.showFilterButton = true;
clientsSheet.freezePanes.freezeRows(1);
clientsSheet.getRange("A1:W1").format = {
  fill: colors.blue,
  font: { bold: true, color: colors.white },
  verticalAlignment: "center",
  wrapText: true,
};
clientsSheet.getRange("A1:W1").format.rowHeight = 34;
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
clientsSheet.getRange(`J2:J${mergedRows.length + 1}`).format.wrapText = true;
clientsSheet.getRange(`R2:R${mergedRows.length + 1}`).format.wrapText = true;
const clientWidths = [14, 12, 23, 31, 29, 16, 10, 16, 19, 46, 16, 16, 14, 10, 10, 11, 21, 38, 15, 18, 23, 20, 20];
clientWidths.forEach((width, index) => {
  clientsSheet.getRangeByIndexes(0, index, mergedRows.length + 1, 1).format.columnWidth = width;
});
clientsSheet.getRange(`A2:W${mergedRows.length + 1}`).format.autofitRows();

// Duplicati: un riepilogo per gruppo, sia per P.IVA sia per codice fiscale alternativo.
const duplicateHeaders = [
  "Chiave usata",
  "Valore normalizzato",
  "Occorrenze",
  "Righe eliminate",
  "Anagrafica risultante",
  "Record base",
  "Righe sorgente",
  "Campi discordanti",
  "Valori rilevati",
];
duplicatesSheet.showGridLines = false;
duplicatesSheet.getRangeByIndexes(0, 0, duplicateSummaries.length + 1, duplicateHeaders.length).values = [
  duplicateHeaders,
  ...duplicateSummaries,
];
const duplicateTable = duplicatesSheet.tables.add(`A1:I${duplicateSummaries.length + 1}`, true, "DuplicatiClientiTable");
duplicateTable.style = "TableStyleMedium2";
duplicateTable.showBandedRows = true;
duplicatesSheet.freezePanes.freezeRows(1);
duplicatesSheet.getRange("A1:I1").format = {
  fill: colors.amber,
  font: { bold: true, color: colors.ink },
  verticalAlignment: "center",
  wrapText: true,
};
duplicatesSheet.getRange("A1:I1").format.rowHeight = 36;
duplicatesSheet.getRange(`A2:I${duplicateSummaries.length + 1}`).format = {
  verticalAlignment: "top",
  wrapText: true,
};
duplicatesSheet.getRange(`B2:B${duplicateSummaries.length + 1}`).format.numberFormat = "00000000000";
const duplicateWidths = [17, 20, 12, 15, 36, 30, 44, 34, 70];
duplicateWidths.forEach((width, index) => {
  duplicatesSheet.getRangeByIndexes(0, index, duplicateSummaries.length + 1, 1).format.columnWidth = width;
});
duplicatesSheet.getRange(`A2:I${duplicateSummaries.length + 1}`).format.autofitRows();

// Riepilogo: indicatori e regole di consolidamento leggibili senza aprire i fogli di controllo.
summarySheet.showGridLines = false;
summarySheet.mergeCells("A1:H1");
summarySheet.getRange("A1").values = [["ANAGRAFICHE CLIENTI UNIFICATE"]];
summarySheet.getRange("A1:H1").format = {
  fill: colors.navy,
  font: { bold: true, color: colors.white, size: 18 },
  verticalAlignment: "center",
};
summarySheet.getRange("A1:H1").format.rowHeight = 38;
summarySheet.mergeCells("A2:H2");
summarySheet.getRange("A2").values = [["Consolidamento dei quattro report: P.IVA come chiave primaria, codice fiscale quando la P.IVA manca."]];
summarySheet.getRange("A2:H2").format = {
  fill: colors.sky,
  font: { color: colors.navy, italic: true },
  verticalAlignment: "center",
};
summarySheet.getRange("A2:H2").format.rowHeight = 26;

summarySheet.getRange("A4:B9").values = [
  ["Indicatore", "Valore"],
  ["Righe sorgente", null],
  ["Clienti nel file finale", null],
  ["Clienti con P.IVA", null],
  ["Clienti solo codice fiscale", null],
  ["Righe duplicate eliminate", null],
];
summarySheet.getRange("B5").formulas = [["=B18"]];
summarySheet.getRange("B6").formulas = [[`=COUNTA('Clienti'!J2:J${mergedRows.length + 1})`]];
summarySheet.getRange("B7").formulas = [[`=COUNTA('Clienti'!H2:H${mergedRows.length + 1})`]];
summarySheet.getRange("B8").formulas = [["=B6-B7"]];
summarySheet.getRange("B9").formulas = [["=B5-B6"]];
summarySheet.getRange("A4:B4").format = {
  fill: colors.blue,
  font: { bold: true, color: colors.white },
};
summarySheet.getRange("A5:B9").format = {
  fill: colors.paleBlue,
  font: { color: colors.ink },
  borders: { preset: "inside", style: "thin", color: colors.line },
};
summarySheet.getRange("B5:B9").format = {
  fill: colors.paleGreen,
  font: { bold: true, color: colors.green, size: 14 },
  horizontalAlignment: "center",
  numberFormat: "#,##0",
};

summarySheet.mergeCells("D4:H4");
summarySheet.getRange("D4").values = [["REGOLE APPLICATE"]];
summarySheet.getRange("D4:H4").format = {
  fill: colors.amber,
  font: { bold: true, color: colors.ink },
};
summarySheet.getRange("D5:H9").merge(true);
summarySheet.getRange("D5:D9").values = [
  ["1. P.IVA normalizzata come chiave primaria; se assente, viene usato il codice fiscale normalizzato."],
  ["2. Per ogni chiave è stato scelto come base il record con più campi compilati."],
  ["3. I campi vuoti del record base sono stati completati usando le altre occorrenze."],
  ["4. I valori discordanti non sono stati sovrascritti: sono riportati nel foglio Duplicati."],
  ["5. Tutti i clienti sono nel foglio Clienti; per quelli identificati dal codice fiscale, la P.IVA resta vuota."],
];
summarySheet.getRange("D5:H9").format = {
  fill: colors.paleAmber,
  font: { color: colors.ink },
  verticalAlignment: "center",
  wrapText: true,
};

summarySheet.getRange("A13:B18").values = [
  ["File sorgente", "Righe"],
  ...files.map((file) => [sourceLabel(file), records.filter((record) => record.source === sourceLabel(file)).length]),
  ["Totale", null],
];
summarySheet.getRange("B18").formulas = [["=SUM(B14:B17)"]];
summarySheet.getRange("A13:B13").format = {
  fill: colors.blue,
  font: { bold: true, color: colors.white },
};
summarySheet.getRange("A14:B18").format = {
  fill: colors.paleBlue,
  borders: { preset: "inside", style: "thin", color: colors.line },
};
summarySheet.getRange("A18:B18").format = {
  fill: colors.sky,
  font: { bold: true, color: colors.navy },
  borders: { preset: "doubleBottom", style: "medium", color: colors.blue },
};
summarySheet.mergeCells("D13:H13");
summarySheet.getRange("D13").values = [["ESITO CONTROLLI"]];
summarySheet.getRange("D13:H13").format = {
  fill: colors.green,
  font: { bold: true, color: colors.white },
};
summarySheet.mergeCells("D14:H15");
summarySheet.getRange("D14").values = [[`${duplicateSummaries.length} gruppi duplicati individuati: 5 tramite P.IVA e 1 tramite codice fiscale. Eliminate ${records.length - mergedRows.length} righe; ${mergedRows.length} clienti finali nel foglio Clienti.`]];
summarySheet.getRange("D14:H15").format = {
  fill: colors.paleGreen,
  font: { color: colors.green, bold: true },
  verticalAlignment: "center",
  wrapText: true,
};
summarySheet.mergeCells("D17:H18");
summarySheet.getRange("D17").values = [[`${byTaxCode.size} clienti senza P.IVA sono stati inseriti nel foglio Clienti e identificati tramite codice fiscale. La colonna P.IVA resta intenzionalmente vuota.`]];
summarySheet.getRange("D17:H18").format = {
  fill: colors.paleRed,
  font: { color: colors.red },
  verticalAlignment: "center",
  wrapText: true,
};
summarySheet.freezePanes.freezeRows(2);
summarySheet.getRange("A1:H18").format.font.name = "Aptos";
summarySheet.getRange("A1:A18").format.columnWidth = 30;
summarySheet.getRange("B1:B18").format.columnWidth = 16;
summarySheet.getRange("C1:C18").format.columnWidth = 4;
summarySheet.getRange("D1:H18").format.columnWidth = 20;
summarySheet.getRange("A4:H18").format.autofitRows();

await fs.mkdir(previewDir, { recursive: true });
await fs.mkdir(outputDir, { recursive: true });

const summaryCheck = await workbook.inspect({
  kind: "table",
  range: "Riepilogo!A1:H18",
  include: "values,formulas",
  tableMaxRows: 20,
  tableMaxCols: 10,
  maxChars: 9000,
});
console.log("SUMMARY CHECK");
console.log(summaryCheck.ndjson);

const clientCheck = await workbook.inspect({
  kind: "table",
  range: `Clienti!A1:W${Math.min(mergedRows.length + 1, 8)}`,
  include: "values,formulas",
  tableMaxRows: 8,
  tableMaxCols: 23,
  maxChars: 9000,
});
console.log("CLIENT CHECK");
console.log(clientCheck.ndjson);

const formulaErrors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
  maxChars: 6000,
});
console.log("FORMULA ERROR SCAN");
console.log(formulaErrors.ndjson);

for (const sheetName of ["Clienti", "Riepilogo", "Duplicati"]) {
  const preview = await workbook.render({
    sheetName,
    autoCrop: "all",
    scale: 1,
    format: "png",
  });
  const previewName = sheetName.replace(/[^a-zA-Z0-9_-]+/g, "-");
  await fs.writeFile(
    path.join(previewDir, `${previewName}.png`),
    new Uint8Array(await preview.arrayBuffer()),
  );
}

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(JSON.stringify({
  outputPath,
  sourceRecords: records.length,
  finalRecords: mergedRows.length,
  duplicateGroups: duplicateSummaries.length,
  duplicateRowsRemoved: records.length - mergedRows.length,
  withVat: byVat.size,
  taxCodeOnly: byTaxCode.size,
  withoutKey: withoutKey.length,
}, null, 2));
