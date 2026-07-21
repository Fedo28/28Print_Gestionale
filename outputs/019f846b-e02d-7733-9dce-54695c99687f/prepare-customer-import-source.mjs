import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const workbookPath = "/Users/federicopolichetti/Desktop/Gestionale V_GitHub/outputs/019f846b-e02d-7733-9dce-54695c99687f/Clienti_unificati_senza_duplicati.xlsx";
const outputPath = "/private/tmp/merge-clienti-019f846b/customer-import-source.json";

function textValue(value) {
  return String(value ?? "").trim();
}

function normalizeIdentifier(value, numericLength = 0) {
  const compact = textValue(value).toUpperCase().replace(/^IT(?=\d)/, "").replace(/[^A-Z0-9]/g, "");
  if (numericLength && /^\d+$/.test(compact) && compact.length < numericLength) {
    return compact.padStart(numericLength, "0");
  }
  return compact;
}

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(workbookPath));
const rows = workbook.worksheets.getItem("Clienti").getUsedRange(true).values;
const headers = rows[0].map(textValue);
const headerIndex = Object.fromEntries(headers.map((header, index) => [header, index]));
const requiredHeaders = ["Denominazione", "Partita Iva", "Codice Fiscale"];
for (const requiredHeader of requiredHeaders) {
  if (!(requiredHeader in headerIndex)) throw new Error(`Colonna obbligatoria mancante: ${requiredHeader}`);
}

const records = rows.slice(1).map((row, index) => {
  const values = Object.fromEntries(headers.map((header, column) => [header, textValue(row[column])]));
  return {
    sourceRow: index + 2,
    vatNumberNormalized: normalizeIdentifier(values["Partita Iva"], 11),
    taxCodeNormalized: normalizeIdentifier(values["Codice Fiscale"], 11),
    values,
  };
});

const invalid = records.filter((record) => !record.values.Denominazione || (!record.vatNumberNormalized && !record.taxCodeNormalized));
const vatKeys = records.map((record) => record.vatNumberNormalized).filter(Boolean);
const taxKeys = records.map((record) => record.taxCodeNormalized).filter(Boolean);
const duplicateVatKeys = [...new Set(vatKeys.filter((key, index) => vatKeys.indexOf(key) !== index))];
const duplicateTaxKeys = [...new Set(taxKeys.filter((key, index) => taxKeys.indexOf(key) !== index))];

if (invalid.length || duplicateVatKeys.length || duplicateTaxKeys.length) {
  throw new Error(JSON.stringify({ invalid, duplicateVatKeys, duplicateTaxKeys }, null, 2));
}

await fs.mkdir("/private/tmp/merge-clienti-019f846b", { recursive: true });
await fs.writeFile(outputPath, JSON.stringify({ workbookPath, headers, records }, null, 2));
console.log(JSON.stringify({
  outputPath,
  records: records.length,
  vatKeys: vatKeys.length,
  taxKeys: taxKeys.length,
  duplicateVatKeys,
  duplicateTaxKeys,
}, null, 2));
