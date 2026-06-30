import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const __filename = fileURLToPath(import.meta.url);
const buildDir = path.dirname(__filename);
const outputDir = path.resolve(buildDir, "..");
const repoRoot = path.resolve(buildDir, "..", "..", "..");
const requireFromRepo = createRequire(path.join(repoRoot, "package.json"));
const dataService = requireFromRepo("./services/data-service");

function joinNames(values) {
  const seen = new Set();
  return values
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter((value) => value && value !== "-")
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    })
    .join("、");
}

function getOwnedProcessesFromDevices(userName) {
  const owned = [];
  dataService.listDevices().forEach((device) => {
    const processes = dataService.getProcessesByDevice(device.id) || [];
    processes.forEach((process) => {
      if (process && process.owner === userName && process.name) owned.push(process.name);
    });
  });
  return owned;
}

function getDefaultOwnedProcesses(userName) {
  return dataService
    .listProcessOptions()
    .filter((processName) => {
      const defaults = dataService.getDefaultOwnerForProcess
        ? dataService.getDefaultOwnerForProcess(processName)
        : null;
      return defaults && defaults.owner === userName;
    });
}

const users = dataService.listUsers();
const rows = users.map((user) => {
  const processNames = joinNames([
    ...getOwnedProcessesFromDevices(user.name),
    ...getDefaultOwnedProcesses(user.name)
  ]);
  return [
    user.name || "",
    user.roleLabel || user.role || "",
    user.department || "",
    processNames
  ];
});

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("人员工序核对");
sheet.showGridLines = false;
sheet.getRange("A1:D1").merge();
sheet.getRange("A1:D1").values = [["人员角色部门工序核对表"]];
sheet.getRange("A2:D2").merge();
sheet.getRange("A2:D2").values = [["数据来源：services/data-service.js 当前用户、设备工序 owner 与默认工序负责人映射", "", "", ""]];
sheet.getRange("A4:D4").values = [["姓名", "角色", "部门", "负责工序名"]];
sheet.getRangeByIndexes(4, 0, rows.length, 4).values = rows;

sheet.getRange("A1:D1").format = {
  fill: "#0F766E",
  font: { bold: true, color: "#FFFFFF", size: 16 },
  horizontalAlignment: "center",
  verticalAlignment: "center"
};
sheet.getRange("A1:D1").format.rowHeightPx = 34;
sheet.getRange("A2:D2").format = {
  fill: "#E7F6F4",
  font: { color: "#374151", size: 10 },
  wrapText: true
};
sheet.getRange("A2:D2").format.rowHeightPx = 30;
sheet.getRange("A4:D4").format = {
  fill: "#D1FAE5",
  font: { bold: true, color: "#064E3B" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  borders: { preset: "bottom", style: "thin", color: "#9CA3AF" }
};
const dataRange = sheet.getRangeByIndexes(4, 0, rows.length, 4);
dataRange.format = {
  font: { color: "#111827", size: 11 },
  verticalAlignment: "center",
  wrapText: true,
  borders: {
    insideHorizontal: { style: "thin", color: "#E5E7EB" }
  }
};
sheet.getRangeByIndexes(4, 0, rows.length, 1).format.font = { bold: true, color: "#111827" };
sheet.getRange("A:A").format.columnWidthPx = 100;
sheet.getRange("B:B").format.columnWidthPx = 130;
sheet.getRange("C:C").format.columnWidthPx = 150;
sheet.getRange("D:D").format.columnWidthPx = 260;
sheet.freezePanes.freezeRows(4);

const noteSheet = workbook.worksheets.add("说明");
noteSheet.showGridLines = false;
noteSheet.getRange("A1:C1").merge();
noteSheet.getRange("A1:C1").values = [["核对说明"]];
noteSheet.getRange("A3:C8").values = [
  ["字段", "含义", "备注"],
  ["姓名", "当前 listUsers() 中的员工姓名", "包含普通员工、部门管理员、进度管理员、观察员、后台管理员等"],
  ["角色", "后台权限角色", "不等同于业务部门"],
  ["部门", "公司业务流程部门", "部门管理员权限必须按该字段限定本部门"],
  ["负责工序名", "从现有设备工序 owner 和默认负责人映射汇总", "空白表示当前数据中未发现该人员负责具体工序"],
  ["下一步", "请直接在表格中改姓名/角色/部门/负责工序名", "改完发回后再按表修改 service/mock 数据"]
];
noteSheet.getRange("A1:C1").format = {
  fill: "#0F766E",
  font: { bold: true, color: "#FFFFFF", size: 16 },
  horizontalAlignment: "center"
};
noteSheet.getRange("A3:C3").format = {
  fill: "#D1FAE5",
  font: { bold: true, color: "#064E3B" }
};
noteSheet.getRange("A3:C8").format = {
  wrapText: true,
  borders: { preset: "all", style: "thin", color: "#E5E7EB" }
};
noteSheet.getRange("A:A").format.columnWidthPx = 110;
noteSheet.getRange("B:B").format.columnWidthPx = 230;
noteSheet.getRange("C:C").format.columnWidthPx = 310;
noteSheet.freezePanes.freezeRows(3);

const inspect = await workbook.inspect({
  kind: "table",
  range: "人员工序核对!A1:D16",
  include: "values",
  tableMaxRows: 16,
  tableMaxCols: 4,
  maxChars: 5000
});
console.log(inspect.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "formula error scan"
});
console.log(errors.ndjson);

const preview = await workbook.render({
  sheetName: "人员工序核对",
  range: "A1:D16",
  scale: 1,
  format: "png"
});
await fs.writeFile(path.join(outputDir, "preview.png"), new Uint8Array(await preview.arrayBuffer()));

await fs.mkdir(outputDir, { recursive: true });
const exported = await SpreadsheetFile.exportXlsx(workbook);
await exported.save(path.join(outputDir, "人员角色部门工序核对表.xlsx"));
console.log(path.join(outputDir, "人员角色部门工序核对表.xlsx"));
