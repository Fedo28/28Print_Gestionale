import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const sourceDir = "/private/tmp/merge-clienti-019f846b/source-xlsx";
const files = [
  "ReportClienti 28 Print.xlsx",
  "ReportClienti 28 WEB.xlsx",
  "ReportClienti Pierre.xlsx",
  "ReportClienti.xlsx",
];

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

const records = [];
let headers = [];
for (const file of files) {
  const workbook = await SpreadsheetFile.importXlsx(
    await FileBlob.load(path.join(sourceDir, file)),
  );
  const sheet = workbook.worksheets.getItemAt(0);
  const rows = sheet.getUsedRange(true).values;
  if (!headers.length) headers = rows[0].map(textValue);
  const vatIndex = headers.indexOf("Partita Iva");
  for (let index = 1; index < rows.length; index += 1) {
    if (!rows[index].some((value) => textValue(value))) continue;
    const values = rows[index].map(textValue);
    records.push({
      source: path.parse(file).name,
      sourceRow: index + 1,
      values,
      vat: normalizeVat(values[vatIndex]),
    });
  }
}

const byVat = new Map();
for (const record of records) {
  if (!record.vat) continue;
  if (!byVat.has(record.vat)) byVat.set(record.vat, []);
  byVat.get(record.vat).push(record);
}

const duplicateGroups = [...byVat.entries()].filter(([, group]) => group.length > 1);
const invalidVats = [...byVat.keys()].filter((vat) => !/^\d{11}$/.test(vat));
const blankVat = records.filter((record) => !record.vat);
const uniqueVats = byVat.size;

console.log(JSON.stringify({
  sourceRows: Object.fromEntries(files.map((file) => [path.parse(file).name, records.filter((record) => record.source === path.parse(file).name).length])),
  totalRecords: records.length,
  uniqueVats,
  blankVatRecords: blankVat.length,
  invalidVatKeys: invalidVats,
  duplicateGroups: duplicateGroups.length,
  duplicateRowsBeyondFirst: duplicateGroups.reduce((sum, [, group]) => sum + group.length - 1, 0),
  finalRowsIfBlankVatPreserved: uniqueVats + blankVat.length,
}, null, 2));

for (const [vat, group] of duplicateGroups) {
  const names = group.map((record) => record.values[headers.indexOf("Denominazione")]);
  const sources = group.map((record) => `${record.source} riga ${record.sourceRow}`);
  const differingFields = headers.filter((_, col) => {
    const distinct = new Set(group.map((record) => record.values[col]).filter(Boolean).map((value) => value.toUpperCase()));
    return distinct.size > 1;
  });
  console.log(JSON.stringify({ vat, sources, names, differingFields }));
}

if (blankVat.length) {
  console.log("BLANK VAT");
  for (const record of blankVat) {
    console.log(JSON.stringify({
      source: record.source,
      sourceRow: record.sourceRow,
      taxCode: record.values[headers.indexOf("Codice Fiscale")],
      name: record.values[headers.indexOf("Denominazione")],
    }));
  }
}
