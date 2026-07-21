import fs from "node:fs/promises";
import { Workbook } from "@oai/artifact-tool";

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Test");
sheet.getRange("A1:D3").values = [
  ["Default", "Text format", "Quoted", "Custom format"],
  ["00197", "00197", "'00197", "00197"],
  ["01722921002", "01722921002", "'01722921002", "01722921002"],
];
sheet.getRange("B1:B3").format.numberFormat = "@";
sheet.getRange("D2").format.numberFormat = "00000";
sheet.getRange("D3").format.numberFormat = "00000000000";
sheet.getRange("A1:D3").format.columnWidth = 20;
const preview = await workbook.render({ sheetName: "Test", autoCrop: "all", scale: 2, format: "png" });
await fs.writeFile("/private/tmp/merge-clienti-019f846b/test-identifiers.png", new Uint8Array(await preview.arrayBuffer()));
console.log((await workbook.inspect({ kind: "table", range: "Test!A1:D3", include: "values,formulas" })).ndjson);
