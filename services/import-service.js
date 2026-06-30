const mockData = require("../utils/mock-data");
const importParser = require("./import-parser");
const xlsxReader = require("./xlsx-reader");
const auditService = require("./audit-service");
const cloudConfig = require("./cloud-config");

const TEMPLATE_PATH = "D:\\WeChatProjects\\miniprogram-1\\outputs\\templates\\小程序标准导入模板_单台设备进度_v4.xlsx";
const STANDARD_SHEET_NAME = "③单台设备进度";


const DEFAULT_FIELD_MAPPINGS = [
  { field: "deviceUniqueNo", header: "唯一台号", aliases: ["唯一台号\n(项目号+台号)"], required: true },
  { field: "projectNo", header: "项目号", required: true },
  { field: "deviceNo", header: "台号", required: true },
  { field: "projectName", header: "项目名称", aliases: ["项目名称\n(自动带出)"], required: true },
  { field: "model", header: "型号", required: false },
  { field: "area", header: "机内位号/区域", required: false },
  { field: "requiredShipDate", header: "要求交货期", required: false },
  { field: "plannedShipDate", header: "计划交货期", required: false },
  { field: "actualShipDate", header: "实际发货日期", required: false },
  { field: "currentStage", header: "当前所在阶段/部门", aliases: ["当前所在\n阶段/部门"], required: false },
  { field: "currentOwner", header: "当前负责人", required: false },
  { field: "progressPercent", header: "进度%", required: false },
  { field: "isOverdue", header: "是否逾期", required: false },
  { field: "daysToShip", header: "距交货(天)", aliases: ["距交货\n(天)"], required: false },
  { field: "stagePlanFinishDate", header: "阶段计划完成日", required: false },
  { field: "stageActualFinishDate", header: "阶段实际完成日", required: false },
  { field: "stageOwner", header: "阶段负责人", required: false },
  { field: "remark", header: "备注", required: false }
];

function getTodayString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function getProjectArchiveMeta(adminOrderDate = "") {
  const text = String(adminOrderDate || "").trim();
  const match = text.match(/^(\d{4})-(\d{1,2})/);
  const year = match ? match[1] : "";
  const month = match ? String(Number(match[2])).padStart(2, "0") : "";
  return {
    adminOrderYear: year,
    adminOrderMonth: month,
    archivePath: year && month ? `projects/${year}/${month}` : ""
  };
}

function getFieldMappings() {
  const dictMappings = (mockData.dictionaries && mockData.dictionaries.excelFieldMappings);
  if (Array.isArray(dictMappings) && dictMappings.length > 0) {
    return dictMappings.slice();
  }
  return DEFAULT_FIELD_MAPPINGS.slice();
}


function getTemplateInfo() {
  return {
    path: TEMPLATE_PATH,
    sheetName: STANDARD_SHEET_NAME,
    strategy: "standard-template-with-header-mapping"
  };
}

function getStandardTemplateInfo() {
  return getTemplateInfo();
}

function getTemplateDownloadInfo() {
  const templateConfig = (cloudConfig.standardTemplates && cloudConfig.standardTemplates.progressImport) || {};
  const cloudFileID = String(templateConfig.cloudFileID || "").trim();
  const httpsUrl = String(templateConfig.httpsUrl || "").trim();
  const fileName = templateConfig.fileName || "小程序标准导入模板_单台设备进度_v4.xlsx";
  const mode = cloudFileID
    ? "cloud-template-file"
    : (httpsUrl ? "https-template-file" : "local-dev-template-file");
  return {
    ...getTemplateInfo(),
    fileName,
    mode,
    templateDownloadMode: mode,
    cloudFileID,
    httpsUrl,
    cloudPath: templateConfig.cloudPath || "templates/小程序标准导入模板_单台设备进度_v4.xlsx",
    message: cloudFileID || httpsUrl
      ? "Template file is ready for production download."
      : "Template cloud download is not configured; local dev path is used."
  };
}

function normalizeSelectedFile(file = {}) {
  return {
    name: file.name || file.fileName || "selected.xlsx",
    path: file.path || file.tempFilePath || "",
    size: file.size || 0,
    type: file.type || "file"
  };
}



function clone(value) {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
}

function normalizeProcessName(name = "") {
  const value = String(name || "").trim();
  const map = {
    "机械采购": "物料采购",
    "电气采购": "物料采购",
    "采购部门": "物料采购",
    "采购物料": "物料采购",
    "结构装配": "结构总装",
    "电气装配": "电气总装"
  };
  return map[value] || value;
}

function isDisabledProcessName(name = "") {
  const normalized = normalizeProcessName(name);
  return normalized === "品质跟进" || normalized === "工艺确认";
}

function normalizeDepartmentName(name = "") {
  const value = String(name || "").trim();
  const map = {
    "电气设计": "电气设计部",
    "电气设计部门": "电气设计部",
    "智能自控部": "电气设计部",
    "项目管理": "项目部",
    "进度管理": "制造部",
    "结构设计": "结构设计部",
    "电工房": "电气电控车间",
    "结构班组": "生产装配",
    "电气班组": "生产装配",
    "生产部": "工艺部门",
    "仓库": "仓库部"
  };
  return map[value] || value;
}

function getImportDeviceNo(row = {}) {
  return row.deviceUniqueNo || row.deviceNo || "";
}

function parseDateText(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function compareDateText(left, right) {
  const leftDate = parseDateText(left);
  const rightDate = parseDateText(right);
  if (!leftDate || !rightDate) return null;
  const leftDay = new Date(leftDate.getFullYear(), leftDate.getMonth(), leftDate.getDate()).getTime();
  const rightDay = new Date(rightDate.getFullYear(), rightDate.getMonth(), rightDate.getDate()).getTime();
  if (leftDay === rightDay) return 0;
  return leftDay > rightDay ? 1 : -1;
}

function getImportRowNo(row = {}, index = 0) {
  return Number(row.excelRow || index + 1);
}

function getBusinessShipDate(row = {}) {
  return row.plannedShipDate || row.requiredShipDate || "";
}

function validateHeaders(headers) {
  const normalizeHeader = importParser.normalizeHeader || ((value) => String(value || "").trim());
  const headerSet = new Set((headers || []).map(normalizeHeader));
  const getHeaderNames = (mapping) => [mapping.header].concat(mapping.aliases || []).map(normalizeHeader);
  const mappings = getFieldMappings(); const missingRequired = mappings
    .filter((item) => item.required && !getHeaderNames(item).some((header) => headerSet.has(header)))
    .map((item) => item.header);
  const knownHeaders = new Set();
  mappings.forEach((item) => getHeaderNames(item).forEach((header) => knownHeaders.add(header)));
  const unknownHeaders = (headers || []).filter((header) => {
    const normalized = normalizeHeader(header);
    return normalized && !knownHeaders.has(normalized) && !/^\d+[.．]/.test(normalized);
  });

  return {
    ok: missingRequired.length === 0 && unknownHeaders.length === 0,
    missingRequired,
    unknownHeaders,
    recognizedHeaders: (headers || []).filter((header) => {
      const normalized = normalizeHeader(header);
      return knownHeaders.has(normalized) || /^\d+[.．]/.test(normalized);
    })
  };
}

function createPreview(rows = []) {
  return {
    template: getTemplateInfo(),
    fields: getFieldMappings(),
    projectCount: 0,
    deviceCount: rows.length,
    processCount: 0,
    warnings: [],
    errors: [],
    rows
  };
}

function createParseFailurePreview(file = {}, message = "解析Excel文件失败") {
  return {
    fileName: file && file.name ? file.name : "",
    templateVersion: "单台设备生产进度统一跟踪表 v4",
    standardSheet: STANDARD_SHEET_NAME,
    source: "xlsx",
    projectCount: 0,
    deviceCount: 0,
    taskCount: 0,
    errorCount: 1,
    warningCount: 0,
    warnings: [],
    errors: [message],
    detailRows: [],
    rowIssues: [],
    headerValidation: {
      recognizedHeaders: [],
      missingRequired: [],
      unknownHeaders: []
    },
    rowValidation: {
      ok: false,
      warnings: [],
      errors: [{ row: 0, message }]
    },
    fieldMappings: getFieldMappings()
  };
}

function parseExcelPreview(file) {
  const normalizedFile = normalizeSelectedFile(file || {});
  if (normalizedFile.path) {
    if (!/\.xlsx$/i.test(normalizedFile.name || normalizedFile.path || "")) {
      return createParseFailurePreview(normalizedFile, "当前仅支持标准 .xlsx 文件，请将 .xls 另存为 .xlsx 后再导入。");
    }

    const sheetResult = xlsxReader.readSheetRows(normalizedFile, STANDARD_SHEET_NAME);
    if (sheetResult.ok) {
      return {
        ...parseTablePreview(sheetResult.rows, normalizedFile),
        standardSheet: sheetResult.sheetName,
        source: "xlsx"
      };
    }

    return createParseFailurePreview(normalizedFile, `真实Excel解析失败：${sheetResult.message}`);
  }

  return parseMockPreview(normalizedFile);
}

function parseMockPreview(file) {
  const preview = mockData.importPreview || {};
  const headers = preview.headers || getFieldMappings().map((item) => item.header);
  const headerValidation = validateHeaders(headers);
  const rowValidation = validateImportRows(preview.detailRows || []);
  const rowIssues = buildRowIssues(preview.detailRows || [], rowValidation);
  const warnings = []
    .concat(preview.warnings || [])
    .concat(rowValidation.warnings || []);
  const errors = []
    .concat(preview.errors || [])
    .concat(headerValidation.missingRequired.map((field) => `缺少必填字段：${field}`))
    .concat(headerValidation.unknownHeaders.map((field) => `无法识别表头：${field}`))
    .concat((rowValidation.errors || []).map((item) => `第${item.row}行：${item.message}`));

  return {
    fileName: file && file.name ? file.name : "",
    templateVersion: preview.templateVersion || "单台设备生产进度统一跟踪表 v4",
    standardSheet: STANDARD_SHEET_NAME,
    source: "mock",
    projectCount: preview.projectCount || 0,
    deviceCount: preview.deviceCount || 0,
    taskCount: preview.taskCount || 0,
    errorCount: errors.length,
    warningCount: warnings.length,
    warnings,
    errors,
    detailRows: preview.detailRows || [],
    rowIssues,
    headerValidation,
    rowValidation,
    fieldMappings: getFieldMappings()
  };
}

function parseTablePreview(tableRows = [], file = {}) {
  const parsed = importParser.parseStandardRows(tableRows, getFieldMappings());
  const headerValidation = validateHeaders(parsed.headers);
  const rowValidation = validateImportRows(parsed.detailRows);
  const rowIssues = buildRowIssues(parsed.detailRows, rowValidation);
  const warnings = rowValidation.warnings || [];
  const errors = []
    .concat(headerValidation.missingRequired.map((field) => `缺少必填字段：${field}`))
    .concat(headerValidation.unknownHeaders.map((field) => `无法识别表头：${field}`))
    .concat((rowValidation.errors || []).map((item) => `第${item.row}行：${item.message}`));
  const projectCount = new Set(parsed.detailRows.map((item) => item.projectNo).filter(Boolean)).size;
  const deviceCount = new Set(parsed.detailRows.map(getImportDeviceNo).filter(Boolean)).size;

  return {
    fileName: file && file.name ? file.name : "",
    templateVersion: "单台设备生产进度统一跟踪表 v4",
    standardSheet: STANDARD_SHEET_NAME,
    projectCount,
    deviceCount,
    taskCount: parsed.detailRows.length,
    errorCount: errors.length,
    warningCount: warnings.length,
    warnings,
    errors,
    detailRows: parsed.detailRows,
    rowIssues,
    headerValidation,
    rowValidation,
    fieldMappings: getFieldMappings()
  };
}

function summarizePreviewResult(preview = {}, file = {}) {
  const errorCount = Number(preview.errorCount || 0);
  const warningCount = Number(preview.warningCount || 0);
  const ok = errorCount === 0;
  return {
    ok,
    status: ok ? "通过" : "未通过",
    statusClass: ok ? "success" : "danger",
    fileName: preview.fileName || file.name || "",
    source: preview.source || "xlsx",
    standardSheet: preview.standardSheet || STANDARD_SHEET_NAME,
    projectCount: Number(preview.projectCount || 0),
    deviceCount: Number(preview.deviceCount || 0),
    taskCount: Number(preview.taskCount || 0),
    errorCount,
    warningCount,
    errors: preview.errors || [],
    warnings: preview.warnings || [],
    rowIssues: preview.rowIssues || [],
    headerValidation: preview.headerValidation || {
      recognizedHeaders: [],
      missingRequired: [],
      unknownHeaders: []
    }
  };
}

function validateImportSamples(files = []) {
  const items = (files || [])
    .map(normalizeSelectedFile)
    .map((file) => summarizePreviewResult(parseExcelPreview(file), file));
  const summary = items.reduce((result, item) => {
    result.total += 1;
    if (item.ok) result.passed += 1;
    else result.failed += 1;
    result.projectCount += item.projectCount;
    result.deviceCount += item.deviceCount;
    result.taskCount += item.taskCount;
    result.errorCount += item.errorCount;
    result.warningCount += item.warningCount;
    return result;
  }, {
    total: 0,
    passed: 0,
    failed: 0,
    projectCount: 0,
    deviceCount: 0,
    taskCount: 0,
    errorCount: 0,
    warningCount: 0
  });

  return {
    ok: summary.failed === 0,
    summary,
    items
  };
}

function validateImportRows(rows = []) {
  const errors = [];
  const warnings = [];
  const warningSet = new Set();
  const seenTaskKeys = new Set();
  const duplicateTaskKeys = [];
  const pushWarning = (message) => {
    if (warningSet.has(message)) return;
    warningSet.add(message);
    warnings.push(message);
  };

  rows.forEach((row, index) => {
    const rowNo = getImportRowNo(row, index);
    const deviceNo = getImportDeviceNo(row);
    const shipDate = getBusinessShipDate(row);
    const originalProcess = row.process || "";
    row.process = normalizeProcessName(originalProcess);
    if (isDisabledProcessName(row.process)) {
      row._skipImport = true;
      pushWarning(`第${rowNo}行工序“${originalProcess}”已停用，导入时将忽略。`);
      return;
    }
    if (!row.projectNo) errors.push({ row: rowNo, message: "缺少项目号" });
    if (!deviceNo) errors.push({ row: rowNo, message: "缺少设备号" });
    if (!row.process) errors.push({ row: rowNo, message: "缺少工序" });
    if (!row.owner) pushWarning(`第${rowNo}行责任人为空，导入后保留为待分配任务。`);
    if (row.remark && String(row.remark).indexOf("示例") >= 0) {
      pushWarning(`第${rowNo}行疑似模板示例数据，上线导入前请确认已删除或替换。`);
    }
    if (deviceNo && row.projectNo && String(deviceNo).indexOf(row.projectNo) !== 0) {
      pushWarning(`第${rowNo}行唯一台号未以项目号开头，请确认设备归属。`);
    }
    if (!shipDate) {
      pushWarning(`第${rowNo}行缺少要求/计划交货期，延期判断将不完整。`);
    }
    if (row.stageDue && shipDate && compareDateText(row.stageDue, shipDate) > 0) {
      pushWarning(`第${rowNo}行阶段计划完成日晚于项目交货期。`);
    }
    if (row.actualFinish && row.stageDue && compareDateText(row.actualFinish, row.stageDue) > 0) {
      pushWarning(`第${rowNo}行实际完成日晚于阶段计划完成日。`);
    }
    if (row.actualFinish && shipDate && compareDateText(row.actualFinish, shipDate) > 0) {
      pushWarning(`第${rowNo}行实际完成日晚于项目交货期。`);
    }

    const taskKey = [row.projectNo, deviceNo, row.process].join("|");
    if (row.projectNo && deviceNo && row.process) {
      if (seenTaskKeys.has(taskKey)) {
        duplicateTaskKeys.push(taskKey);
        pushWarning(`第${rowNo}行重复的项目/设备/工序组合，导入时保留首条记录。`);
        row._skipImport = true;
        return;
      }
      seenTaskKeys.add(taskKey);
    }
  });

  if (!rows.length) {
    errors.push({ row: 0, message: "未解析到可导入的工序任务" });
  }

  return {
    ok: errors.length === 0,
    rows,
    warnings,
    errors,
    duplicateTaskKeys
  };
}

function buildRowIssues(rows = [], validation = {}) {
  const result = {};
  const getDetail = (rowNo) => rows.find((item) => Number(item.excelRow || 0) === Number(rowNo)) || rows[rowNo - 1] || {};
  (validation.errors || []).forEach((item) => {
    const key = item.row || 0;
    if (!result[key]) result[key] = { row: key, errors: [], warnings: [], detail: getDetail(key) };
    result[key].errors.push(item.message);
  });

  (validation.warnings || []).forEach((message) => {
    const match = String(message).match(/第(\d+)行/);
    const key = match ? Number(match[1]) : 0;
    if (!result[key]) result[key] = { row: key, errors: [], warnings: [], detail: getDetail(key) };
    result[key].warnings.push(message);
  });

  return Object.keys(result)
    .map((key) => result[key])
    .sort((a, b) => a.row - b.row);
}

function confirmImport(rows = [], options = {}) {
  const validation = validateImportRows(rows);
  if (!validation.ok) {
    return {
      ok: false,
      importedCount: 0,
      projectCount: 0,
      deviceCount: 0,
      taskCount: 0,
      warnings: validation.warnings,
      errors: validation.errors
    };
  }

  const projectNos = new Set();
  const deviceNos = new Set();
  let taskCount = 0;

  rows.filter((row) => !row._skipImport).forEach((row) => {
    row.process = normalizeProcessName(row.process || "");
    row.department = normalizeDepartmentName(row.department || row.currentStage || "");
    const projectNo = row.projectNo;
    const deviceNo = getImportDeviceNo(row);
    const shipDate = getBusinessShipDate(row) || row.due || "";
    const orderDateMap = options.projectOrderDates || {};
    const adminOrderDate = orderDateMap[projectNo] || row.adminOrderDate || row.orderDate || getTodayString();
    const archiveMeta = getProjectArchiveMeta(adminOrderDate);
    projectNos.add(projectNo);
    deviceNos.add(deviceNo);

    let project = mockData.projects.find((item) => item.projectNo === projectNo);
    if (!project) {
      project = {
        id: `p${mockData.projects.length + 1}`,
        projectNo,
        name: row.projectName || `导入项目 ${projectNo}`,
        customer: row.customer || "",
        admin: row.admin || "",
        adminOrderDate,
        adminOrderYear: archiveMeta.adminOrderYear,
        adminOrderMonth: archiveMeta.adminOrderMonth,
        archivePath: archiveMeta.archivePath,
        shipDate,
        progress: 0,
        done: 0,
        doing: 0,
        delayed: 0,
        notStarted: 0,
        qbOpen: 0,
        status: "进行中"
      };
      mockData.projects.push(project);
    } else {
      project.adminOrderDate = adminOrderDate;
      project.adminOrderYear = archiveMeta.adminOrderYear;
      project.adminOrderMonth = archiveMeta.adminOrderMonth;
      project.archivePath = archiveMeta.archivePath;
    }

    let device = mockData.devices.find((item) => item.deviceNo === deviceNo);
    if (!device) {
      device = {
        id: `dvc${mockData.devices.length + 1}`,
        projectNo,
        deviceNo,
        seq: row.seq || row.deviceNo || "",
        area: row.area || "",
        model: row.model || "",
        shipDate: shipDate || project.shipDate || "",
        progress: 0
      };
      mockData.devices.push(device);
    }

    if (!mockData.processMap[device.id]) {
      mockData.processMap[device.id] = [];
    }

    let process = mockData.processMap[device.id].find((item) => item.name === row.process);
    if (!process) {
      process = {
        name: row.process,
        status: row.status || "未开始",
        owner: row.owner || "-",
        phone: row.phone || "-",
        due: row.due || "",
        actualStart: row.actualStart || "",
        actualFinish: row.actualFinish || ""
      };
      mockData.processMap[device.id].push(process);
    } else {
      process.status = row.status || process.status;
      process.owner = row.owner || process.owner;
      process.due = row.due || process.due;
      process.actualStart = row.actualStart || process.actualStart;
      process.actualFinish = row.actualFinish || process.actualFinish;
    }

    const taskKey = `${projectNo}-${deviceNo}-${row.process}`;
    const exists = mockData.tasks.some((item) => item.importKey === taskKey);
    if (!exists) {
      mockData.tasks.push({
        importKey: taskKey,
        type: "生产任务",
        project: `${projectNo} ${project.name}`,
        device: deviceNo,
        process: row.process,
        department: row.department || "",
        dueDate: row.due || "",
        status: row.status || "未开始"
      });
      taskCount += 1;
    }
  });

  const log = {
    id: `imp${(mockData.importLogs || []).length + 1}`,
    createdAt: new Date().toISOString(),
    projectCount: projectNos.size,
    deviceCount: deviceNos.size,
    taskCount,
    rowCount: rows.length,
    status: validation.ok ? "成功" : "失败"
  };
  mockData.importLogs.push(log);
  auditService.recordOperation({
    module: "import",
    action: "confirm-import",
    targetType: "import",
    targetId: log.id,
    targetName: "Excel导入",
    summary: `确认导入 ${rows.length} 行`,
    detail: {
      projectCount: projectNos.size,
      deviceCount: deviceNos.size,
      taskCount,
      rowCount: rows.length
    }
  });

  return {
    ok: validation.ok,
    importedCount: rows.length,
    projectCount: projectNos.size,
    deviceCount: deviceNos.size,
    taskCount,
    log,
    warnings: validation.warnings,
    errors: validation.errors
  };
}

function paginateRows(rows = [], filters = {}) {
  const pageSize = Math.max(Number(filters.pageSize || 10), 1);
  const pageNo = Math.max(Number(filters.pageNo || 1), 1);
  const total = rows.length;
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  const start = (pageNo - 1) * pageSize;
  return {
    items: clone(rows.slice(start, start + pageSize)),
    total,
    pageNo,
    pageSize,
    pageCount,
    hasMore: start + pageSize < total
  };
}

function listImportLogs(filters = {}) {
  let logs = (mockData.importLogs || []).slice().reverse();
  const keyword = String(filters.keyword || "").trim().toLowerCase();
  if (keyword) {
    logs = logs.filter((item) => {
      const haystack = [
        item.id,
        item.status,
        item.createdAt,
        item.projectCount,
        item.deviceCount,
        item.taskCount,
        item.rowCount
      ].filter((value) => value !== undefined && value !== null).join(" ").toLowerCase();
      return haystack.indexOf(keyword) >= 0;
    });
  }
  if (filters.status) {
    logs = logs.filter((item) => item.status === filters.status);
  }
  if (filters.pageNo || filters.pageSize) {
    return paginateRows(logs, filters);
  }
  return clone(logs);
}

module.exports = {
  TEMPLATE_PATH,
  STANDARD_SHEET_NAME,
  getTemplateInfo,
  getStandardTemplateInfo,
  getTemplateDownloadInfo,
  normalizeSelectedFile,
  getFieldMappings,
  validateHeaders,
  createPreview,
  parseExcelPreview,
  parseTablePreview,
  summarizePreviewResult,
  validateImportSamples,
  validateImportRows,
  confirmImport,
  listImportLogs
};
