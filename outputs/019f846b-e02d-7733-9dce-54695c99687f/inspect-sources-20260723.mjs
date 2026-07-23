import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const sourceDir = "/private/tmp/merge-clienti-20260723/source-xlsx";
const previewDir = "/private/tmp/merge-clienti-20260723/source-preview";
const files = ["28 print.xlsx", "Alt.xlsx", "Pierre.xlsx", "Web.xlsx"];

await fs.mkdir(previewDir, { recursive: true });

for (const file of files) {
  const workbook = await SpreadsheetFile.importXlsx(
    await FileBlob.load(path.join(sourceDir, file)),
  );
  const worksheet = workbook.worksheets.getItemAt(0);
  const rows = worksheet.getUsedRange(true).values;
  const overview = await workbook.inspect({
    kind: "workbook,sheet,table",
    maxChars: 8000,
    tableMaxRows: 5,
    tableMaxCols: 24,
    tableMaxCellChars: 100,
  });
  console.log(JSON.stringify({
    file,
    sheet: worksheet.name,
    rowsIncludingHeader: rows.length,
    dataRows: Math.max(rows.length - 1, 0),
    columns: rows[0]?.length ?? 0,
    headers: rows[0]?.map((value) => String(value ?? "").trim()) ?? [],
  }));
  console.log(overview.ndjson);

  const preview = await workbook.render({
    sheetName: worksheet.name,
    range: `A1:W${Math.min(rows.length, 18)}`,
    scale: 1,
    format: "png",
  });
  await fs.writeFile(
    path.join(previewDir, `${path.parse(file).name}.png`),
    new Uint8Array(await preview.arrayBuffer()),
  );
}
