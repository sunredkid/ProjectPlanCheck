import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "D:/desktopCache/张绍方进度表模板/小程序标准导入模板_单台设备进度.xlsx";
const outputDir = "D:/WeChatProjects/miniprogram-1/outputs/template_audit_work";

const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);

const summary = await workbook.inspect({
  kind: "workbook,sheet,table,region",
  maxChars: 12000,
  tableMaxRows: 8,
  tableMaxCols: 30,
  tableMaxCellChars: 80
});
console.log(summary.ndjson);

const sheetOverview = await workbook.inspect({ kind: "sheet", include: "id,name" });
console.log("SHEETS");
console.log(sheetOverview.ndjson);

const preview = await workbook.render({
  sheetName: "③单台设备进度",
  range: "A1:AZ12",
  scale: 1,
  format: "png"
});
await fs.writeFile(`${outputDir}/template-preview.png`, new Uint8Array(await preview.arrayBuffer()));
