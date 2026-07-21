import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const sourceDir = "/private/tmp/merge-clienti-019f846b/source-xlsx";
const previewDir = "/private/tmp/merge-clienti-019f846b/preview";
const files = [
  "ReportClienti 28 Print.xlsx",
  "ReportClienti 28 WEB.xlsx",
  "ReportClienti Pierre.xlsx",
  "ReportClienti.xlsx",
];

await fs.mkdir(previewDir, { recursive: true });

for (const file of files) {
  const workbook = await SpreadsheetFile.importXlsx(
    await FileBlob.load(path.join(sourceDir, file)),
  );
  const overview = await workbook.inspect({
    kind: "workbook,sheet,table",
    maxChars: 12000,
    tableMaxRows: 12,
    tableMaxCols: 24,
    tableMaxCellChars: 120,
  });
  console.log(`\n===== ${file} =====`);
  console.log(overview.ndjson);

  const sheets = await workbook.inspect({ kind: "sheet", include: "id,name", maxChars: 3000 });
  const sheetRecords = sheets.ndjson
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  for (const sheetRecord of sheetRecords) {
    const sheetName = sheetRecord.name;
    if (!sheetName) continue;
    const preview = await workbook.render({
      sheetName,
      autoCrop: "all",
      scale: 1,
      format: "png",
    });
    const safeName = `${path.parse(file).name}-${sheetName}`.replace(/[^a-zA-Z0-9_-]+/g, "-");
    await fs.writeFile(
      path.join(previewDir, `${safeName}.png`),
      new Uint8Array(await preview.arrayBuffer()),
    );
  }
}
