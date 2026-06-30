import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "D:/desktopCache/张绍方进度表模板/小程序标准导入模板_单台设备进度.xlsx";
const outputDir = "D:/WeChatProjects/miniprogram-1/outputs/templates";
const outputPath = `${outputDir}/小程序标准导入模板_单台设备进度_v4.xlsx`;
const workPreviewPath = "D:/WeChatProjects/miniprogram-1/outputs/template_audit_work/standard-template-v4-preview.png";

const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);

const sheet = workbook.worksheets.getItem("③单台设备进度");
sheet.getRange("A1:BH80").unmerge();
sheet.getRange("A1:BH80").clear({ applyTo: "contents" });

const processes = [
  "项目设计",
  "结构设计",
  "电气设计",
  "采购物料",
  "电箱组装",
  "电气盘安装",
  "结构总装",
  "电气总装",
  "调试",
  "发货"
];

const baseHeaders = [
  "唯一台号",
  "项目号",
  "台号",
  "项目名称",
  "型号",
  "机内位号/区域",
  "要求交货期",
  "计划交货期",
  "实际发货日期",
  "当前所在阶段/部门",
  "当前负责人",
  "进度%",
  "是否逾期",
  "距交货(天)"
];
const stageHeaders = processes.map((name, index) => `${index + 1}.${name}`);
const headers = baseHeaders
  .concat(stageHeaders)
  .concat(stageHeaders)
  .concat(stageHeaders)
  .concat(["备注"]);

const groupRow = new Array(headers.length).fill("");
groupRow[0] = "基础信息（管理员录入；项目名称自动）";
groupRow[9] = "进度看板（公式自动）";
groupRow[14] = "各阶段 · 计划完成日（派单设节点）";
groupRow[24] = "各阶段 · 实际完成日（员工汇报）";
groupRow[34] = "各阶段 · 责任人（按部门派单/个人协同）";
groupRow[44] = "备注";

const sampleRow = [
  "C26-0422-01",
  "C26-0422",
  "01",
  "中创新航藤洲",
  "SJD125-38000Z-H1",
  "DHU-01 注液区",
  "2026-07-10",
  "2026-07-10",
  "",
  "电气设计",
  "秦朗",
  0.3,
  "否",
  12,
  "2026-06-18",
  "2026-06-26",
  "2026-06-28",
  "2026-07-01",
  "2026-07-03",
  "2026-07-05",
  "2026-07-07",
  "2026-07-08",
  "2026-07-09",
  "2026-07-10",
  "2026-06-18",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "张绍方",
  "陈七",
  "秦朗",
  "李洋",
  "电工房",
  "电工房",
  "结构班组",
  "电气班组",
  "品质部",
  "生产部",
  "示例行，可删除后填写真实数据"
];

sheet.getRangeByIndexes(0, 0, 3, headers.length).values = [groupRow, headers, sampleRow];
sheet.getRange("A1:N1").merge();
sheet.getRange("O1:X1").merge();
sheet.getRange("Y1:AH1").merge();
sheet.getRange("AI1:AR1").merge();
sheet.getRange("AS1").values = [["备注"]];

sheet.getRange("A1:AS1").format = {
  fill: "#0B7A75",
  font: { bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
  verticalAlignment: "center"
};
sheet.getRange("A2:AS2").format = {
  fill: "#E7F6F4",
  font: { bold: true, color: "#111827" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  wrapText: true,
  borders: { preset: "all", style: "thin", color: "#D8E7E4" }
};
sheet.getRange("A3:AS3").format = {
  borders: { preset: "all", style: "thin", color: "#EEF2F7" },
  verticalAlignment: "center"
};
sheet.getRange("L3:L80").format.numberFormat = "0%";
sheet.getRange("G3:I80").format.numberFormat = "yyyy-mm-dd";
sheet.getRange("O3:AH80").format.numberFormat = "yyyy-mm-dd";
sheet.getRange("A:A").format.columnWidth = 16;
sheet.getRange("B:D").format.columnWidth = 14;
sheet.getRange("E:F").format.columnWidth = 20;
sheet.getRange("G:N").format.columnWidth = 13;
sheet.getRange("O:AR").format.columnWidth = 14;
sheet.getRange("AS:AS").format.columnWidth = 28;
sheet.getRange("A1:AS3").format.autofitRows();
sheet.freezePanes.freezeRows(2);

const mapSheet = workbook.worksheets.getItem("字段映射配置");
mapSheet.getRange("A1:E80").clear({ applyTo: "contents" });
const mappingRows = [["表头分组", "Excel表头", "系统字段/处理方式", "是否必填", "备注"]];
baseHeaders.forEach((header) => {
  const required = ["唯一台号", "项目号", "台号", "项目名称"].includes(header) ? "是" : "否";
  mappingRows.push(["基础信息/进度看板", header, "按 import-service 字段映射识别", required, "按表头名称识别，不按列号"]);
});
processes.forEach((name, index) => mappingRows.push(["各阶段 · 计划完成日", `${index + 1}.${name}`, "processTask.plannedDueDate", "否", "按阶段名生成工序任务"]));
processes.forEach((name, index) => mappingRows.push(["各阶段 · 实际完成日", `${index + 1}.${name}`, "processTask.actualFinishDate", "否", "员工汇报后回填；发货全完成后项目自动已完成"]));
processes.forEach((name, index) => mappingRows.push(["各阶段 · 责任人", `${index + 1}.${name}`, "processTask.assigneeName", "否", "用于部门/个人协同"]));
mappingRows.push(["备注", "备注", "device.remark", "否", "设备备注"]);
mapSheet.getRangeByIndexes(0, 0, mappingRows.length, 5).values = mappingRows;
mapSheet.getRange("A1:E1").format = { fill: "#0B7A75", font: { bold: true, color: "#FFFFFF" } };
mapSheet.getRangeByIndexes(0, 0, mappingRows.length, 5).format.borders = { preset: "all", style: "thin", color: "#D9D9D9" };
mapSheet.getRange("A:E").format.autofitColumns();

const dictSheet = workbook.worksheets.getItem("下拉字典");
dictSheet.getRange("A1:C30").clear({ applyTo: "contents" });
const departments = ["项目部", "电气设计部", "结构设计部", "电工房", "结构班组", "电气班组", "采购部", "仓库部", "品质部", "生产部"];
const statuses = ["未开始", "进行中", "已完成", "有风险", "暂停"];
const dictRows = [["工序", "负责部门", "状态"]];
for (let i = 0; i < Math.max(processes.length, departments.length, statuses.length); i += 1) {
  dictRows.push([processes[i] || "", departments[i] || "", statuses[i] || ""]);
}
dictSheet.getRangeByIndexes(0, 0, dictRows.length, 3).values = dictRows;
dictSheet.getRange("A1:C1").format = { fill: "#0B7A75", font: { bold: true, color: "#FFFFFF" } };
dictSheet.getRangeByIndexes(0, 0, dictRows.length, 3).format.borders = { preset: "all", style: "thin", color: "#D9D9D9" };
dictSheet.getRange("A:C").format.autofitColumns();

const noteSheet = workbook.worksheets.getItem("①使用说明");
noteSheet.getRange("A1:B12").clear({ applyTo: "contents" });
noteSheet.getRange("A1:B12").values = [
  ["除湿机生产进度小程序标准导入模板 v4", ""],
  ["用途", "用于小程序批量导入项目、单台设备、工序计划、实际完成日、责任人。"],
  ["标准导入Sheet", "③单台设备进度"],
  ["解析原则", "统一标准模板 + 按表头名称识别 + 字段映射可配置，不按固定列号。"],
  ["一行含义", "一行代表一个项目中的一台设备。"],
  ["必填字段", "唯一台号、项目号、台号、项目名称。"],
  ["设备基础信息", "型号、机内位号/区域只是设备基础信息，不作为参数库参数。"],
  ["当前工序口径", processes.join(" / ")],
  ["项目完成规则", "所有启用设备的“发货”工序均为“已完成”时，项目自动更新为“已完成”。"],
  ["注意", "不要合并数据行；不要删除第1-2行表头；如新增工序，请同步维护字段映射配置。"],
  ["参数库", "参数标准表另行维护；本模板不导入参数库。"],
  ["QB", "QB 当前由钉钉建单/关单，小程序只读同步。"]
];
noteSheet.getRange("A1:B1").format = { fill: "#0B7A75", font: { bold: true, color: "#FFFFFF" } };
noteSheet.getRange("A:B").format.autofitColumns();

await fs.mkdir(outputDir, { recursive: true });
const preview = await workbook.render({ sheetName: "③单台设备进度", range: "A1:AS12", scale: 1, format: "png" });
await fs.writeFile(workPreviewPath, new Uint8Array(await preview.arrayBuffer()));
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(outputPath);
