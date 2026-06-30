let mockData = require("../utils/mock-data");
const localMockData = JSON.parse(JSON.stringify(mockData));
const cloudData = require("./cloud-data");
const auditService = require("./audit-service");
const xlsxWriter = require("./xlsx-writer");
var notificationService = null; try { notificationService = require("./notification-service"); } catch (e) {}

const QB_READONLY_MESSAGE = "QB已切换为只读模式，请在钉钉中建单、转交、处理和关单。";

const BACKEND_MODES = {
  mock: "mock",
  cloud: "cloud"
};

let activeBackend = BACKEND_MODES.mock;

function getBackendInfo() {
  return {
    active: activeBackend,
    mock: {
      name: BACKEND_MODES.mock,
      ready: true
    },
    cloud: cloudData.getBackendInfo()
  };
}

function setBackendMode(mode) {
  if (mode === BACKEND_MODES.cloud) {
    if (!cloudData.isReady()) {
      cloudData.setSyncEnabled(false);
      return {
        ok: false,
        active: activeBackend,
        message: "Cloud data backend is not connected yet."
      };
    }
    mockData = cloudData.getStore();
    cloudData.setSyncEnabled(true);
    activeBackend = BACKEND_MODES.cloud;
    return { ok: true, active: activeBackend };
  }

  mockData = localMockData;
  cloudData.setSyncEnabled(false);
  activeBackend = BACKEND_MODES.mock;
  return { ok: true, active: activeBackend };
}

function initCloudBackend() {
  const cloudInit = cloudData.initCloud();
  if (!cloudInit.ok) {
    cloudData.setSyncEnabled(false);
    return {
      ok: false,
      active: activeBackend,
      message: cloudInit.message || "Cloud data backend is not connected yet."
    };
  }
  return setBackendMode(BACKEND_MODES.cloud);
}

function refreshCloudStore() {
  if (!cloudData.isReady()) {
    return Promise.resolve({
      ok: false,
      message: "Cloud data backend is not connected yet."
    });
  }
  return cloudData.loadStoreFromCloud().then((result) => {
    if (result.ok) {
      mockData = cloudData.getStore();
      activeBackend = BACKEND_MODES.cloud;
      cloudData.setSyncEnabled(true);
    }
    return result;
  });
}

function syncCloudStore(reason = "manual-sync") {
  if (!cloudData.isReady()) {
    return Promise.resolve({
      ok: false,
      message: "Cloud data backend is not connected yet."
    });
  }
  mockData = cloudData.getStore();
  activeBackend = BACKEND_MODES.cloud;
  cloudData.setSyncEnabled(true);
  return cloudData.persistStore(reason);
}

function checkCloudHealth() {
  return cloudData.checkCloudHealth();
}

function onCloudStoreChange(listener) {
  return cloudData.subscribeChange(listener);
}

function clone(value) {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
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

function getDictionary(name, fallback = []) {
  return clone((mockData.dictionaries && mockData.dictionaries[name]) || fallback);
}

function setDictionary(name, values = []) {
  if (!mockData.dictionaries) mockData.dictionaries = {};
  mockData.dictionaries[name] = clone(values);
  return getDictionary(name, []);
}

function getParamLibraryConfigs() {
  const libraries = getDictionary("paramLibraries", []);
  if (libraries.length) return libraries;
  return [{ key: "electrical", name: "电气设计参数库", visibleDepartments: ["电气设计部", "智能自控部"] }];
}

function canViewParamLibrary(key = "electrical", user) {
  const authService = require("./auth-service");
  const currentUser = user || (authService && authService.getCurrentUser ? authService.getCurrentUser() : {});
  if (!currentUser) return false;
  if (permissionService && permissionService.isSuperAdmin && permissionService.isSuperAdmin(currentUser)) return true;
  const config = getParamLibraryConfigs().find((item) => item.key === key);
  const visibleDepartments = (config && config.visibleDepartments) || ["电气设计部", "智能自控部"];
  return visibleDepartments.indexOf(currentUser.department) >= 0 || String(currentUser.department || "").indexOf("电气") >= 0;
}

function getVisibleParamLibraryKeys(user) {
  return getParamLibraryConfigs().filter((item) => canViewParamLibrary(item.key, user)).map((item) => item.key);
}

function getCurrentUserForService() {
  try {
    const authService = require("./auth-service");
    return authService.getCurrentUser ? authService.getCurrentUser() : null;
  } catch (e) {
    return null;
  }
}

function updateParamLibraryAccess(key, visibleDepartments = []) {
  const libraries = getParamLibraryConfigs().map((item) => Object.assign({}, item));
  const config = libraries.find((item) => item.key === key);
  if (!config) return { ok: false, message: "参数库不存在。" };
  config.visibleDepartments = visibleDepartments.slice();
  setDictionary("paramLibraries", libraries);
  recordOperation({
    module: "dictionary",
    action: "update-param-library-access",
    targetType: "paramLibrary",
    targetId: key,
    targetName: config.name,
    summary: `更新参数库权限 ${config.name}`
  });
  return { ok: true, config: clone(config) };
}

function saveParamTemplate(template = {}) {
  const templates = getDictionary("paramTemplates", []);
  const id = template.id || `tpl-${Date.now()}`;
  const next = Object.assign({}, template, { id });
  const idx = templates.findIndex((item) => item.id === id);
  if (idx >= 0) templates[idx] = next;
  else templates.unshift(next);
  setDictionary("paramTemplates", templates);
  return { ok: true, template: clone(next) };
}

function deleteParamTemplate(templateId) {
  if (!templateId) return { ok: false, message: "缺少模板 ID。" };
  const templates = getDictionary("paramTemplates", []).filter((item) => item.id !== templateId);
  setDictionary("paramTemplates", templates);
  return { ok: true, templates: clone(templates) };
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
    "结构设计": "结构设计部",
    "电工房": "电气电控车间",
    "结构班组": "生产装配",
    "电气班组": "生产装配",
    "生产部": "工艺部门",
    "仓库": "仓库部"
  };
  return map[value] || value;
}

function getDefaultDepartmentForProcess(processName = "") {
  const process = normalizeProcessName(processName);
  const map = {
    "项目设计": "项目部",
    "结构设计": "结构设计部",
    "电气设计": "电气设计部",
    "ERP录入": "工艺部门",
    "物料采购": "采购部",
    "电气盘安装": "电气电控车间",
    "结构总装": "生产装配",
    "电气总装": "生产装配",
    "电箱组装": "壁板车间",
    "调试": "品质部",
    "发货": "工艺部门"
  };
  return map[process] || "";
}

function getDefaultOwnerForProcess(processName = "") {
  const process = normalizeProcessName(processName);
  const map = {
    "项目设计": { owner: "蒋相波", phone: "138****0801" },
    "结构设计": { owner: "彭博", phone: "138****0401" },
    "电气设计": { owner: "秦朗", phone: "18352439458" },
    "ERP录入": { owner: "刘爽", phone: "138****0701" },
    "物料采购": { owner: "郑雪莲", phone: "138****1001" },
    "电气盘安装": { owner: "卢建平", phone: "138****0901" },
    "结构总装": { owner: "孙志勇", phone: "138****1301" },
    "电气总装": { owner: "朱建闯", phone: "138****1401" },
    "电箱组装": { owner: "王国峰", phone: "138****1501" },
    "调试": { owner: "李洋", phone: "138****0101" },
    "发货": { owner: "刘爽", phone: "138****0701" }
  };
  return map[process] || { owner: "-", phone: "-" };
}

function normalizeProcessOwner(process = {}) {
  const processName = normalizeProcessName(process.name || "");
  const defaults = getDefaultOwnerForProcess(processName);
  const currentOwner = String(process.owner || "").trim();
  const shouldUseDefault =
    !currentOwner ||
    currentOwner === "-" ||
    (processName === "项目设计" && currentOwner === "张绍方") ||
    (processName === "结构设计" && currentOwner === "陈七") ||
    (processName === "电气盘安装" && currentOwner === "电工房") ||
    (processName === "电箱组装" && currentOwner === "卢建平");
  if (!shouldUseDefault) return process;
  return Object.assign({}, process, {
    owner: defaults.owner,
    phone: defaults.phone
  });
}

function uniqueValues(values = []) {
  const seen = {};
  return values.filter((value) => {
    if (!value || seen[value]) return false;
    seen[value] = true;
    return true;
  });
}

function recordOperation(payload = {}) {
  return auditService.recordOperation(payload);
}

function diffFields(before = {}, after = {}, keys = []) {
  if (!keys.length) return {};
  const diff = {};
  keys.forEach((key) => {
    const oldVal = before[key];
    const newVal = after[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diff[key] = { old: oldVal, new: newVal };
    }
  });
  return diff;
}

function getRawProject(projectNo) {
  return (mockData.projects || []).find((item) => item.projectNo === projectNo) || null;
}

function findProjectStrict(projectNo) {
  if (!projectNo) return null;
  return (mockData.projects || []).find((item) => item.projectNo === projectNo) || null;
}

function getRawDevice(deviceId) {
  return (mockData.devices || []).find((item) => item.id === deviceId) || null;
}

function findDeviceStrict(deviceId) {
  if (!deviceId) return null;
  return (mockData.devices || []).find((item) => item.id === deviceId) || null;
}

function getRawDevicesByProject(projectNo) {
  return (mockData.devices || []).filter((item) => item.projectNo === projectNo);
}

function isDisabledRecord(item = {}) {
  return String(item.status || "") === "停用";
}

function isDoneStatus(status) {
  const text = String(status || "");
  return text === "已完成" || text === "已关闭" || text.indexOf("完成") >= 0 || text.indexOf("关闭") >= 0;
}

function isDoingStatus(status) {
  const text = String(status || "");
  return text === "进行中" || text.indexOf("进行") >= 0 || text.indexOf("处理中") >= 0;
}

function isDelayedStatus(status) {
  const text = String(status || "");
  return text.indexOf("延期") >= 0;
}

function isProcessOverdue(process = {}, todayText = getTodayString()) {
  if (isDoneStatus(process.status)) return false;
  const diff = getDayDiff(parseDateValue(process.due || process.dueDate), parseDateValue(todayText));
  return diff !== null && diff <= 0;
}

function isActualFinishLate(process = {}) {
  const diff = getDayDiff(parseDateValue(process.actualFinish), parseDateValue(process.due || process.dueDate));
  return diff !== null && diff > 0;
}

function summarizeProcesses(processes = [], todayText = getTodayString()) {
  return processes.reduce((summary, process) => {
    summary.total += 1;
    if (isDoneStatus(process.status)) {
      summary.done += 1;
    } else if (isProcessOverdue(process, todayText)) {
      summary.delayed += 1;
    } else if (isDoingStatus(process.status)) {
      summary.doing += 1;
    } else {
      summary.notStarted += 1;
    }
    return summary;
  }, {
    total: 0,
    done: 0,
    doing: 0,
    delayed: 0,
    notStarted: 0
  });
}

function getProcessesForDevice(device) {
  if (!device || !device.id) return [];
  const activeProcesses = (mockData.processMap && mockData.processMap[device.id]) || [];
  if (activeProcesses.length) return activeProcesses;
  return (localMockData.processMap && localMockData.processMap[device.id]) || [];
}

function ensureWritableProcessesForDevice(device) {
  if (!device || !device.id) return [];
  if (!mockData.processMap) mockData.processMap = {};
  if (!Array.isArray(mockData.processMap[device.id]) || !mockData.processMap[device.id].length) {
    mockData.processMap[device.id] = clone(getProcessesForDevice(device));
  }
  return mockData.processMap[device.id] || [];
}

function decorateDeviceSummary(device = {}, todayText = getTodayString()) {
  const processes = getProcessesForDevice(device)
    .filter((item) => !isDisabledProcessName(item.name || ""))
    .map((item) => {
      const process = normalizeProcessOwner(Object.assign({}, item, {
        name: normalizeProcessName(item.name || ""),
        department: normalizeDepartmentName(item.department || getDefaultDepartmentForProcess(item.name || ""))
      }));
      return Object.assign(process, {
        isOverdue: isProcessOverdue(process, todayText),
        isActualFinishLate: isActualFinishLate(process),
        actualFinishTone: isActualFinishLate(process) ? "late-finish" : ""
      });
    });
  const summary = summarizeProcesses(processes, todayText);
  const progress = summary.total ? Math.round((summary.done / summary.total) * 100) : Number(device.progress || 0);
  return {
    ...device,
    progress,
    done: summary.done,
    doing: summary.doing,
    delayed: summary.delayed,
    notStarted: summary.notStarted,
    processCount: summary.total,
    delayedCount: summary.delayed,
    processes: clone(processes)
  };
}

function decorateProjectSummary(project = {}, todayText = getTodayString()) {
  if (!project) return project;
  const devices = getRawDevicesByProject(project.projectNo).filter((item) => !isDisabledRecord(item));
  const deviceSummaries = devices.map((device) => decorateDeviceSummary(device, todayText));
  const processSummary = deviceSummaries.reduce((summary, device) => {
    summary.total += Number(device.processCount || 0);
    summary.done += Number(device.done || 0);
    summary.doing += Number(device.doing || 0);
    summary.delayed += Number(device.delayed || 0);
    summary.notStarted += Number(device.notStarted || 0);
    return summary;
  }, {
    total: 0,
    done: 0,
    doing: 0,
    delayed: 0,
    notStarted: 0
  });
  const qbOpen = (mockData.qbList || []).filter((item) =>
    item.projectNo === project.projectNo && !isDoneStatus(item.status) && !item.closed
  ).length;
  const completedWithOpenQb = isDoneStatus(project.status) && qbOpen > 0;
  const progress = processSummary.total
    ? Math.round((processSummary.done / processSummary.total) * 100)
    : Number(project.progress || 0);
  let shipDateHistory = Array.isArray(project.shipDateHistory) ? project.shipDateHistory : [];
  if (!shipDateHistory.length && project.originalShipDate && project.shipDate && project.originalShipDate !== project.shipDate) {
    shipDateHistory = [
      {
        index: 1,
        adminOrderDate: project.adminOrderDate || "",
        shipDate: project.originalShipDate,
        type: "initial"
      },
      {
        index: 2,
        adminOrderDate: project.adminOrderDate || "",
        shipDate: project.shipDate,
        type: getShipDateAdjustType(project.originalShipDate, project.shipDate)
      }
    ];
  }
  const hasShipDateAdjustment = shipDateHistory.length > 1 || !!project.shipDateAdjusted;
  const latestShipDateRecord = shipDateHistory[shipDateHistory.length - 1] || null;
  const shipDateAdjustType = latestShipDateRecord && latestShipDateRecord.type
    ? latestShipDateRecord.type
    : (project.shipDateAdjustType || (project.shipDateDelayed ? "delayed" : ""));
  const shipDateSuffixMap = {
    delayed: " 延期",
    ahead: " 提前"
  };

  return {
    ...project,
    progress,
    done: processSummary.done,
    doing: processSummary.doing,
    delayed: processSummary.delayed,
    delayedCount: processSummary.delayed,
    notStarted: processSummary.notStarted,
    taskCount: processSummary.total,
    deviceCount: deviceSummaries.length,
    qbOpen,
    completedWithOpenQb,
    statusTone: completedWithOpenQb ? "warning-status" : (isDoneStatus(project.status) ? "done-status" : ""),
    shipDateHistory: clone(shipDateHistory),
    hasShipDateAdjustment,
    shipDateAdjustType,
    shipDateTone: shipDateAdjustType ? `${shipDateAdjustType}-ship-date` : "",
    shipDateSuffix: shipDateSuffixMap[shipDateAdjustType] || ""
  };
}

function listProjects(filters = {}) {
  let projects = mockData.projects || [];
  if (!filters.includeArchived) {
    projects = projects.filter((item) => item.status !== "已归档");
  }
  if (filters.status) {
    projects = projects.filter((item) => item.status === filters.status);
  }
  if (filters.keyword) {
    const keyword = String(filters.keyword).toLowerCase();
    projects = projects.filter((item) =>
      [item.projectNo, item.name, item.customer, item.admin]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    );
  }
  if (filters.year) {
    const year = String(filters.year);
    projects = projects.filter((item) => String(item.adminOrderYear || String(item.adminOrderDate || "").slice(0, 4)) === year);
  }
  if (filters.month) {
    const month = String(filters.month).padStart(2, "0");
    projects = projects.filter((item) => String(item.adminOrderMonth || String(item.adminOrderDate || "").slice(5, 7)).padStart(2, "0") === month);
  }
  projects = projects.slice().sort((a, b) => {
    const dateA = String(a.adminOrderDate || a.createdAt || "");
    const dateB = String(b.adminOrderDate || b.createdAt || "");
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    return String(b.projectNo || "").localeCompare(String(a.projectNo || ""));
  });
  const today = getTodayString();
  return clone(projects.map((project) => decorateProjectSummary(project, today)));
}

function filterProjectsByView(view, extraFilters = {}) {
  const viewKeyMap = {
    all: "全部",
    ongoing: "进行中",
    delayed: "逾期",
    qb: "有QB",
    archived: "已归档"
  };
  const viewKey = viewKeyMap[view] || view;
  let projects = listProjects({
    ...extraFilters,
    includeArchived: viewKey === "已归档"
  });
  if (viewKey === "逾期" || viewKey === "延期") {
    projects = projects.filter((item) => Number(item.delayed || 0) > 0);
  } else if (viewKey === "有QB") {
    projects = projects.filter((item) => Number(item.qbOpen || 0) > 0);
  } else if (viewKey === "已归档") {
    projects = projects.filter((item) => item.status === "已归档");
  } else if (viewKey && viewKey !== "全部") {
    projects = projects.filter((item) => item.status === viewKey);
  }
  return clone(projects);
}

function getProject(projectNo) {
  return clone(decorateProjectSummary(getRawProject(projectNo)));
}

function getArchiveMetaByAdminOrderDate(adminOrderDate = "") {
  const text = String(adminOrderDate || "").trim();
  const match = text.match(/^(\d{4})-(\d{1,2})/);
  const year = match ? match[1] : "";
  const month = match ? String(match[2]).padStart(2, "0") : "";
  return {
    adminOrderYear: year,
    adminOrderMonth: month,
    archivePath: year && month ? `projects/${year}/${month}` : ""
  };
}

function getShipDateAdjustType(fromDate = "", toDate = "") {
  const diff = getDayDiff(parseDateValue(toDate), parseDateValue(fromDate));
  if (diff === null || diff === 0) return "";
  return diff > 0 ? "delayed" : "ahead";
}

function buildShipDateHistory(existing, adminOrderDate, nextShipDate) {
  const currentHistory = Array.isArray(existing && existing.shipDateHistory)
    ? existing.shipDateHistory.slice()
    : [];
  if (!existing || !existing.shipDate || !nextShipDate || existing.shipDate === nextShipDate) {
    return {
      history: currentHistory,
      adjustType: (existing && existing.shipDateAdjustType) || "",
      adjusted: currentHistory.length > 1 || !!(existing && existing.shipDateAdjusted)
    };
  }

  const previousShipDate = existing.shipDate;
  const adjustType = getShipDateAdjustType(previousShipDate, nextShipDate);
  const history = currentHistory.length
    ? currentHistory.slice()
    : [{
        index: 1,
        adminOrderDate: existing.adminOrderDate || adminOrderDate || "",
        shipDate: previousShipDate,
        type: "initial"
      }];
  const last = history[history.length - 1] || {};
  if (last.shipDate !== nextShipDate) {
    history.push({
      index: history.length + 1,
      adminOrderDate: adminOrderDate || existing.adminOrderDate || "",
      shipDate: nextShipDate,
      type: adjustType
    });
  }
  return {
    history: history.map((item, index) => ({ ...item, index: index + 1 })),
    adjustType,
    adjusted: true
  };
}

function syncProjectShipDate(projectNo, shipDate) {
  (mockData.devices || []).forEach((device) => {
    if (!device || device.projectNo !== projectNo) return;
    device.shipDate = shipDate || device.shipDate || "";
    const processes = getProcessesForDevice(device);
    processes.forEach((process) => {
      if (normalizeProcessName(process.name || "") === "发货") {
        process.due = shipDate || process.due || "";
      }
    });
  });
}

function saveProject(payload = {}) {
  const projects = mockData.projects || [];
  const projectNo = String(payload.projectNo || "").trim();
  if (!projectNo) {
    return { ok: false, message: "请填写项目号" };
  }

  const existing = projects.find((item) => item.projectNo === projectNo || item.id === payload.id);
  const adminOrderDate = payload.adminOrderDate || (existing && existing.adminOrderDate) || getTodayString();
  const archiveMeta = getArchiveMetaByAdminOrderDate(adminOrderDate);
  const nextShipDate = payload.shipDate || "";
  const shipDateChanged = !!(existing && nextShipDate && existing.shipDate && nextShipDate !== existing.shipDate);
  const shipDateHistoryState = buildShipDateHistory(existing, adminOrderDate, nextShipDate);
  const originalShipDate = existing
    ? (existing.originalShipDate || (shipDateHistoryState.history[0] && shipDateHistoryState.history[0].shipDate) || "")
    : "";
  const shipDateDelayed = shipDateHistoryState.adjustType === "delayed";
  const project = {
    id: payload.id || (existing && existing.id) || `p${projects.length + 1}`,
    projectNo,
    name: payload.name || "",
    customer: payload.customer || "",
    admin: payload.admin || "",
    adminOrderDate,
    ...archiveMeta,
    shipDate: nextShipDate,
    originalShipDate,
    shipDateDelayed,
    shipDateAdjusted: shipDateHistoryState.adjusted,
    shipDateAdjustType: shipDateHistoryState.adjustType,
    shipDateHistory: shipDateHistoryState.history,
    progress: existing ? existing.progress : 0,
    done: existing ? existing.done : 0,
    doing: existing ? existing.doing : 0,
    delayed: existing ? existing.delayed : 0,
    notStarted: existing ? existing.notStarted : 0,
    qbOpen: existing ? existing.qbOpen : 0,
    status: payload.status || (existing && existing.status) || "进行中"
  };

  if (existing) {
    const before = clone(existing);
    Object.assign(existing, project);
    if (shipDateChanged) {
      syncProjectShipDate(existing.projectNo, existing.shipDate);
    }
    recordOperation({
      module: "project",
      action: "update",
      targetType: "project",
      targetId: existing.projectNo,
      targetName: existing.name,
      summary: `更新项目 ${existing.projectNo}`,
      detail: {
        diff: diffFields(before, existing, ["name", "customer", "admin", "adminOrderDate", "shipDate", "originalShipDate", "shipDateDelayed", "shipDateAdjustType", "status"])
      }
    });
    return { ok: true, project: clone(existing) };
  }

  projects.unshift(project);
  recordOperation({
    module: "project",
    action: "create",
    targetType: "project",
    targetId: project.projectNo,
    targetName: project.name,
    summary: `新建项目 ${project.projectNo}`
  });
  return { ok: true, project: clone(project) };
}

function deleteProject(projectNo) {
  const projects = mockData.projects || [];
  const index = projects.findIndex((item) => item.projectNo === projectNo || item.id === projectNo);
  if (index < 0) return { ok: false, message: "未找到项目" };

  const [project] = projects.splice(index, 1);
  const projectDeviceIds = (mockData.devices || [])
    .filter((item) => item.projectNo === project.projectNo)
    .map((item) => item.id);

  mockData.devices = (mockData.devices || []).filter((item) => item.projectNo !== project.projectNo);
  projectDeviceIds.forEach((deviceId) => {
    if (mockData.processMap) delete mockData.processMap[deviceId];
    if (mockData.electricalParamValues) delete mockData.electricalParamValues[deviceId];
  });

  const belongsToProject = (item = {}) => {
    const projectText = String(item.project || "");
    return item.projectNo === project.projectNo || projectText.indexOf(project.projectNo) >= 0;
  };

  mockData.tasks = (mockData.tasks || []).filter((item) => !belongsToProject(item));
  mockData.dispatchTasks = (mockData.dispatchTasks || []).filter((item) => !belongsToProject(item));

  const qbNos = new Set((mockData.qbList || [])
    .filter((item) => item.projectNo === project.projectNo)
    .map((item) => item.qbNo));
  mockData.qbList = (mockData.qbList || []).filter((item) => item.projectNo !== project.projectNo);
  if (mockData.qbDetails) {
    qbNos.forEach((qbNo) => delete mockData.qbDetails[qbNo]);
  }

  recordOperation({
    module: "project",
    action: "delete",
    targetType: "project",
    targetId: project.projectNo,
    targetName: project.name,
    summary: `删除项目 ${project.projectNo}`,
    detail: {
      deviceCount: projectDeviceIds.length,
      qbCount: qbNos.size
    }
  });

  return {
    ok: true,
    project: clone(project),
    deleted: {
      deviceCount: projectDeviceIds.length,
      qbCount: qbNos.size
    }
  };
}

function listDevices(filters = {}) {
  let devices = mockData.devices || [];
  if (filters.projectNo) {
    return getDevicesByProject(filters.projectNo);
  }
  return clone(devices);
}

function getDevicesByProject(projectNo) {
  const today = getTodayString();
  return clone(getRawDevicesByProject(projectNo).map((device) => decorateDeviceSummary(device, today)));
}

function getDevice(deviceId) {
  return clone(decorateDeviceSummary(getRawDevice(deviceId)));
}

function createDefaultProcesses(shipDate = "") {
  return listProcessOptions()
    .map((name) => {
      const defaults = getDefaultOwnerForProcess(name);
      return {
        name,
        status: "未开始",
        owner: defaults.owner,
        phone: defaults.phone,
        due: shipDate || "",
        actualStart: "",
        actualFinish: ""
      };
    });
}

function saveDevice(payload = {}) {
  const devices = mockData.devices || [];
  const projectNo = String(payload.projectNo || "").trim();
  if (!findProjectStrict(projectNo)) {
    return { ok: false, message: "项目不存在，无法保存设备" };
  }
  const deviceNo = String(payload.deviceNo || "").trim();
  if (!deviceNo) {
    return { ok: false, message: "请填写设备编号" };
  }

  const existing = devices.find((item) => item.id === payload.id || item.deviceNo === deviceNo);
  const device = {
    id: payload.id || (existing && existing.id) || `dvc${devices.length + 1}`,
    projectNo,
    deviceNo,
    seq: payload.seq || "",
    area: payload.area || "",
    model: payload.model || "",
    shipDate: payload.shipDate || "",
    progress: existing ? existing.progress : 0,
    status: payload.status || (existing && existing.status) || "启用"
  };

  if (existing) {
    Object.assign(existing, device);
  } else {
    devices.push(device);
  }

  if (!mockData.processMap[device.id]) {
    mockData.processMap[device.id] = createDefaultProcesses(device.shipDate);
  }

  const projectDevices = devices.filter((item) => item.projectNo === projectNo);
  const project = (mockData.projects || []).find((item) => item.projectNo === projectNo);
  if (project && projectDevices.length) {
    project.notStarted = Math.max(Number(project.notStarted || 0), projectDevices.length);
  }

  recordOperation({
    module: "device",
    action: existing ? "update" : "create",
    targetType: "device",
    targetId: device.id,
    targetName: device.deviceNo,
    summary: `${existing ? "更新" : "新增"}设备 ${device.deviceNo}`,
    detail: { projectNo: device.projectNo }
  });

  return { ok: true, device: getDevice(device.id) };
}

function disableDevice(deviceId) {
  const device = (mockData.devices || []).find((item) => item.id === deviceId);
  if (!device) return { ok: false, message: "未找到设备" };
  const beforeStatus = device.status;
  device.status = "停用";
  recordOperation({
    module: "device",
    action: "disable",
    targetType: "device",
    targetId: device.id,
    targetName: device.deviceNo,
    summary: `停用设备 ${device.deviceNo}`,
    detail: { projectNo: device.projectNo }
  });
  return { ok: true, device: clone(device) };
}

function deleteDevice(deviceId) {
  const devices = mockData.devices || [];
  const index = devices.findIndex((item) => item.id === deviceId);
  if (index < 0) return { ok: false, message: "未找到设备" };

  const [device] = devices.splice(index, 1);
  if (mockData.processMap) delete mockData.processMap[device.id];
  if (mockData.electricalParamValues) delete mockData.electricalParamValues[device.id];

  const deviceNo = device.deviceNo || "";
  mockData.tasks = (mockData.tasks || []).filter((item) => String(item.device || "").indexOf(deviceNo) < 0);
  mockData.dispatchTasks = (mockData.dispatchTasks || []).filter((item) => String(item.device || "").indexOf(deviceNo) < 0);

  recordOperation({
    module: "device",
    action: "delete",
    targetType: "device",
    targetId: device.id,
    targetName: device.deviceNo,
    summary: `删除设备 ${device.deviceNo}`,
    detail: { projectNo: device.projectNo }
  });

  return { ok: true, device: clone(device) };
}

function getProcessesByDevice(deviceId) {
  const device = findDeviceStrict(deviceId);
  if (!device) return [];
  return clone(getProcessesForDevice(device));
}

function listQb(filters = {}) {
  let qbList = mockData.qbList || [];
  if (filters.projectNo) {
    qbList = qbList.filter((item) => item.projectNo === filters.projectNo);
  }
  if (filters.owner) {
    qbList = qbList.filter((item) => item.owner === filters.owner);
  }
  if (filters.status === "open") {
    qbList = qbList.filter((item) => !isDoneStatus(item.status) && !item.closed);
  } else if (filters.status === "closed") {
    qbList = qbList.filter((item) => isDoneStatus(item.status) || item.closed);
  } else if (filters.status) {
    qbList = qbList.filter((item) => item.status === filters.status);
  }
  const keyword = String(filters.keyword || "").trim().toLowerCase();
  if (keyword) {
    qbList = qbList.filter((item) => {
      const project = findProjectStrict(item.projectNo) || {};
      const haystack = [
        item.qbNo,
        item.projectNo,
        project.name,
        item.title,
        item.process,
        item.owner,
        item.currentOwner,
        item.status,
        item.occurredAt
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.indexOf(keyword) >= 0;
    });
  }
  const rows = qbList.map((item) => {
    const project = findProjectStrict(item.projectNo) || {};
    return {
      ...item,
      projectName: item.projectName || project.name || "",
      displayOwner: item.currentOwner || item.owner || ""
    };
  });
  if (filters.pageNo || filters.pageSize) {
    return paginateRows(rows, filters);
  }
  return clone(rows);
}

function getQb(qbNo) {
  const qb = (mockData.qbList || []).find((item) => item.qbNo === qbNo);
  return clone(qb || null);
}

function getQbDetail(qbNo) {
  const details = mockData.qbDetails || {};
  const detail = qbNo ? details[qbNo] : null;
  if (detail) {
    const clonedDetail = clone(detail);
    clonedDetail.logs = (clonedDetail.logs || []).map((item, index) => ({
      ...item,
      rowKey: item.rowKey || [clonedDetail.qb && clonedDetail.qb.qbNo, item.time, item.user, index].join("-")
    }));
    return clonedDetail;
  }

  const qb = getQb(qbNo);
  if (!qb) return null;
  return {
    qb,
    linkedDevices: [],
    logs: []
  };
}

function buildTasksFromProcessMap() {
  const tasks = [];
  (mockData.devices || []).forEach((device) => {
    if (!device || isDisabledRecord(device)) return;
    const project = findProjectStrict(device.projectNo);
    if (!project) return;
    getProcessesForDevice(device).forEach((process) => {
      if (!process || isDisabledProcessName(process.name || "")) return;
      process = normalizeProcessOwner(Object.assign({}, process, { name: normalizeProcessName(process.name || "") }));
      tasks.push({
        type: "生产任务",
        projectNo: project.projectNo,
        project: `${project.projectNo} ${project.name || ""}`.trim(),
        deviceId: device.id,
        device: device.deviceNo,
        process: process.name,
        department: normalizeDepartmentName(process.department || getDefaultDepartmentForProcess(process.name || "")),
        owner: process.owner && process.owner !== "-" ? process.owner : "",
        phone: process.phone && process.phone !== "-" ? process.phone : "",
        dueDate: process.due || process.dueDate || "",
        status: process.status || "未开始",
        actualStart: process.actualStart || "",
        actualFinish: process.actualFinish || "",
        importKey: `process-${device.id}-${normalizeProcessName(process.name || "")}`
      });
    });
  });
  return tasks;
}

function mergeTasksWithProcessMap(tasks = []) {
  const merged = tasks.slice();
  const seen = {};
  merged.forEach((task) => {
    const key = [task.projectNo || task.project, task.deviceId || task.device, normalizeProcessName(task.process || "")].join("|");
    seen[key] = true;
  });
  buildTasksFromProcessMap().forEach((task) => {
    const key = [task.projectNo || task.project, task.deviceId || task.device, normalizeProcessName(task.process || "")].join("|");
    if (!seen[key]) merged.push(task);
  });
  return merged;
}

function listTasks(filters = {}) {
  let tasks = mergeTasksWithProcessMap(mockData.tasks || []);
  if (filters.type) {
    tasks = tasks.filter((item) => item.type === filters.type);
  }
  if (filters.status) {
    tasks = tasks.filter((item) => item.status === filters.status);
  }
  return clone(tasks);
}

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateText(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return "";
  return `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`;
}

function parseDateValue(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function getDayDiff(target, base) {
  if (!target || !base) return null;
  const dayMs = 24 * 60 * 60 * 1000;
  const targetDate = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const baseDate = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  return Math.round((targetDate.getTime() - baseDate.getTime()) / dayMs);
}

function isClosedTask(item = {}) {
  const status = String(item.status || "");
  return item.closed || status === "已完成" || status === "已关闭";
}

function decorateDueState(item = {}, todayText = getTodayString()) {
  const dueDate = parseDateValue(item.dueDate || item.due || item.plannedDueDate);
  const today = parseDateValue(todayText);
  const diff = getDayDiff(dueDate, today);
  const closed = isClosedTask(item);
  const statusText = String(item.status || "");
  const isOverdue = !closed && (diff !== null ? diff < 0 : statusText.indexOf("逾期") >= 0);
  const isDueToday = !closed && diff === 0;
  const isDueSoon = !closed && diff !== null && diff > 0 && diff <= 2;
  let dueLabel = "";
  let urgency = "normal";

  if (closed) {
    dueLabel = "已完成";
  } else if (isOverdue) {
    dueLabel = diff === null ? "已逾期" : `逾期${Math.abs(diff)}天`;
    urgency = "overdue";
  } else if (isDueToday) {
    dueLabel = "今日到期";
    urgency = "today";
  } else if (isDueSoon) {
    dueLabel = `${diff}天后到期`;
    urgency = "soon";
  } else if (diff !== null) {
    dueLabel = `${diff}天后`;
  }

  return {
    ...item,
    isOverdue,
    isDueToday,
    isDueSoon,
    dueLabel,
    urgency
  };
}

function getTaskRowKey(item = {}, index = 0) {
  return item.importKey || item.qbNo || [item.type, item.project, item.device, item.process, index].join("-");
}

function decorateTask(item = {}, index = 0) {
  const typeText = String(item.type || "").toUpperCase();
  const statusText = String(item.status || "");
  let kind = "process";
  if (typeText.indexOf("QB") >= 0) kind = "qb";
  else if (String(item.type || "").indexOf("待分配") >= 0 || (statusText.indexOf("待") >= 0 && !item.owner)) kind = "assign";
  const normalizedProcess = normalizeProcessName(item.process || "");
  const normalizedDepartment = normalizeDepartmentName(item.department || "");
  const normalizedOwner = normalizeProcessOwner({
    name: normalizedProcess,
    owner: item.owner || "",
    phone: item.phone || ""
  });
  return {
    ...item,
    process: normalizedProcess,
    department: normalizedDepartment,
    owner: normalizedOwner.owner,
    phone: normalizedOwner.phone,
    kind,
    rowKey: getTaskRowKey(item, index)
  };
}

function listDecoratedTasks() {
  const today = getTodayString();
  return listTasks()
    .filter((item) => !isDisabledProcessName(item.process || ""))
    .map((item, index) => decorateDueState(decorateTask(item, index), today));
}

function getTaskByRowKey(rowKey) {
  if (!rowKey) return null;
  const tasks = listDecoratedTasks();
  return clone(tasks.find((item) => item.rowKey === rowKey) || null);
}

function updateTaskStatusByRowKey(rowKey, status) {
  if (!rowKey || !status) return { ok: false, message: "缺少任务或状态。" };
  const rawTasks = mockData.tasks || [];
  for (let index = 0; index < rawTasks.length; index += 1) {
    const task = rawTasks[index];
    if (getTaskRowKey(task, index) === rowKey || task.importKey === rowKey) {
      const beforeStatus = task.status || "";
      task.status = status;
      if (status === "待分配") task.owner = "";
      recordOperation({
        module: "task",
        action: "kanban-move",
        targetType: "task",
        targetId: rowKey,
        targetName: task.process || task.title || task.qbNo || "",
        summary: `看板移动任务到 ${status}`,
        detail: { beforeStatus, afterStatus: status }
      });
      return { ok: true, task: clone(decorateTask(task, index)) };
    }
  }

  const decorated = listDecoratedTasks().find((item) => item.rowKey === rowKey || item.importKey === rowKey);
  if (!decorated) return { ok: false, message: "未找到任务。" };
  const device = (mockData.devices || []).find((item) => item.id === decorated.deviceId || item.deviceNo === decorated.device || String(decorated.device || "").indexOf(item.deviceNo) >= 0);
  if (!device) return { ok: false, message: "未找到任务设备。" };
  const processName = normalizeProcessName(decorated.process || "");
  const processList = mockData.processMap && mockData.processMap[device.id];
  const process = processList && processList.find((item) => normalizeProcessName(item.name || "") === processName);
  if (!process) return { ok: false, message: "未找到可写回的工序。" };
  const beforeStatus = process.status || "";
  process.status = status;
  recordOperation({
    module: "task",
    action: "kanban-move",
    targetType: "process",
    targetId: rowKey,
    targetName: process.name || "",
    summary: `看板移动工序到 ${status}`,
    detail: { deviceId: device.id, beforeStatus, afterStatus: status }
  });
  return { ok: true, task: getTaskByRowKey(rowKey) };
}

function filterTasksByView(view, currentUser = {}) {
  const viewKeyMap = {
    mine: "我的",
    department: "本部门",
    assign: "待分配",
    today: "今日",
    overdue: "逾期",
    qb: "QB"
  };
  const viewKey = viewKeyMap[view] || view;
  let tasks = listDecoratedTasks();
  if (viewKey === "QB") {
    return tasks.filter((item) => item.kind === "qb" && item.status !== "已关闭" && !item.closed);
  }
  if (viewKey === "待分配") {
    return tasks.filter((item) => item.kind === "assign");
  }
  if (viewKey === "逾期") {
    return tasks.filter((item) => item.isOverdue);
  }
  if (viewKey === "今日") {
    return tasks.filter((item) => item.isDueToday);
  }
  if (viewKey === "本部门" && currentUser.department) {
    return tasks.filter((item) => item.department === currentUser.department || String(item.project || "").indexOf(currentUser.department) >= 0);
  }
  if (viewKey === "我的" && currentUser.name) {
    return tasks.filter((item) => item.owner === currentUser.name);
  }
  return clone(tasks);
}

function listUsers(filters = {}) {
  const userOrder = [
    "蒋相波", "彭博", "秦朗", "刘爽", "郑雪莲", "卢建平", "孙志勇", "朱建闯", "王国峰", "李洋",
    "陈尚杰", "郭敬锋", "苏高森", "张绍方", "IT", "吴洁", "总经理"
  ];
  let users = (mockData.users || []).map((user) => {
    const departmentMap = {
      "电气设计": "电气设计部",
      "电气设计部门": "电气设计部",
      "智能自控部": "电气设计部",
      "项目管理": "项目部",
      "进度管理": "制造部",
      "总经办": "总经办/销售/市场",
      "结构设计": "结构设计部",
      "电工房": "电气电控车间",
      "结构班组": "生产装配",
      "电气班组": "生产装配",
      "生产部": "工艺部门",
      "仓库": "仓库部"
    };
    const roleMap = {
      "最高级管理员": "后台管理员",
      "超级管理员": "后台管理员",
      "部门主管": "部门管理员"
    };
    return Object.assign({}, user, {
      name: user.name === "后台管理员" && user.department === "信息化" ? "IT" : user.name,
      department: departmentMap[user.department] || user.department,
      role: roleMap[user.role] || user.role,
      roleLabel: roleMap[user.roleLabel] || user.roleLabel
    });
  });
  if (filters.department) {
    users = users.filter((item) => item.department === filters.department);
  }
  if (filters.status) {
    users = users.filter((item) => item.status === filters.status);
  }
  users = users.slice().sort((a, b) => {
    const ai = userOrder.indexOf(a.name);
    const bi = userOrder.indexOf(b.name);
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
  });
  return clone(users);
}

function getUser(userId) {
  const user = (mockData.users || []).find((item) => item.id === userId);
  return clone(user || null);
}

function listDepartments(filters = {}) {
  let departments = mockData.departments || [];
  if (filters.status) {
    departments = departments.filter((item) => item.status === filters.status);
  }
  const seen = {};
  return clone(departments
    .map((item) => Object.assign({}, item, { name: normalizeDepartmentName(item.name || "") }))
    .sort((a, b) => Number(a.sort || 999) - Number(b.sort || 999))
    .filter((item) => {
      if (!item.name || seen[item.name]) return false;
      seen[item.name] = true;
      return true;
    }));
}

function getDepartment(departmentId) {
  const department = (mockData.departments || []).find((item) => item.id === departmentId);
  return clone(department || null);
}

function getDeviceParams(deviceId) {
  const device = findDeviceStrict(deviceId);
  if (!device) return [];
  const currentParamValues = mockData.electricalParamValues || {};
  const seedParamValues = localMockData.electricalParamValues || {};
  const currentParams = currentParamValues[device.id];
  if (Array.isArray(currentParams) && currentParams.length) return clone(currentParams);
  if (Array.isArray(device.params) && device.params.length) return clone(device.params);
  return clone(seedParamValues[device.id] || []);
}

function listParamDevices(user) {
  if (!canViewParamLibrary("electrical", user)) return [];
  return (mockData.devices || []).filter((device) => !isDisabledRecord(device) && findProjectStrict(device.projectNo)).map((device) => {
    const params = getDeviceParams(device.id);
    const getParam = (name) => {
      const param = params.find((item) => item.name === name);
      return param || null;
    };
    const getParamValue = (name) => {
      const param = getParam(name);
      return param ? param.value : "-";
    };
    const airVolumeParam = getParam("前表冷风量");
    const project = findProjectStrict(device.projectNo);
    return {
      rowKey: `device-${device.id}`,
      id: device.id,
      deviceNo: device.deviceNo,
      projectNo: device.projectNo,
      project: project ? project.name : "",
      model: device.model,
      area: device.area,
      airVolume: `${airVolumeParam ? airVolumeParam.value : "-"} ${airVolumeParam && airVolumeParam.unit ? airVolumeParam.unit : ""}`.trim(),
      plc: getParamValue("PLC品牌"),
      points: `DI ${getParamValue("DI点数")} / DO ${getParamValue("DO点数")} / AI ${getParamValue("AI点数")}`
    };
  });
}

function searchParams(filters = {}, user) {
  const keyword = String(filters.keyword || "").toLowerCase();
  const paramKeyword = String(filters.paramKeyword || "").toLowerCase();
  const valueKeyword = String(filters.valueKeyword || "").toLowerCase();
  const remarkKeyword = String(filters.remarkKeyword || "").toLowerCase();
  const categoryFilter = String(filters.category || "").trim();
  const mode = filters.modeKey || filters.mode || "按设备查";
  const devices = listParamDevices(user);

  if (mode === "param" || mode === "按参数查") {
    if (!canViewParamLibrary("electrical", user)) return [];
    const rows = [];
    (mockData.devices || []).forEach((device) => {
      if (!device || isDisabledRecord(device)) return;
      const project = findProjectStrict(device.projectNo);
      if (!project) return;
      getDeviceParams(device.id).forEach((param) => {
        if (param.disabled) return;
        if (keyword) {
          const haystack = [param.name, param.value, param.category, device.deviceNo, project.name].join(" ").toLowerCase();
          if (haystack.indexOf(keyword) < 0) return;
        }
        if (paramKeyword && String(param.name || "").toLowerCase().indexOf(paramKeyword) < 0) return;
        if (valueKeyword && String(param.value || "").toLowerCase().indexOf(valueKeyword) < 0) return;
        if (remarkKeyword && String(param.remark || "").toLowerCase().indexOf(remarkKeyword) < 0) return;
        if (categoryFilter && param.category !== categoryFilter) return;
        rows.push({
          rowType: "param",
          id: device.id,
          rowKey: `${device.id}-${param.id || param.name}`,
          deviceNo: device.deviceNo,
          project: project.name,
          model: device.model,
          area: device.area,
          paramName: param.name,
          paramValue: param.value,
          paramUnit: param.unit || "",
          category: param.category,
          remark: param.remark || ""
        });
      });
    });
    return rows;
  }

  if (!keyword) return devices;
  return devices.filter((item) =>
    [item.deviceNo, item.project, item.model, item.area, item.airVolume, item.plc, item.points]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .indexOf(keyword) >= 0
  );
}
function listProcessOptions() {
  return uniqueValues(getDictionary("processes").map(normalizeProcessName))
    .filter((name) => !isDisabledProcessName(name));
}

function listDispatchDevices(projectNo) {
  if (!findProjectStrict(projectNo)) return [];
  return getDevicesByProject(projectNo).map((device) => device.deviceNo);
}

function getDepartmentProjectSubmitOptions(projectNo, user) {
  const currentUser = user || getCurrentUserForService() || {};
  if (!permissionService || !permissionService.isDepartmentManager(currentUser)) return [];
  const department = normalizeDepartmentName(currentUser.department || "");
  if (!department) return [];
  const project = findProjectStrict(projectNo);
  if (!project) return [];
  const processMap = {};
  getRawDevicesByProject(projectNo)
    .filter((device) => !isDisabledRecord(device))
    .forEach((device) => {
      getProcessesForDevice(device).forEach((process) => {
        const name = normalizeProcessName(process.name || "");
        if (!name || isDisabledProcessName(name)) return;
        const processDepartment = normalizeDepartmentName(process.department || getDefaultDepartmentForProcess(name));
        if (processDepartment !== department) return;
        if (!processMap[name]) {
          processMap[name] = {
            process: name,
            department,
            deviceCount: 0,
            unfinishedCount: 0
          };
        }
        processMap[name].deviceCount += 1;
        if (!isDoneStatus(process.status)) processMap[name].unfinishedCount += 1;
      });
  });
  return Object.keys(processMap).map((name) => processMap[name]);
}

function getProjectDepartmentDispatchDate(payload = {}) {
  const projectNo = String(payload.projectNo || "").trim();
  const processName = normalizeProcessName(payload.process || "");
  const department = normalizeDepartmentName(payload.department || "");
  if (!projectNo || !processName || !department) return "";
  const project = findProjectStrict(projectNo) || (localMockData.projects || []).find((item) => item.projectNo === projectNo);
  const projectOrderDate = normalizeDateText(project && project.adminOrderDate);
  if (projectOrderDate) return projectOrderDate;

  const dispatchRows = (mockData.dispatchTasks || []).concat(localMockData.dispatchTasks || []);
  const rows = dispatchRows
    .filter((item) => item.projectNo === projectNo &&
      normalizeProcessName(item.process || "") === processName &&
      normalizeDepartmentName(item.department || "") === department)
    .map((item) => normalizeDateText(item.dispatchedAt || item.dispatchDate || item.createdAt || item.createdDate))
    .filter(Boolean);
  if (rows[0]) return rows[0];

  const processDates = [];
  getRawDevicesByProject(projectNo).forEach((device) => {
    const process = getProcessesForDevice(device).find((item) => {
      const itemName = normalizeProcessName(item.name || "");
      const itemDepartment = normalizeDepartmentName(item.department || getDefaultDepartmentForProcess(itemName));
      return itemName === processName && itemDepartment === department;
    });
    const actualStart = normalizeDateText(process && process.actualStart);
    if (actualStart) processDates.push(actualStart);
  });
  if (processDates[0]) return processDates.sort()[0];

  (localMockData.devices || [])
    .filter((device) => device.projectNo === projectNo)
    .forEach((device) => {
      ((localMockData.processMap && localMockData.processMap[device.id]) || []).forEach((process) => {
        const itemName = normalizeProcessName(process.name || "");
        const itemDepartment = normalizeDepartmentName(process.department || getDefaultDepartmentForProcess(itemName));
        if (itemName === processName && itemDepartment === department) {
          const actualStart = normalizeDateText(process.actualStart);
          if (actualStart) processDates.push(actualStart);
        }
      });
    });
  return processDates.sort()[0] || "";
}

function getDeviceProcessAssignmentDate(payload = {}) {
  const processName = normalizeProcessName(payload.process || (payload.task && payload.task.process) || "");
  const deviceId = payload.deviceId || getDeviceIdFromTask(payload.task || {});
  const device = deviceId ? findDeviceStrict(deviceId) : null;
  const deviceNo = device ? device.deviceNo : "";
  const taskRowKey = payload.taskRowKey || (payload.task && payload.task.rowKey) || "";
  const owner = payload.owner || (payload.task && payload.task.owner) || "";
  const taskRows = (mockData.tasks || []).concat(localMockData.tasks || []);
  const rows = taskRows.map((task, index) => ({ task, rowKey: getTaskRowKey(task, index) }))
    .filter(({ task, rowKey }) => {
      if (taskRowKey && rowKey === taskRowKey) return true;
      if (processName && normalizeProcessName(task.process || "") !== processName) return false;
      if (deviceNo && String(task.device || "").indexOf(deviceNo) < 0) return false;
      if (owner && task.owner && task.owner !== owner) return false;
      return true;
    })
    .map(({ task }) => normalizeDateText(task.assignedAt || task.assignDate || task.createdAt || task.createdDate))
    .filter(Boolean);
  if (rows[0]) return rows[0];

  if (device && processName) {
    const process = getProcessesForDevice(device)
      .find((item) => normalizeProcessName(item.name || "") === processName);
    const actualStart = normalizeDateText(process && process.actualStart);
    if (actualStart) return actualStart;
    const seedProcess = ((localMockData.processMap && localMockData.processMap[device.id]) || [])
      .find((item) => normalizeProcessName(item.name || "") === processName);
    return normalizeDateText(seedProcess && seedProcess.actualStart);
  }
  return "";
}

function normalizeDeviceScope(value) {
  return String(value || "").replace(/\s*第.+?台/g, "").trim();
}

function getProjectDispatchPreview(projectNo) {
  const rawProject = findProjectStrict(projectNo);
  if (!rawProject) {
    return {
      ok: false,
      message: "项目不存在，无法派单",
      project: {},
      devices: [],
      processes: listProcessOptions(),
      departments: listDepartments().map((item) => item.name),
      pendingDispatches: []
    };
  }
  const project = getProject(projectNo);
  const pendingDispatches = (mockData.dispatchTasks || [])
    .filter((item) => item.projectNo === project.projectNo)
    .filter((item) => !isDisabledProcessName(item.process || ""))
    .map((item, index) => ({
      ...item,
      process: normalizeProcessName(item.process || ""),
      department: normalizeDepartmentName(item.department || ""),
      device: normalizeDeviceScope(item.device),
      rowKey: item.rowKey || [item.projectNo, item.device, item.process, item.department, index].join("-")
    }));
  return {
    ok: true,
    project: {
      projectNo: project.projectNo,
      projectName: project.name
    },
    devices: listDispatchDevices(project.projectNo),
    processes: listProcessOptions(),
    departments: listDepartments().map((item) => item.name),
    pendingDispatches: clone(pendingDispatches)
  };
}

function getUsersByDepartmentMap() {
  return listDepartments().reduce((result, department) => {
    const users = listUsers({ department: department.name });
    result[department.name] = users.length
      ? users.map((user) => `${user.name}｜${user.department}`)
      : listUsers().slice(0, 1).map((user) => `${user.name}｜${department.name}`);
    return result;
  }, {});
}

function getQbCreateOptions(projectNo) {
  const rawProject = findProjectStrict(projectNo);
  const departments = listDepartments().map((item) => item.name);
  const usersByDepartment = getUsersByDepartmentMap();
  if (!rawProject) {
    return {
      ok: false,
      message: "项目不存在，无法创建QB",
      project: {},
      categories: getDictionary("qbCategories"),
      raisedProcesses: listProcessOptions(),
      departments,
      usersByDepartment,
      availableUsers: [],
      devices: [],
      defaults: {
        category: getDictionary("qbCategories")[0] || "",
        raisedProcess: listProcessOptions()[0] || "",
        sourceDepartment: departments[0] || "",
        responsibleDepartment: departments[0] || "",
        currentOwner: ""
      }
    };
  }
  const project = getProject(projectNo);
  const responsibleDepartment = departments[0] || "";
  const availableUsers = usersByDepartment[responsibleDepartment] || [];

  return {
    ok: true,
    project: {
      projectNo: project.projectNo,
      projectName: project.name,
      productLine: "除湿机"
    },
    categories: getDictionary("qbCategories"),
    raisedProcesses: listProcessOptions(),
    departments,
    usersByDepartment,
    availableUsers,
    devices: getDevicesByProject(project.projectNo).map((device, index) => ({
      no: device.deviceNo,
      checked: index < 2
    })),
    defaults: {
      category: getDictionary("qbCategories")[0] || "",
      raisedProcess: "电气设计",
      sourceDepartment: "电气设计部",
      responsibleDepartment,
      currentOwner: availableUsers[0] || ""
    }
  };
}

function getQbTransferOptions() {
  return {
    users: listUsers().map((user) => `${user.name}｜${user.department}`)
  };
}

function getUserEditOptions() {
  return {
    departments: listDepartments().map((item) => item.name),
    roles: getDictionary("userRoles"),
    statuses: getDictionary("recordStatuses")
  };
}

function getDepartmentEditOptions() {
  return {
    users: listUsers().map((item) => item.name),
    statuses: getDictionary("recordStatuses")
  };
}

function getDepartmentDispatchPreview(rowKey) {
  const decoratedTasks = listDecoratedTasks();
  const task = rowKey && decoratedTasks.find((item) => item.rowKey === rowKey);
  if (!task) {
    return {
      ok: false,
      message: "Task is missing or invalid.",
      task: {},
      users: [],
      selectedUser: ""
    };
  }
  const department = normalizeDepartmentName(task.department || "结构设计部");
  const users = listUsers({ department })
    .filter((user) => !permissionService ||
      (!permissionService.isDepartmentManager(user) &&
        !permissionService.isProjectAdmin(user) &&
        !permissionService.isSuperAdmin(user)))
    .map((user) => `${user.name}｜${user.department}`);
  return {
    ok: true,
    task: {
      rowKey: task.rowKey || "",
      project: task.project || "",
      device: task.device || "",
      process: task.process || "",
      department,
      due: task.dueDate || ""
    },
    users,
    selectedUser: users[0] || ""
  };
}

function getNameFromDisplay(value) {
  return String(value || "").split(/[｜|锝]/)[0];
}

function getDeviceIdFromTask(task = {}) {
  if (task.deviceId) return task.deviceId;
  const deviceText = String(task.device || "");
  const device = (mockData.devices || []).find((item) => deviceText.indexOf(item.deviceNo) >= 0);
  return device && device.id;
}

function updateDeviceProgress(deviceId) {
  const processes = (mockData.processMap && mockData.processMap[deviceId]) || [];
  const device = (mockData.devices || []).find((item) => item.id === deviceId);
  if (!device || !processes.length) return;
  const doneCount = processes.filter((item) => item.status === "已完成").length;
  const computedProgress = Math.round((doneCount / processes.length) * 100);
  device.progress = Math.max(Number(device.progress || 0), computedProgress);
}

function updateTaskProgress(payload = {}) {
  const processName = normalizeProcessName(payload.process || (payload.task && payload.task.process));
  const task = (mockData.tasks || []).find((item, index) => {
    const rowKey = getTaskRowKey(item, index);
    if (payload.taskRowKey && rowKey === payload.taskRowKey) return true;
    if (payload.task && payload.task.rowKey && rowKey === payload.task.rowKey) return true;
    return processName &&
      normalizeProcessName(item.process || "") === processName &&
      (!payload.task || !payload.task.device || item.device === payload.task.device) &&
      (!payload.task || !payload.task.project || item.project === payload.task.project);
  });

  if (!task) return null;
  task.status = payload.status || task.status;
  task.actualStart = payload.actualStartDate || task.actualStart || "";
  task.actualFinish = payload.actualFinishDate || task.actualFinish || "";
  task.quantity = payload.quantity || task.quantity || "";
  task.remark = payload.remark || task.remark || "";
  task.attachments = Array.isArray(payload.attachments) ? clone(payload.attachments) : (task.attachments || []);
  return task;
}

function submitProgress(payload = {}) {
  const currentUser = payload.currentUser || getCurrentUserForService() || {};
  const isDepartmentManagerUser = permissionService && permissionService.isDepartmentManager(currentUser);
  const isProjectAdminUser = permissionService && permissionService.canDispatchProject(currentUser);
  const normalizedPayload = Object.assign({}, payload);
  if (!isDepartmentManagerUser && !isProjectAdminUser) {
    normalizedPayload.status = "已完成";
    normalizedPayload.actualFinishDate = normalizedPayload.actualFinishDate || getTodayString();
  }
  const deviceId = payload.deviceId || getDeviceIdFromTask(payload.task);
  const processName = normalizeProcessName(payload.process || (payload.task && payload.task.process));
  if (!deviceId) {
    return { ok: false, message: "缺少设备标识，无法提交进度" };
  }
  const device = findDeviceStrict(deviceId);
  if (!device) {
    return { ok: false, message: "设备不存在，无法提交进度" };
  }
  if (!processName) {
    return { ok: false, message: "缺少工序信息，无法提交进度" };
  }
  if (isDepartmentManagerUser && !payload.allowDepartmentDeviceSubmit) {
    return { ok: false, message: "部门管理员请在项目详情按项目提交本部门进度。" };
  }
  const processList = ensureWritableProcessesForDevice(device);
  const process = processList && processList.find((item) => !processName || normalizeProcessName(item.name || "") === processName);

  if (!process) {
    const task = updateTaskProgress({ ...normalizedPayload, process: processName });
    if (task) {
      recordOperation({
        module: "task",
        action: "submit-progress",
        targetType: "task",
        targetId: payload.taskRowKey || (payload.task && payload.task.rowKey) || "",
        targetName: processName || "",
        summary: `提交任务进度 ${processName || ""}`,
        detail: {
          status: normalizedPayload.status || "",
          deviceId
        }
      });
      return {
        ok: true,
        process: null,
        task: clone(task),
        device: clone(decorateDeviceSummary(device)),
        message: "已更新任务，未匹配到设备工序"
      };
    }
    return { ok: false, message: "未找到对应工序" };
  }

  process.status = normalizedPayload.status || process.status;
  process.actualStart = normalizedPayload.actualStartDate || process.actualStart;
  process.actualFinish = normalizedPayload.actualFinishDate || process.actualFinish;
  process.quantity = normalizedPayload.quantity || process.quantity || "";
  process.remark = normalizedPayload.remark || process.remark || "";
  process.attachments = Array.isArray(normalizedPayload.attachments) ? clone(normalizedPayload.attachments) : (process.attachments || []);
  const task = updateTaskProgress({ ...normalizedPayload, process: processName });
  updateDeviceProgress(deviceId);

  recordOperation({
    module: "task",
    action: "submit-progress",
    targetType: "process",
    targetId: deviceId,
    targetName: processName || "",
    summary: `提交工序进度 ${processName || ""}`,
    detail: {
      status: normalizedPayload.status || "",
      actualStartDate: normalizedPayload.actualStartDate || "",
      actualFinishDate: normalizedPayload.actualFinishDate || ""
    }
  });

  return { ok: true, process: clone(process), task: clone(task), device: clone(decorateDeviceSummary(device)) };
}

function getProjectDepartmentProgressPreview(payload = {}) {
  const currentUser = payload.currentUser || getCurrentUserForService() || {};
  if (!permissionService || !permissionService.isDepartmentManager(currentUser)) {
    return { ok: false, message: "只有部门管理员可以查看本部门项目进度预览。" };
  }
  const projectNo = String(payload.projectNo || "").trim();
  const project = findProjectStrict(projectNo);
  if (!project) return { ok: false, message: "项目不存在，无法预览进度。" };
  const processName = normalizeProcessName(payload.process || "");
  if (!processName) return { ok: false, message: "缺少工序信息。" };
  const department = normalizeDepartmentName(payload.department || currentUser.department || "");
  if (!department || department !== currentUser.department) {
    return { ok: false, message: "部门管理员只能查看本部门项目进度。" };
  }
  const defaultDepartment = normalizeDepartmentName(getDefaultDepartmentForProcess(processName));
  if (defaultDepartment && defaultDepartment !== department) {
    return { ok: false, message: "该工序不属于当前部门。" };
  }

  const rows = [];
  (mockData.devices || [])
    .filter((device) => device.projectNo === projectNo && !isDisabledRecord(device))
    .forEach((device) => {
      const process = getProcessesForDevice(device)
        .find((item) => normalizeProcessName(item.name || "") === processName);
      if (!process) return;
      const processDepartment = normalizeDepartmentName(process.department || getDefaultDepartmentForProcess(process.name || ""));
      if (processDepartment !== department) return;
      rows.push({
        deviceId: device.id,
        deviceNo: device.deviceNo || device.id,
        owner: process.owner || "-",
        due: process.due || process.dueDate || "",
        dueText: process.due || process.dueDate || "-",
        status: process.status || "",
        done: isDoneStatus(process.status)
      });
    });

  return {
    ok: true,
    project: clone(project),
    process: processName,
    department,
    rows: clone(rows),
    unfinished: clone(rows.filter((row) => !row.done))
  };
}

function submitProjectDepartmentProgress(payload = {}) {
  const currentUser = payload.currentUser || getCurrentUserForService() || {};
  if (!permissionService || !permissionService.isDepartmentManager(currentUser)) {
    return { ok: false, message: "只有部门管理员可以按项目提交本部门进度。" };
  }
  const projectNo = String(payload.projectNo || "").trim();
  const project = findProjectStrict(projectNo);
  if (!project) return { ok: false, message: "项目不存在，无法提交进度。" };
  const processName = normalizeProcessName(payload.process || "");
  if (!processName) return { ok: false, message: "缺少工序信息。" };
  const department = normalizeDepartmentName(payload.department || currentUser.department || "");
  if (!department || department !== currentUser.department) {
    return { ok: false, message: "部门管理员只能提交本部门项目进度。" };
  }
  const defaultDepartment = normalizeDepartmentName(getDefaultDepartmentForProcess(processName));
  if (defaultDepartment && defaultDepartment !== department) {
    return { ok: false, message: "该工序不属于当前部门。" };
  }
  const preview = getProjectDepartmentProgressPreview({
    currentUser,
    projectNo,
    department,
    process: processName
  });
  if (!preview.ok) return preview;
  if ((preview.unfinished || []).length) {
    return {
      ok: false,
      code: "HAS_UNFINISHED_DEVICES",
      message: "存在未完成设备，请等待每台设备都提交完成后再提交项目进度。",
      unfinished: clone(preview.unfinished)
    };
  }

  const status = payload.status || "已完成";
  const actualFinishDate = payload.actualFinishDate || getTodayString();
  const actualStartDate = payload.actualStartDate || "";
  const devices = (mockData.devices || []).filter((device) => device.projectNo === projectNo && !isDisabledRecord(device));
  const updated = [];
  devices.forEach((device) => {
    const processes = ensureWritableProcessesForDevice(device);
    const process = processes.find((item) => normalizeProcessName(item.name || "") === processName);
    if (!process) return;
    const processDepartment = normalizeDepartmentName(process.department || getDefaultDepartmentForProcess(process.name || ""));
    if (processDepartment !== department) return;
    process.department = processDepartment;
    process.status = status;
    process.actualStart = actualStartDate || process.actualStart || "";
    process.actualFinish = actualFinishDate;
    process.quantity = payload.quantity || process.quantity || "";
    process.remark = payload.remark || process.remark || "";
    process.attachments = Array.isArray(payload.attachments) ? clone(payload.attachments) : (process.attachments || []);
    updateTaskProgress({
      task: {
        project: `${project.projectNo} ${project.name || ""}`.trim(),
        device: device.deviceNo,
        process: processName
      },
      process: processName,
      status,
      actualStartDate: process.actualStart,
      actualFinishDate,
      quantity: payload.quantity,
      remark: payload.remark,
      attachments: payload.attachments
    });
    updateDeviceProgress(device.id);
    updated.push({ deviceId: device.id, deviceNo: device.deviceNo, process: clone(process) });
  });

  if (!updated.length) {
    return { ok: false, message: "未找到本部门可提交的项目工序。" };
  }

  recordOperation({
    module: "task",
    action: "project-department-submit",
    targetType: "project",
    targetId: project.projectNo,
    targetName: project.name,
    summary: `部门管理员提交项目进度 ${project.projectNo} ${processName}`,
    detail: {
      department,
      process: processName,
      status,
      actualStartDate,
      actualFinishDate,
      deviceCount: updated.length
    }
  });

  return { ok: true, project: getProject(projectNo), updated, count: updated.length };
}

function createProjectDispatch(payload = {}) {
  const currentUser = payload.currentUser || getCurrentUserForService();
  if (permissionService && !permissionService.canDispatchProject(currentUser)) {
    return { ok: false, message: "只有进度管理员可以派单到部门。" };
  }
  const projectNo = String(payload.projectNo || "").trim();
  if (!findProjectStrict(projectNo)) {
    return { ok: false, message: "项目不存在，无法派单" };
  }
  const project = getProject(projectNo);
  const deviceScopes = (Array.isArray(payload.devices) && payload.devices.length ? payload.devices : [payload.device || "全部设备"])
    .map(normalizeDeviceScope)
    .filter(Boolean);
  const processName = normalizeProcessName(payload.process || "");
  if (isDisabledProcessName(processName)) {
    return { ok: false, message: "该工序已停用，无法派单" };
  }
  const departmentName = normalizeDepartmentName(payload.department || getDefaultDepartmentForProcess(processName) || "");
  const dispatchedAt = normalizeDateText(payload.dispatchedAt || payload.dispatchDate) || getTodayString();
  const dispatches = [];
  const tasks = [];

  deviceScopes.forEach((deviceScope, index) => {
    const item = {
      rowKey: `dispatch-${Date.now()}-${index}`,
      projectNo: project.projectNo,
      process: processName,
      department: departmentName,
      device: deviceScope,
      due: payload.plannedDueDate || payload.due || "",
      dispatchedAt,
      status: "已派部门",
      remark: payload.remark || ""
    };
    mockData.dispatchTasks.unshift(item);
    dispatches.push(item);

    const taskKey = [
      "dispatch",
      item.projectNo,
      item.device,
      item.process,
      item.department
    ].join("|");
    let task = (mockData.tasks || []).find((record) => record.importKey === taskKey);
    if (!task) {
      task = {
        importKey: taskKey,
        type: "待分配",
        project: `${project.projectNo} ${project.name}`,
        device: item.device,
        process: item.process,
        department: item.department,
        dueDate: item.due,
        dispatchedAt,
        status: "待部门派单",
        remark: item.remark
      };
      mockData.tasks.unshift(task);
    } else {
      task.dueDate = item.due || task.dueDate;
      task.status = "待部门派单";
      task.dispatchedAt = task.dispatchedAt || dispatchedAt;
      task.remark = item.remark || task.remark;
    }
    tasks.push(decorateTask(task, index));
  });

  recordOperation({
    module: "dispatch",
    action: "project-dispatch",
    targetType: "project",
    targetId: project.projectNo,
    targetName: project.name,
    summary: `项目派单 ${project.projectNo}`,
    detail: {
      process: payload.process || "",
      department: payload.department || "",
      dispatchedAt,
      count: dispatches.length
    }
  });

  return {
    ok: true,
    dispatch: clone(dispatches[0]),
    dispatches: clone(dispatches),
    task: clone(tasks[0]),
    tasks: clone(tasks)
  };
}

function assignDepartmentTask(payload = {}) {
  const currentUser = payload.currentUser || getCurrentUserForService();
  if (permissionService && !permissionService.canDispatchDepartment(currentUser)) {
    return { ok: false, message: "只有部门管理员可以派单到同部门员工。" };
  }
  const assignee = getNameFromDisplay(payload.assignee || payload.selectedUser);
  if (!assignee) {
    return { ok: false, message: "请选择具体负责人" };
  }
  const assigneeUser = (mockData.users || []).find((user) => user.name === assignee || user.id === assignee);
  if (currentUser && assigneeUser && currentUser.department && assigneeUser.department !== currentUser.department) {
    return { ok: false, message: "部门管理员只能派给同部门员工。" };
  }
  if (permissionService && assigneeUser && (
    permissionService.isDepartmentManager(assigneeUser) ||
    permissionService.isProjectAdmin(assigneeUser) ||
    permissionService.isSuperAdmin(assigneeUser)
  )) {
    return { ok: false, message: "部门管理员只能派给普通员工。" };
  }
  const taskPayload = payload.task || {};
  let task = (mockData.tasks || []).find((record, index) => {
    const rowKey = getTaskRowKey(record, index);
    if (taskPayload.rowKey && rowKey === taskPayload.rowKey) return true;
    return record.project === taskPayload.project &&
      record.device === taskPayload.device &&
      record.process === taskPayload.process &&
      record.department === taskPayload.department;
  });

  if (!task) {
    task = {
      type: "生产任务",
      project: taskPayload.project,
      device: taskPayload.device,
      process: taskPayload.process,
      department: taskPayload.department,
      dueDate: taskPayload.due
    };
    mockData.tasks.unshift(task);
  }

  task.importKey = task.importKey || taskPayload.rowKey || getTaskRowKey(task, 0);
  task.type = "生产任务";
  task.owner = assignee;
  task.status = "进行中";
  task.assignedAt = normalizeDateText(payload.assignedAt || payload.assignDate) || task.assignedAt || getTodayString();
  task.remark = payload.remark || task.remark || "";
  task.dueDate = taskPayload.due || task.dueDate;

  recordOperation({
    module: "dispatch",
    action: "department-assign",
    targetType: "task",
    targetId: task.importKey || "",
    targetName: task.process || "",
    summary: `部门派单给 ${assignee}`,
    detail: {
      project: task.project || "",
      device: task.device || "",
      process: task.process || "",
      assignedAt: task.assignedAt || ""
    }
  });

  if (notificationService) { notificationService.notifyTaskAssigned(task, payload.assignedBy || ''); }
  return { ok: true, task: clone(decorateTask(task, 0)) };
}

function findQbTask(qbNo) {
  return (mockData.tasks || []).find((item) => item.qbNo === qbNo);
}

function upsertQbTask(qb = {}) {
  if (!qb.qbNo) return null;
  const projectNo = String(qb.projectNo || "").trim();
  const project = findProjectStrict(projectNo);
  if (!project) return { ok: false, message: "QB project is missing or invalid." };
  let task = findQbTask(qb.qbNo);
  if (!task) {
    task = {
      type: "QB待处理",
      project: `${project.projectNo} ${project.name}`,
      qbNo: qb.qbNo,
      title: qb.title || "",
      status: qb.status || "处理中"
    };
    mockData.tasks.unshift(task);
  }

  task.project = `${project.projectNo} ${project.name}`;
  task.title = qb.title || task.title || "";
  task.status = qb.status || task.status || "处理中";
  task.owner = qb.currentOwner || qb.owner || task.owner || "";
  return task;
}

function getQbIntegrationInfo() {
  return {
    mode: "readonly",
    source: "dingtalk-openapi-planned",
    writable: false,
    message: QB_READONLY_MESSAGE
  };
}

function buildQbReadonlyResult() {
  return {
    ok: false,
    readonly: true,
    mode: "readonly",
    message: QB_READONLY_MESSAGE
  };
}

function normalizeDingTalkQbRecord(record = {}) {
  const qbNo = String(record.qbNo || record.serialNo || record.instanceId || "").trim();
  const projectNo = String(record.projectNo || record.project_code || "").trim();
  return {
    qbNo,
    projectNo,
    title: record.title || record.description || "",
    description: record.description || record.title || "",
    process: record.process || record.raisedProcess || "",
    owner: record.currentOwner || record.owner || "",
    currentOwner: record.currentOwner || record.owner || "",
    status: record.status || "处理中",
    occurredAt: record.occurredAt || record.createdAt || "",
    category: record.category || "",
    productLine: record.productLine || "",
    raisedProcess: record.raisedProcess || record.process || "",
    quantity: record.quantity || "",
    department: record.department || "",
    responsibleDepartment: record.responsibleDepartment || "",
    initiator: record.initiator || record.creatorName || "",
    reason: record.reason || "",
    temporaryAction: record.temporaryAction || "",
    longTermAction: record.longTermAction || "",
    linkedDevices: Array.isArray(record.linkedDevices) ? record.linkedDevices.slice() : [],
    logs: Array.isArray(record.logs) ? record.logs.slice() : [],
    dingTalk: {
      instanceId: record.instanceId || "",
      processCode: record.processCode || "",
      businessId: record.businessId || "",
      url: record.url || "",
      updatedAt: record.updatedAt || "",
      raw: record.raw || record
    }
  };
}

function upsertQbFromDingTalk(record = {}) {
  const normalized = normalizeDingTalkQbRecord(record);
  if (!normalized.qbNo) return { ok: false, message: "缺少钉钉 QB 编号或实例 ID。" };
  if (normalized.projectNo && !findProjectStrict(normalized.projectNo)) {
    return { ok: false, message: "钉钉 QB 对应项目不存在。", qbNo: normalized.qbNo };
  }
  const project = normalized.projectNo ? getProject(normalized.projectNo) : {};
  const qb = {
    qbNo: normalized.qbNo,
    projectNo: normalized.projectNo,
    title: normalized.title,
    process: normalized.process,
    owner: normalized.owner,
    currentOwner: normalized.currentOwner,
    status: normalized.status,
    occurredAt: normalized.occurredAt,
    source: "dingtalk",
    dingTalk: normalized.dingTalk
  };
  const detail = {
    qb: Object.assign({}, qb, {
      projectName: project.name || "",
      category: normalized.category,
      productLine: normalized.productLine,
      raisedProcess: normalized.raisedProcess,
      quantity: normalized.quantity,
      description: normalized.description,
      reason: normalized.reason,
      temporaryAction: normalized.temporaryAction,
      longTermAction: normalized.longTermAction,
      department: normalized.department,
      responsibleDepartment: normalized.responsibleDepartment,
      initiator: normalized.initiator
    }),
    linkedDevices: normalized.linkedDevices,
    logs: normalized.logs
  };
  const list = mockData.qbList || (mockData.qbList = []);
  const existingIndex = list.findIndex((item) => item.qbNo === qb.qbNo);
  if (existingIndex >= 0) list[existingIndex] = Object.assign({}, list[existingIndex], qb);
  else list.unshift(qb);
  if (!mockData.qbDetails) mockData.qbDetails = {};
  mockData.qbDetails[qb.qbNo] = detail;
  if (normalized.projectNo) upsertQbTask(detail.qb);
  recordOperation({
    module: "qb",
    action: "dingtalk-sync",
    targetType: "qb",
    targetId: qb.qbNo,
    targetName: detail.qb.description || detail.qb.title || "",
    summary: `钉钉同步 QB ${qb.qbNo}`,
    detail: { instanceId: normalized.dingTalk.instanceId, businessId: normalized.dingTalk.businessId }
  });
  return { ok: true, qb: clone(detail.qb), detail: clone(detail) };
}

function syncQbFromDingTalk(records = []) {
  if (!Array.isArray(records)) return { ok: false, message: "钉钉同步数据必须是数组。" };
  const results = records.map((record) => upsertQbFromDingTalk(record));
  return {
    ok: results.every((item) => item.ok),
    total: records.length,
    success: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok),
    results
  };
}

function createQb(payload = {}) {
  return buildQbReadonlyResult();
  const qbNo = payload.qbNo || `QB-${Date.now()}`;
  const owner = getNameFromDisplay(payload.currentOwner);
  const projectNo = String(payload.projectNo || "").trim();
  if (!findProjectStrict(projectNo)) {
    return { ok: false, message: "项目不存在，无法创建QB" };
  }
  const project = getProject(projectNo);
  const qb = {
    qbNo,
    projectNo: project.projectNo,
    title: payload.description || "新建QB",
    process: payload.raisedProcess || "",
    owner,
    status: "处理中",
    occurredAt: payload.occurredAt || ""
  };
  const detail = {
    qb: {
      ...qb,
      projectName: project.name,
      category: payload.category || "",
      productLine: "除湿机",
      raisedProcess: payload.raisedProcess || "",
      quantity: payload.quantity || "1",
      description: payload.description || "",
      reason: payload.reason || "",
    temporaryAction: payload.temporaryAction || "",
    longTermAction: payload.longTermAction || "",
    attachments: Array.isArray(payload.attachments) ? clone(payload.attachments) : [],
    department: payload.sourceDepartment || "",
      responsibleDepartment: payload.responsibleDepartment || "",
      initiator: payload.initiator || "",
      currentOwner: owner
    },
    linkedDevices: payload.linkedDevices || [],
    logs: [
      {
        time: payload.occurredAt || "",
        user: payload.initiator || "",
        rowKey: `${qbNo}-created`,
        content: "创建QB，并指定当前负责人处理。"
      }
    ]
  };

  mockData.qbList.unshift(qb);
  mockData.qbDetails[qbNo] = detail;
  const task = upsertQbTask(detail.qb);
  if (!task || task.ok === false) {
    return { ok: false, message: (task && task.message) || "QB task sync failed." };
  }
  recordOperation({
    module: "qb",
    action: "create",
    targetType: "qb",
    targetId: qbNo,
    targetName: detail.qb.description || detail.qb.title || "",
    summary: `创建QB ${qbNo}`,
    detail: {
      projectNo: project.projectNo,
      owner
    }
  });
  if (notificationService) { notificationService.notifyTaskAssigned({ owner: owner, name: "QB: " + (detail.qb.description || detail.qb.title || qbNo) }, payload.raisedBy || ''); }
  return { ok: true, qb: clone(detail.qb), task: clone(decorateTask(task, 0)) };
}

function transferQb(qbNo, payload = {}) {
  return buildQbReadonlyResult();
}

function appendQbProgress(qbNo, payload = {}) {
  return buildQbReadonlyResult();
  const detail = mockData.qbDetails && mockData.qbDetails[qbNo];
  if (!detail) return { ok: false, message: "未找到QB" };

  if (!findProjectStrict(detail.qb && detail.qb.projectNo)) {
    return { ok: false, message: "QB project is missing or invalid." };
  }

  const log = {
    time: payload.time || "",
    user: payload.user || "",
    rowKey: `${qbNo}-progress-${Date.now()}`,
    content: payload.content || ""
  };
  detail.logs.unshift(log);
  const task = upsertQbTask(detail.qb);
  if (!task || task.ok === false) {
    return { ok: false, message: (task && task.message) || "QB task sync failed." };
  }
  recordOperation({
    module: "qb",
    action: "progress",
    targetType: "qb",
    targetId: qbNo,
    targetName: detail.qb.description || detail.qb.title || "",
    summary: `提交QB进展 ${qbNo}`
  });
  if (notificationService) { notificationService.notifyQbProgress(detail.qb, payload.commentBy || ''); }
  return { ok: true, log: clone(log), logs: clone(detail.logs) };
}

function addQbAssignee(qbNo, payload = {}) {
  return buildQbReadonlyResult();
  const detail = mockData.qbDetails && mockData.qbDetails[qbNo];
  if (!detail) return { ok: false, message: "未找到QB" };
  const name = String(payload.name || "").trim();
  if (!name) return { ok: false, message: "请指定协作人" };

  const qb = detail.qb;
  if (!Array.isArray(qb.assignees)) qb.assignees = [];
  if (qb.assignees.some((a) => a.name === name)) return { ok: false, message: name + " 已在协作列表中" };

  qb.assignees.push({
    name,
    status: "待处理",
    joinedAt: payload.joinedAt || new Date().toISOString()
  });

  detail.logs.unshift({
    time: new Date().toISOString(),
    user: payload.operator || "",
    rowKey: qbNo + "-assignee-" + Date.now(),
    content: "添加协作人 " + name
  });

  recordOperation({
    module: "qb",
    action: "addAssignee",
    targetType: "qb",
    targetId: qbNo,
    targetName: qb.description || qb.title || "",
    summary: "添加QB协作人 " + name,
    detail: { assignee: name }
  });

  return { ok: true, qb: clone(qb), logs: clone(detail.logs) };
}

function updateQbAssigneeStatus(qbNo, name, newStatus) {
  return buildQbReadonlyResult();
  const detail = mockData.qbDetails && mockData.qbDetails[qbNo];
  if (!detail) return { ok: false, message: "未找到QB" };
  const qb = detail.qb;
  if (!Array.isArray(qb.assignees)) qb.assignees = [];
  const assignee = qb.assignees.find((a) => a.name === name);
  if (!assignee) return { ok: false, message: "协作人 " + name + " 不存在" };
  assignee.status = newStatus;
  return { ok: true, qb: clone(qb) };
}

function removeQbAssignee(qbNo, name) {
  return buildQbReadonlyResult();
  const detail = mockData.qbDetails && mockData.qbDetails[qbNo];
  if (!detail) return { ok: false, message: "未找到QB" };
  const qb = detail.qb;
  if (!Array.isArray(qb.assignees)) qb.assignees = [];
  const idx2 = qb.assignees.findIndex((a) => a.name === name);
  if (idx2 < 0) return { ok: false, message: "协作人 " + name + " 不存在" };
  qb.assignees.splice(idx2, 1);

  detail.logs.unshift({
    time: new Date().toISOString(),
    user: "",
    rowKey: qbNo + "-removeAssignee-" + Date.now(),
    content: "移除协作人 " + name
  });

  return { ok: true, qb: clone(qb), logs: clone(detail.logs) };
}

function closeQb(qbNo, payload = {}) {
  return buildQbReadonlyResult();
  const detail = mockData.qbDetails && mockData.qbDetails[qbNo];
  if (detail && !findProjectStrict(detail.qb && detail.qb.projectNo)) {
    return { ok: false, message: "QB project is missing or invalid." };
  }
  if (!detail) return { ok: false, message: "未找到QB" };

  detail.qb.status = "已关闭";
  detail.logs.unshift({
    time: payload.time || "",
    user: payload.user || "",
    rowKey: `${qbNo}-close-${Date.now()}`,
    content: "结案确认。"
  });

  const qb = (mockData.qbList || []).find((item) => item.qbNo === qbNo);
  if (qb) qb.status = "已关闭";
  const task = upsertQbTask(detail.qb);
  if (!task || task.ok === false) {
    return { ok: false, message: (task && task.message) || "QB task sync failed." };
  }
  if (task) {
    task.status = "已关闭";
    task.closed = true;
  }
  recordOperation({
    module: "qb",
    action: "close",
    targetType: "qb",
    targetId: qbNo,
    targetName: detail.qb.description || detail.qb.title || "",
    summary: `关闭QB ${qbNo}`
  });
  if (notificationService) { notificationService.notifyQbClosed(detail.qb, payload.closedBy || ''); }
  return { ok: true, qb: clone(detail.qb), logs: clone(detail.logs) };
}

function moveParamCategory(deviceId, paramId, newCategory) {
  const device = findDeviceStrict(deviceId);
  if (!device) return { ok: false, message: "Device is missing or invalid." };
  if (!paramId) return { ok: false, message: "Parameter id is missing." };
  if (!newCategory) return { ok: false, message: "Target category is missing." };

  const params = mockData.electricalParamValues[device.id] || [];
  const param = params.find((item) => item.id === paramId);
  if (!param) return { ok: false, message: "未找到参数" };

  const oldCategory = param.category;
  if (oldCategory === newCategory) return { ok: false, message: "参数已在目标分组中" };

  param.category = newCategory;
  const targetMaxSort = params.filter((item) => item.category === newCategory).reduce((max, item) => Math.max(max, item.sort || 0), 0);
  param.sort = targetMaxSort + 1;

  recordOperation({
    module: "param",
    action: "moveCategory",
    targetType: "param",
    targetId: param.id,
    targetName: param.name,
    summary: `移动参数 ${param.name} 从 ${oldCategory} 到 ${newCategory}`,
    detail: {
      deviceId: device.id,
      diff: { category: { old: oldCategory, new: newCategory } }
    }
  });
  return { ok: true, param: clone(param) };
}


function saveParamOrder(deviceId, params = []) {
  const device = findDeviceStrict(deviceId);
  if (!device) {
    return { ok: false, message: "Device is missing or invalid." };
  }
  const paramValues = mockData.electricalParamValues;
  paramValues[device.id] = params.map((item, index) => ({
    ...item,
    sort: index + 1
  }));
  recordOperation({
    module: "param",
    action: "sort",
    targetType: "device",
    targetId: device.id,
    targetName: device.deviceNo,
    summary: `保存参数排序 ${device.deviceNo}`,
    detail: { count: params.length }
  });
  return { ok: true, params: clone(paramValues[device.id]) };
}

function saveUser(payload = {}) {
  const users = mockData.users || [];
  const existing = payload.id && users.find((item) => item.id === payload.id);
  const user = {
    id: payload.id || `u${users.length + 1}`,
    name: payload.name || "",
    phone: payload.phone || "",
    department: payload.department || "",
    role: payload.role || "",
    roleLabel: payload.roleLabel || payload.role || "",
    isManager: !!payload.isManager,
    status: payload.status || "启用"
  };

  if (existing) {
    const before = clone(existing);
    Object.assign(existing, user);
    recordOperation({
      module: "user",
      action: "update",
      targetType: "user",
      targetId: user.id,
      targetName: user.name,
      summary: `更新用户 ${user.name}`
    });
    return { ok: true, user: clone(existing) };
  }

  users.unshift(user);
  recordOperation({
    module: "user",
    action: "create",
    targetType: "user",
    targetId: user.id,
    targetName: user.name,
    summary: `新增用户 ${user.name}`
  });
  return { ok: true, user: clone(user) };
}

function saveDepartment(payload = {}) {
  const departments = mockData.departments || [];
  const existing = payload.id && departments.find((item) => item.id === payload.id);
  const department = {
    id: payload.id || `d${departments.length + 1}`,
    name: payload.name || "",
    managers: Array.isArray(payload.managers) ? payload.managers.join("、") : (payload.managers || ""),
    status: payload.status || "启用",
    sort: Number(payload.sort || departments.length + 1)
  };

  if (existing) {
    const before = clone(existing);
    Object.assign(existing, department);
    recordOperation({
      module: "department",
      action: "update",
      targetType: "department",
      targetId: department.id,
      targetName: department.name,
      summary: `更新部门 ${department.name}`,
      detail: {
        diff: diffFields(before, existing, ["name", "managers", "status", "sort"])
      }
    });
    return { ok: true, department: clone(existing) };
  }

  departments.push(department);
  recordOperation({
    module: "department",
    action: "create",
    targetType: "department",
    targetId: department.id,
    targetName: department.name,
    summary: `新增部门 ${department.name}`
  });
  return { ok: true, department: clone(department) };
}

function saveParam(payload = {}) {
  const deviceId = String(payload.deviceId || "").trim();
  const device = findDeviceStrict(deviceId);
  if (!device) {
    return { ok: false, message: "Device is missing or invalid." };
  }
  const paramValues = localMockData.electricalParamValues || mockData.electricalParamValues || {};
  const params = paramValues[device.id] || [];
  const existing = payload.id && params.find((item) => item.id === payload.id);
  const param = {
    id: payload.id || `ep-${Date.now()}`,
    sort: existing ? existing.sort : params.length + 1,
    name: payload.name || "",
    value: payload.value || "",
    unit: payload.unit || "",
    category: payload.category || "",
    remark: payload.remark || "",
    disabled: !!payload.disabled
  };

  if (existing) {
    const before = clone(existing);
    Object.assign(existing, param);
    recordOperation({
      module: "param",
      action: "update",
      targetType: "param",
      targetId: param.id,
      targetName: param.name,
      summary: `更新参数 ${param.name}`,
      detail: {
        deviceId: device.id,
        diff: diffFields(before, existing, ["name", "value", "unit", "category", "remark"])
      }
    });
    return { ok: true, param: clone(existing) };
  }

  params.push(param);
  paramValues[device.id] = params;
  recordOperation({
    module: "param",
    action: "create",
    targetType: "param",
    targetId: param.id,
    targetName: param.name,
    summary: `新增参数 ${param.name}`,
    detail: { deviceId: device.id }
  });
  return { ok: true, param: clone(param) };
}

function disableParam(deviceId, paramId) {
  const device = findDeviceStrict(deviceId);
  if (!device) return { ok: false, message: "Device is missing or invalid." };
  if (!paramId) return { ok: false, message: "Parameter id is missing." };
  const params = (mockData.electricalParamValues || {})[device.id] || [];
  const param = params.find((item) => item.id === paramId);
  if (!param) return { ok: false, message: "未找到参数" };
  const beforeDisabled = param.disabled;
  param.disabled = true;
  recordOperation({
    module: "param",
    action: "disable",
    targetType: "param",
    targetId: param.id,
    targetName: param.name,
    summary: `停用参数 ${param.name}`,
    detail: {
      deviceId: device.id,
      diff: { disabled: { old: beforeDisabled, new: true } }
    }
  });
  return { ok: true, param: clone(param) };
}


function getParamCompareData(deviceIds = []) {
  if (!Array.isArray(deviceIds) || !deviceIds.length) return { devices: [], allParams: [], matrix: [] };
  const devices = deviceIds.map((id) => {
    const device = findDeviceStrict(id);
    if (!device) return null;
    const project = findProjectStrict(device.projectNo);
    return {
      id: device.id,
      deviceNo: device.deviceNo,
      project: project ? project.name : "",
      model: device.model || "",
      area: device.area || ""
    };
  }).filter(Boolean);

  const paramMap = {};
  const allParamNames = [];
  devices.forEach((device) => {
    const params = getDeviceParams(device.id).filter((p) => !p.disabled);
    paramMap[device.id] = {};
    params.forEach((p) => {
      paramMap[device.id][p.name] = p;
      if (allParamNames.indexOf(p.name) < 0) allParamNames.push(p.name);
    });
  });

  const matrix = allParamNames.map((paramName) => {
    const values = devices.map((d) => {
      const p = paramMap[d.id] && paramMap[d.id][paramName];
      return p ? { value: p.value, unit: p.unit || "", has: true } : { value: "-", unit: "", has: false };
    });
    const present = values.filter(function(v) { return v.has; });
    const hasDiff = present.length >= 2 && !present.every(function(v) {
      return String(v.value) === String(present[0].value) && String(v.unit || "") === String(present[0].unit || "");
    });
    values.forEach(function(v, index) {
      v.isDiff = index > 0 && hasDiff && v.has &&
        (String(v.value) !== String(values[0].value) || String(v.unit || "") !== String(values[0].unit || ""));
    });
    return {
      paramName: paramName,
      category: (devices.reduce(function(cat, d) {
        var p = paramMap[d.id] && paramMap[d.id][paramName];
        return cat || (p ? p.category : "");
      }, "") || "未分类"),
      values: values,
      hasDiff: hasDiff
    };
  });

  return { devices: devices, allParams: allParamNames, matrix: matrix };
}

function formatParamCell(param) {
  if (!param) return "";
  const value = String(param.value === undefined || param.value === null ? "" : param.value).trim();
  const unit = String(param.unit || "").trim();
  if (!value) return "";
  return unit ? `${value} ${unit}` : value;
}

function getDeviceParamMap(deviceId) {
  const result = {};
  getDeviceParams(deviceId).forEach((param) => {
    if (!param || param.disabled) return;
    result[param.name] = param;
  });
  return result;
}

function getParamExportOptions() {
  if (!canViewParamLibrary("electrical")) {
    return { projects: [], paramNames: [] };
  }
  const projectMap = {};
  const paramNames = [];
  (mockData.devices || []).forEach((device) => {
    if (!device || isDisabledRecord(device)) return;
    const project = findProjectStrict(device.projectNo);
    if (!project) return;
    if (!projectMap[project.projectNo]) {
      projectMap[project.projectNo] = {
        projectNo: project.projectNo,
        projectName: project.name || "",
        adminOrderDate: project.adminOrderDate || project.orderDate || project.createdAt || "",
        devices: []
      };
    }
    projectMap[project.projectNo].devices.push({
      id: device.id,
      deviceNo: device.deviceNo,
      model: device.model || "",
      area: device.area || ""
    });
    getDeviceParams(device.id).forEach((param) => {
      if (!param || param.disabled || !param.name) return;
      if (paramNames.indexOf(param.name) < 0) paramNames.push(param.name);
    });
  });
  return {
    projects: Object.keys(projectMap).sort().map((projectNo) => projectMap[projectNo]),
    paramNames: paramNames.sort()
  };
}

function dateInRange(value, startDate, endDate) {
  const date = String(value || "").slice(0, 10);
  if (!date) return false;
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  return true;
}

function getSelectedDevicesForProject(project, deviceSelection) {
  const selection = deviceSelection && deviceSelection[project.projectNo];
  if (!selection || selection.all) return project.devices || [];
  const ids = selection.deviceIds || [];
  return (project.devices || []).filter((device) => ids.indexOf(device.id) >= 0);
}

function buildParamExportData(filters = {}) {
  const options = getParamExportOptions();
  const mode = filters.mode || "project";
  const projectNo = String(filters.projectNo || "").trim();
  const startDate = String(filters.startDate || "").slice(0, 10);
  const endDate = String(filters.endDate || "").slice(0, 10);
  const deviceSelection = filters.deviceSelection || {};
  const filterParamNames = Array.isArray(filters.filterParamNames) ? filters.filterParamNames.filter(Boolean) : [];
  const filterValue = String(filters.filterValue || "").trim();
  const selectedParamNames = Array.isArray(filters.paramNames) && filters.paramNames.length
    ? filters.paramNames.filter((name) => options.paramNames.indexOf(name) >= 0)
    : options.paramNames.slice();

  let projects = options.projects.filter((project) => {
    const selection = deviceSelection[project.projectNo];
    return !selection || selection.all || (Array.isArray(selection.deviceIds) && selection.deviceIds.length > 0);
  });
  if (mode === "date") {
    projects = projects.filter((project) => dateInRange(project.adminOrderDate, startDate, endDate));
  } else if (projectNo) {
    projects = projects.filter((project) => project.projectNo === projectNo);
  }

  const rows = [];
  projects.forEach((project) => {
    getSelectedDevicesForProject(project, deviceSelection).forEach((device) => {
      const paramMap = getDeviceParamMap(device.id);
      if (filterParamNames.length && filterValue) {
        const matched = filterParamNames.some((name) => formatParamCell(paramMap[name]) === filterValue);
        if (!matched) return;
      }
      const row = {
        projectNo: project.projectNo,
        projectName: project.projectName,
        adminOrderDate: project.adminOrderDate,
        deviceNo: device.deviceNo,
        model: device.model,
        area: device.area,
        params: {}
      };
      selectedParamNames.forEach((name) => {
        row.params[name] = formatParamCell(paramMap[name]);
      });
      rows.push(row);
    });
  });

  return { options, paramNames: selectedParamNames, rows };
}

function writeFileInRuntime(fileName, bytes) {
  if (typeof wx !== "undefined" && wx.env && wx.env.USER_DATA_PATH && wx.getFileSystemManager) {
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    wx.getFileSystemManager().writeFileSync(filePath, arrayBuffer, "binary");
    return filePath;
  }
  const fs = require("fs");
  const pathModule = require("path");
  const dir = pathModule.join(process.cwd(), "outputs", "param-exports");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = pathModule.join(dir, fileName);
  fs.writeFileSync(filePath, Buffer.from(bytes));
  return filePath;
}

function exportParamWorkbook(filters = {}) {
  const data = buildParamExportData(filters);
  if (!data.rows.length) {
    return { ok: false, message: "没有符合条件的设备参数可导出。", rowCount: 0 };
  }
  const header = ["项目号", "项目名称", "下单日期", "设备号", "型号", "位置/区域"].concat(data.paramNames);
  const rows = data.rows.map((row) => {
    return [row.projectNo, row.projectName, row.adminOrderDate, row.deviceNo, row.model, row.area]
      .concat(data.paramNames.map((name) => row.params[name] || ""));
  });
  const bytes = xlsxWriter.buildXlsx([{ name: "设备参数", rows: [header].concat(rows) }]);
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const filePath = writeFileInRuntime(`设备参数导出_${stamp}.xlsx`, bytes);
  return {
    ok: true,
    filePath,
    rowCount: rows.length,
    paramCount: data.paramNames.length,
    message: `已导出 ${rows.length} 台设备参数。`
  };
}



// ---- P2 dataScope filters ----
var permissionService = null;
try { permissionService = require("./permission-service"); } catch (e) {}

function getDataScopeFilterForCurrentUser() {
  if (!permissionService) return { scope: "all", department: "", userName: "" };
  try {
    return permissionService.getDataScopeFilter();
  } catch (e) {
    return { scope: "all", department: "", userName: "" };
  }
}

function filterProjectsByScope(projects, filter) {
  if (!filter || filter.scope === "all" || !projects) return projects;
  return projects;
}

function filterDevicesByScope(devices, filter) {
  if (!filter || filter.scope === "all" || !devices) return devices;
  if (filter.scope === "self") return [];
  return devices;
}

function filterTasksByScope(tasks, filter, projects, devices) {
  if (!filter || filter.scope === "all" || !tasks) return tasks;
  if (filter.scope === "department") {
    var deptProjects = (projects || mockData.projects || []).filter(function(p) {
      return p.department === filter.department;
    }).map(function(p) { return p.projectNo; });
    return tasks.filter(function(t) {
      return deptProjects.indexOf(t.projectNo) >= 0 || t.owner === filter.userName;
    });
  }
  if (filter.scope === "project") {
    return tasks.filter(function(t) {
      return t.owner === filter.userName || (t.assignee === filter.userName);
    });
  }
  if (filter.scope === "self") {
    return tasks.filter(function(t) {
      return t.owner === filter.userName || (t.assignee === filter.userName);
    });
  }
  return tasks;
}

function filterQbByScope(qbList, filter) {
  if (!filter || filter.scope === "all" || !qbList) return qbList;
  if (filter.scope === "department") {
    return qbList.filter(function(q) {
      return q.initiator === filter.userName || q.currentOwner === filter.userName ||
        (q.assignees || []).some(function(a) { return a.name === filter.userName; });
    });
  }
  if (filter.scope === "project") {
    return qbList.filter(function(q) {
      return q.initiator === filter.userName || q.currentOwner === filter.userName ||
        (q.assignees || []).some(function(a) { return a.name === filter.userName; });
    });
  }
  if (filter.scope === "self") {
    return qbList.filter(function(q) {
      return q.initiator === filter.userName;
    });
  }
  return qbList;
}

function getPermissionConfigs() {
  const defaults = localMockData.permissions || [];
  const rows = Array.isArray(mockData.permissions) && mockData.permissions.length ? mockData.permissions : defaults;
  return clone(rows);
}

function savePermissionConfigs(rows = []) {
  if (!Array.isArray(rows)) return { ok: false, message: "权限配置必须是数组。" };
  mockData.permissions = clone(rows);
  recordOperation({
    module: "permission",
    action: "save",
    targetType: "permissions",
    targetId: "permissions",
    targetName: "权限配置",
    summary: "保存权限配置"
  });
  return { ok: true, permissions: clone(mockData.permissions) };
}

function getDashboardStats() {
  var projects = listProjects().filter(function(p) { return p.status !== "已归档"; });
  var devices = listDevices();
  var qbList = typeof listQb === "function" ? listQb() : [];
  var allTasks = typeof listTasks === "function" ? listTasks() : [];
  var today = new Date().toISOString().slice(0, 10);
  var getCurrentUserFn = null; try { getCurrentUserFn = require("./auth-service").getCurrentUser; } catch (e) {}
  var user = (typeof getCurrentUserFn === "function" ? getCurrentUserFn() : {}) || {};
  var myName = user.name || "";

  // Projects
  var totalProjects = projects.length;
  var activeProjects = projects.filter(function(p) { return p.status !== "已完成"; }).length;
  var doneProjects = totalProjects - activeProjects;
  var overdueProjects = projects.filter(function(p) {
    return p.shipDate && p.shipDate < today && p.status !== "已完成";
  }).length;

  // Devices
  var totalDevices = devices.length;
  var activeDevices = devices.filter(function(d) { return d.status !== "已完成"; }).length;
  var delayedDevices = devices.filter(function(d) { return d.delayed; }).length;
  var statusMap = {};
  devices.forEach(function(d) { var s = d.status || "未知"; statusMap[s] = (statusMap[s] || 0) + 1; });

  // QB stats (enhanced)
  var totalQb = qbList.length;
  var openQb = qbList.filter(function(q) { return q.status !== "已关闭"; }).length;
  var closedQb = totalQb - openQb;
  var qbAging = { within7: 0, within30: 0, over30: 0 };
  qbList.filter(function(q) { return q.status !== "已关闭"; }).forEach(function(q) {
    var created = q.createdAt || q.created || "";
    if (!created) { qbAging.over30++; return; }
    var days = Math.floor((new Date() - new Date(created)) / 86400000);
    if (days <= 7) qbAging.within7++;
    else if (days <= 30) qbAging.within30++;
    else qbAging.over30++;
  });
  var closedQbs = qbList.filter(function(q) { return q.status === "已关闭" && q.createdAt && q.closedAt; });
  var avgCloseDays = 0;
  if (closedQbs.length > 0) {
    var totalDays = closedQbs.reduce(function(sum, q) {
      return sum + Math.floor((new Date(q.closedAt) - new Date(q.createdAt)) / 86400000);
    }, 0);
    avgCloseDays = Math.round(totalDays / closedQbs.length);
  }

  // My tasks
  var myTasks = [];
  var myDone = 0, myOverdue = 0, myPending = 0;
  try {
    myTasks = filterTasksByView("mine", user);
    myDone = myTasks.filter(function(t) {
      var s = String(t.status || "");
      return !!t.closed || s.indexOf("已完成") >= 0 || s.indexOf("已关闭") >= 0;
    }).length;
    myOverdue = myTasks.filter(function(t) { return t.isOverdue || t.isDueToday; }).length;
    myPending = myTasks.length - myDone;
  } catch(e) { }

  // Task workload by user
  var workload = {};
  allTasks.filter(function(t) { return !t.closed; }).forEach(function(t) {
    var owner = t.owner || t.assignee || "";
    if (owner) { workload[owner] = (workload[owner] || 0) + 1; }
  });
  var workloadList = Object.keys(workload).map(function(name) {
    return { name: name, count: workload[name] };
  }).sort(function(a, b) { return b.count - a.count; }).slice(0, 10);

  // Task status breakdown
  var taskStatusMap = {};
  allTasks.forEach(function(t) {
    var s = t.status || "未知";
    taskStatusMap[s] = (taskStatusMap[s] || 0) + 1;
  });

  var ops = typeof getOperationLogs === "function" ? getOperationLogs() : [];
  var recentOps = ops.slice(0, 20);

  return {
    projects: { total: totalProjects, active: activeProjects, done: doneProjects, overdue: overdueProjects },
    devices: { total: totalDevices, active: activeDevices, delayed: delayedDevices, byStatus: statusMap },
    qb: { total: totalQb, open: openQb, closed: closedQb, aging: qbAging, avgCloseDays: avgCloseDays },
    myTasks: { total: myTasks.length, done: myDone, overdue: myOverdue, pending: myPending },
    tasks: { total: allTasks.length, byStatus: taskStatusMap },
    workload: workloadList,
    recentOps: recentOps
  };
}


module.exports = {
  getBackendInfo,
  setBackendMode,
  initCloudBackend,
  refreshCloudStore,
  syncCloudStore,
  checkCloudHealth,
  onCloudStoreChange,
  getProjects: listProjects,
  listProjects,
  filterProjectsByView,
  getProject,
  saveProject,
  deleteProject,
  getDevices: listDevices,
  listDevices,
  getDevicesByProject,
  getDevice,
  saveDevice,
  disableDevice,
  deleteDevice,
  getProcessesByDevice,
  getQbList: (projectNo) => listQb(projectNo ? { projectNo } : {}),
  listQb,
  getQb,
  getQbDetail,
  getQbIntegrationInfo,
  upsertQbFromDingTalk,
  syncQbFromDingTalk,
  getPermissionConfigs,
  savePermissionConfigs,
  getTasks: listTasks,
  listTasks,
  getTaskByRowKey,
  updateTaskStatusByRowKey,
  filterTasksByView,
  getUsers: listUsers,
  listUsers,
  getUser,
  getDepartments: listDepartments,
  listDepartments,
  getDepartment,
  getDictionary,
  getParamLibraryConfigs,
  updateParamLibraryAccess,
  saveParamTemplate,
  deleteParamTemplate,
  canViewParamLibrary,
  getVisibleParamLibraryKeys,
  getParamsByDevice: getDeviceParams,
  getDeviceParams,
  getParamCategoryOrder: () => getDictionary("paramCategories"),
  listParamDevices,
  getParamExportOptions,
  buildParamExportData,
  exportParamWorkbook,
  searchParams,
  listProcessOptions,
  getDefaultDepartmentForProcess,
  getDefaultOwnerForProcess,
  listDispatchDevices,
  getDepartmentProjectSubmitOptions,
  getProjectDepartmentDispatchDate,
  getDeviceProcessAssignmentDate,
  getProjectDispatchPreview,
  getDepartmentDispatchPreview,
  getQbCreateOptions,
  getQbTransferOptions,
  getUserEditOptions,
  getDepartmentEditOptions,
  submitProgress,
  getProjectDepartmentProgressPreview,
  submitProjectDepartmentProgress,
  createProjectDispatch,
  assignDepartmentTask,
  createQb,
  transferQb,
  appendQbProgress,
  closeQb,
  addQbAssignee,
  updateQbAssigneeStatus,
  removeQbAssignee,
  saveParamOrder,
  moveParamCategory,
  saveUser,
  saveDepartment,
  saveParam,
  disableParam,
  getParamCompareData,
  getDashboardStats,
  // P2 dataScope
  getDataScopeFilterForCurrentUser,
  filterProjectsByScope,
  filterDevicesByScope,
  filterTasksByScope,
  filterQbByScope
};

