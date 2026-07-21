import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const outputPath = "/Users/federicopolichetti/Desktop/Gestionale V_GitHub/outputs/019f846b-e02d-7733-9dce-54695c99687f/Clienti_unificati_senza_duplicati.xlsx";
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(outputPath));
const clients = workbook.worksheets.getItem("Clienti").getUsedRange(true).values;
const headers = clients[0].map((value) => String(value ?? "").trim());
const vatIndex = headers.indexOf("Partita Iva");
const taxCodeIndex = headers.indexOf("Codice Fiscale");
const vats = clients.slice(1).map((row) => String(row[vatIndex] ?? "").trim());
const nonBlankVats = vats.filter(Boolean);
const duplicateVats = [...new Set(nonBlankVats.filter((vat, index) => nonBlankVats.indexOf(vat) !== index))];
const taxCodeOnly = clients
  .slice(1)
  .filter((row) => !String(row[vatIndex] ?? "").trim())
  .map((row) => String(row[taxCodeIndex] ?? "").trim());
const duplicateTaxCodes = [...new Set(taxCodeOnly.filter((taxCode, index) => taxCodeOnly.indexOf(taxCode) !== index))];

const summary = await workbook.inspect({
  kind: "table",
  range: "Riepilogo!A4:B9",
  include: "values,formulas",
  tableMaxRows: 10,
  tableMaxCols: 4,
  maxChars: 3000,
});
const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "post-export formula error scan",
  maxChars: 3000,
});

console.log(JSON.stringify({
  finalRows: clients.length - 1,
  nonBlankVatRows: nonBlankVats.length,
  blankVatRows: vats.length - nonBlankVats.length,
  duplicateVatKeys: duplicateVats,
  taxCodeOnlyRows: taxCodeOnly.length,
  blankTaxCodeKeys: taxCodeOnly.filter((taxCode) => !taxCode).length,
  duplicateTaxCodeKeys: duplicateTaxCodes,
}, null, 2));
console.log(summary.ndjson);
console.log(errors.ndjson);

if (
  clients.length - 1 !== 73
  || nonBlankVats.length !== 63
  || taxCodeOnly.length !== 10
  || taxCodeOnly.some((taxCode) => !taxCode)
  || duplicateVats.length
  || duplicateTaxCodes.length
) {
  throw new Error("La verifica post-esportazione non coincide con i conteggi attesi.");
}
