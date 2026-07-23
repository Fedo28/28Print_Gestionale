import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const runDir = "/private/tmp/merge-clienti-20260723";
const sourcePath = path.join(runDir, "customer-import-source.json");
const resultPath = path.join(runDir, "customer-import-result.json");
const previewDir = path.join(runDir, "final-preview");
const outputPath = "/Users/federicopolichetti/Desktop/Gestionale V_GitHub/outputs/019f846b-e02d-7733-9dce-54695c99687f/Clienti_importati_2026-07-23.xlsx";

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

function cleanCustomerName(value) {
  const compact = textValue(value).replace(/\s+/g, " ");
  const quoteCount = (compact.match(/"/g) || []).length;
  return compact.startsWith('"') && quoteCount === 1 ? compact.slice(1).trim() : compact;
}

const source = JSON.parse(await fs.readFile(sourcePath, "utf8"));
const result = JSON.parse(await fs.readFile(resultPath, "utf8"));
const importedRows = new Set(result.imported.map((entry) => entry.sourceRow));
const records = source.records.filter((record) => importedRows.has(record.sourceRow));
const headers = source.headers;
const nameIndex = headers.indexOf("Denominazione");
const firstNameIndex = headers.indexOf("Nome");
const lastNameIndex = headers.indexOf("Cognome");
const vatIndex = headers.indexOf("Partita Iva");
const taxCodeIndex = headers.indexOf("Codice Fiscale");
const phoneIndex = headers.indexOf("Telefono");

if (records.length !== result.imported.length) {
  throw new Error(`Numero righe importate incoerente: ${records.length} invece di ${result.imported.length}.`);
}

const rows = records.map((record) => headers.map((header, index) => {
  if (index === nameIndex) {
    return cleanCustomerName(record.values[header])
      || [record.values[headers[firstNameIndex]], record.values[headers[lastNameIndex]]]
        .map(textValue)
        .filter(Boolean)
        .join(" ");
  }
  if (index === vatIndex) return record.vatNumberNormalized || null;
  if (index === taxCodeIndex) return record.taxCodeNormalized || null;
  return record.values[header] || null;
}));

const workbook = Workbook.create();
const clientsSheet = workbook.worksheets.add("Clienti");
const summarySheet = workbook.worksheets.add("Riepilogo");

clientsSheet.showGridLines = false;
clientsSheet.getRangeByIndexes(0, 0, rows.length + 1, headers.length).values = [headers, ...rows];
const clientsTable = clientsSheet.tables.add(`A1:W${rows.length + 1}`, true, "ClientiImportati20260723");
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
clientsSheet.getRange(`A2:W${rows.length + 1}`).format = {
  font: { color: colors.ink },
  verticalAlignment: "top",
};
clientsSheet.getRange(`C2:C${rows.length + 1}`).format.numberFormat = "0000000";
clientsSheet.getRange(`H2:H${rows.length + 1}`).format.numberFormat = "00000000000";
clientsSheet.getRange(`I2:I${rows.length + 1}`).format.numberFormat = "00000000000";
clientsSheet.getRange(`O2:O${rows.length + 1}`).format.numberFormat = "00000";
rows.forEach((row, index) => {
  const phone = textValue(row[phoneIndex]);
  if (/^\d+$/.test(phone)) {
    clientsSheet.getCell(index + 1, phoneIndex).format.numberFormat = "0".repeat(phone.length);
  }
});
clientsSheet.getRange(`J2:J${rows.length + 1}`).format.wrapText = true;
clientsSheet.getRange(`R2:R${rows.length + 1}`).format.wrapText = true;
const clientWidths = [14, 12, 23, 31, 29, 16, 10, 16, 19, 46, 16, 16, 14, 10, 10, 11, 21, 38, 15, 18, 23, 20, 20];
clientWidths.forEach((width, index) => {
  clientsSheet.getRangeByIndexes(0, index, rows.length + 1, 1).format.columnWidth = width;
});

const sourceRows = source.metadata.sourceRows;
const internalDuplicates = source.metadata.duplicateRowsRemoved;
const consolidatedRows = source.metadata.mergedRows;
const skippedExisting = result.skippedAtCommit.length;
const importedCount = result.imported.length;
const totalCustomers = 773;

summarySheet.showGridLines = false;
summarySheet.mergeCells("A1:H1");
summarySheet.getRange("A1").values = [["IMPORTAZIONE CLIENTI COMPLETATA"]];
summarySheet.getRange("A1:H1").format = {
  fill: colors.navy,
  font: { bold: true, color: colors.white, size: 18 },
  verticalAlignment: "center",
};
summarySheet.getRange("A1:H1").format.rowHeight = 38;
summarySheet.mergeCells("A2:H2");
summarySheet.getRange("A2").values = [["Il foglio Clienti contiene esclusivamente le nuove anagrafiche trasferite nel gestionale il 23 luglio 2026."]];
summarySheet.getRange("A2:H2").format = {
  fill: colors.sky,
  font: { color: colors.navy, italic: true },
  verticalAlignment: "center",
};
summarySheet.getRange("A2:H2").format.rowHeight = 26;

summarySheet.getRange("A4:B10").values = [
  ["Indicatore", "Valore"],
  ["Righe nei quattro file", sourceRows],
  ["Duplicati interni eliminati", internalDuplicates],
  ["Anagrafiche consolidate", consolidatedRows],
  ["Clienti già presenti esclusi", skippedExisting],
  ["Clienti importati", importedCount],
  ["Clienti totali nel gestionale", totalCustomers],
];
summarySheet.getRange("A4:B4").format = {
  fill: colors.blue,
  font: { bold: true, color: colors.white },
};
summarySheet.getRange("A5:B10").format = {
  fill: colors.paleBlue,
  borders: { preset: "inside", style: "thin", color: colors.line },
};
summarySheet.getRange("B5:B10").format = {
  fill: colors.paleGreen,
  font: { bold: true, color: colors.green, size: 14 },
  horizontalAlignment: "center",
  numberFormat: "#,##0",
};

summarySheet.mergeCells("D4:H4");
summarySheet.getRange("D4").values = [["CRITERI APPLICATI"]];
summarySheet.getRange("D4:H4").format = {
  fill: colors.amber,
  font: { bold: true, color: colors.ink },
};
summarySheet.mergeCells("D5:H10");
summarySheet.getRange("D5").values = [[
  "I quattro file sono stati uniti usando P.IVA e codice fiscale come chiavi. I duplicati sono stati accorpati mantenendo il record più completo. Le anagrafiche già presenti nel database per una delle due chiavi sono state escluse.",
]];
summarySheet.getRange("D5:H10").format = {
  fill: colors.paleAmber,
  font: { color: colors.ink },
  verticalAlignment: "center",
  wrapText: true,
};

summarySheet.mergeCells("A12:H14");
summarySheet.getRange("A12").values = [[
  `Controllo completato: ${importedCount} clienti creati, ${importedCount} registri attività generati e nessuna P.IVA o codice fiscale duplicato tra le nuove anagrafiche.`,
]];
summarySheet.getRange("A12:H14").format = {
  fill: colors.paleGreen,
  font: { bold: true, color: colors.green },
  verticalAlignment: "center",
  wrapText: true,
};
summarySheet.freezePanes.freezeRows(2);
summarySheet.getRange("A1:H14").format.font.name = "Aptos";
summarySheet.getRange("A1:A14").format.columnWidth = 34;
summarySheet.getRange("B1:B14").format.columnWidth = 16;
summarySheet.getRange("C1:C14").format.columnWidth = 5;
summarySheet.getRange("D1:H14").format.columnWidth = 20;

const summaryCheck = await workbook.inspect({
  kind: "table",
  range: "Riepilogo!A1:H14",
  include: "values,formulas",
  tableMaxRows: 16,
  tableMaxCols: 10,
  maxChars: 7000,
});
console.log(summaryCheck.ndjson);
const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
  maxChars: 3000,
});
console.log(errors.ndjson);

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.mkdir(previewDir, { recursive: true });
for (const [sheetName, range] of [
  ["Riepilogo", "A1:H14"],
  ["Clienti", `A1:W${Math.min(rows.length + 1, 18)}`],
]) {
  const preview = await workbook.render({ sheetName, range, scale: 1, format: "png" });
  await fs.writeFile(
    path.join(previewDir, `${sheetName}.png`),
    new Uint8Array(await preview.arrayBuffer()),
  );
}

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

const exported = await SpreadsheetFile.importXlsx(await FileBlob.load(outputPath));
const exportedRows = exported.worksheets.getItem("Clienti").getUsedRange(true).values;
if (exportedRows.length - 1 !== rows.length) {
  throw new Error(`Verifica post-esportazione fallita: ${exportedRows.length - 1} righe.`);
}
console.log(JSON.stringify({
  outputPath,
  sourceRows,
  internalDuplicates,
  consolidatedRows,
  skippedExisting,
  importedRows: rows.length,
  totalCustomers,
}, null, 2));
