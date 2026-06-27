let mockData = require("../utils/mock-data");
const localMockData = mockData;
const cloudData = require("./cloud-data");
const auditService = require("./audit-service");
var notificationService = null; try { notificationService = require("./notification-service"); } catch (e) {}

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

function normalizeProcessName(name = "") {
  const value = String(name || "").trim();
  const map = {
    "机械采购": "采购物料",
    "电气采购": "采购物料",
    "采购部门": "采购物料",
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
    "采购物料": "采购部",
    "电箱组装": "电工房",
    "电气盘安装": "电工房",
    "结构总装": "结构班组",
    "电气总装": "电气班组",
    "调试": "品质部",
    "发货": "生产部"
  };
  return map[process] || "";
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
  return (mockData.projects || []).find((item) => item.projectNo === projectNo) || (mockData.projects || [])[0] || null;
}

function findProjectStrict(projectNo) {
  if (!projectNo) return null;
  return (mockData.projects || []).find((item) => item.projectNo === projectNo) || null;
}

function getRawDevice(deviceId) {
  return (mockData.devices || []).find((item) => item.id === deviceId) || (mockData.devices || [])[0] || null;
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
  return text.indexOf("延期") >= 0 || text.indexOf("逾期") >= 0;
}

function isProcessOverdue(process = {}, todayText = getTodayString()) {
  if (isDoneStatus(process.status)) return false;
  if (isDelayedStatus(process.status)) return true;
  const diff = getDayDiff(parseDateValue(process.due || process.dueDate), parseDateValue(todayText));
  return diff !== null && diff < 0;
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

function decorateDeviceSummary(device = {}, todayText = getTodayString()) {
  const processes = ((mockData.processMap && mockData.processMap[device.id]) || [])
    .filter((item) => !isDisabledProcessName(item.name || ""))
    .map((item) => Object.assign({}, item, { name: normalizeProcessName(item.name || "") }));
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
  const progress = processSummary.total
    ? Math.round((processSummary.done / processSummary.total) * 100)
    : Number(project.progress || 0);

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
    qbOpen
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
  const today = getTodayString();
  return clone(projects.map((project) => decorateProjectSummary(project, today)));
}

function filterProjectsByView(view, extraFilters = {}) {
  const viewKeyMap = {
    all: "全部",
    ongoing: "进行中",
    delayed: "延期",
    qb: "有QB",
    archived: "已归档"
  };
  const viewKey = viewKeyMap[view] || view;
  let projects = listProjects({
    ...extraFilters,
    includeArchived: viewKey === "已归档"
  });
  if (viewKey === "延期") {
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

function saveProject(payload = {}) {
  const projects = mockData.projects || [];
  const projectNo = String(payload.projectNo || "").trim();
  if (!projectNo) {
    return { ok: false, message: "请填写项目号" };
  }

  const existing = projects.find((item) => item.projectNo === projectNo || item.id === payload.id);
  const project = {
    id: payload.id || (existing && existing.id) || `p${projects.length + 1}`,
    projectNo,
    name: payload.name || "",
    customer: payload.customer || "",
    admin: payload.admin || "",
    shipDate: payload.shipDate || "",
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
    recordOperation({
      module: "project",
      action: "update",
      targetType: "project",
      targetId: existing.projectNo,
      targetName: existing.name,
      summary: `更新项目 ${existing.projectNo}`,
      detail: {
        diff: diffFields(before, existing, ["name", "customer", "admin", "shipDate", "status"])
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

function archiveProject(projectNo) {
  const project = (mockData.projects || []).find((item) => item.projectNo === projectNo || item.id === projectNo);
  if (!project) return { ok: false, message: "未找到项目" };
  project.status = "已归档";
  recordOperation({
    module: "project",
    action: "archive",
    targetType: "project",
    targetId: project.projectNo,
    targetName: project.name,
    summary: `归档项目 ${project.projectNo}`
  });
  return { ok: true, project: clone(decorateProjectSummary(project)) };
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
    .map((name) => ({
      name,
      status: "未开始",
      owner: "-",
      phone: "-",
      due: shipDate || "",
      actualStart: "",
      actualFinish: ""
    }));
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
  return clone((mockData.processMap && mockData.processMap[device.id]) || []);
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

function listTasks(filters = {}) {
  let tasks = mockData.tasks || [];
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
  const isOverdue = !closed && (diff !== null ? diff < 0 : (statusText.indexOf("延期") >= 0 || statusText.indexOf("逾期") >= 0));
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
  return {
    ...item,
    process: normalizedProcess,
    department: normalizedDepartment,
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
    return tasks.filter((item) => item.owner === currentUser.name || String(item.project || "").indexOf(currentUser.name) >= 0 || !item.department);
  }
  return clone(tasks);
}

function listUsers(filters = {}) {
  let users = (mockData.users || []).map((user) => {
    const departmentMap = {
      "电气设计": "电气设计部",
      "电气设计部门": "电气设计部",
      "智能自控部": "电气设计部",
      "项目管理": "制造部",
      "进度管理": "制造部",
      "总经办": "总经办/销售/市场",
      "结构设计": "结构设计部",
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
  const paramValues = localMockData.electricalParamValues || mockData.electricalParamValues || {};
  return clone(paramValues[device.id] || device.params || []);
}

function listParamDevices() {
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

function searchParams(filters = {}) {
  const keyword = String(filters.keyword || "").toLowerCase();
  const paramKeyword = String(filters.paramKeyword || "").toLowerCase();
  const valueKeyword = String(filters.valueKeyword || "").toLowerCase();
  const remarkKeyword = String(filters.remarkKeyword || "").toLowerCase();
  const categoryFilter = String(filters.category || "").trim();
  const mode = filters.modeKey || filters.mode || "按设备查";
  const devices = listParamDevices();

  if (mode === "param" || mode === "按参数查") {
    const rows = [];
    Object.keys(mockData.electricalParamValues || {}).forEach((deviceId) => {
      const device = findDeviceStrict(deviceId);
      if (!device || isDisabledRecord(device)) return;
      const project = findProjectStrict(device.projectNo);
      if (!project) return;
      getDeviceParams(deviceId).forEach((param) => {
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
  const users = listUsers({ department }).map((user) => `${user.name}｜${user.department}`);
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
  const processList = mockData.processMap && mockData.processMap[deviceId];
  const process = processList && processList.find((item) => !processName || normalizeProcessName(item.name || "") === processName);

  if (!process) {
    const task = updateTaskProgress({ ...payload, process: processName });
    if (task) {
      recordOperation({
        module: "task",
        action: "submit-progress",
        targetType: "task",
        targetId: payload.taskRowKey || (payload.task && payload.task.rowKey) || "",
        targetName: processName || "",
        summary: `提交任务进度 ${processName || ""}`,
        detail: {
          status: payload.status || "",
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

  process.status = payload.status || process.status;
  process.actualStart = payload.actualStartDate || process.actualStart;
  process.actualFinish = payload.actualFinishDate || process.actualFinish;
  process.quantity = payload.quantity || process.quantity || "";
  process.remark = payload.remark || process.remark || "";
  process.attachments = Array.isArray(payload.attachments) ? clone(payload.attachments) : (process.attachments || []);
  const task = updateTaskProgress({ ...payload, process: processName });
  updateDeviceProgress(deviceId);

  recordOperation({
    module: "task",
    action: "submit-progress",
    targetType: "process",
    targetId: deviceId,
    targetName: processName || "",
    summary: `提交工序进度 ${processName || ""}`,
    detail: {
      status: payload.status || "",
      actualStartDate: payload.actualStartDate || "",
      actualFinishDate: payload.actualFinishDate || ""
    }
  });

  return { ok: true, process: clone(process), task: clone(task), device: clone(decorateDeviceSummary(device)) };
}

function createProjectDispatch(payload = {}) {
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
        status: "待部门派单",
        remark: item.remark
      };
      mockData.tasks.unshift(task);
    } else {
      task.dueDate = item.due || task.dueDate;
      task.status = "待部门派单";
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
  const assignee = getNameFromDisplay(payload.assignee || payload.selectedUser);
  if (!assignee) {
    return { ok: false, message: "请选择具体负责人" };
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
      process: task.process || ""
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

function createQb(payload = {}) {
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
  const storedDetail = mockData.qbDetails && mockData.qbDetails[qbNo];
  if (!storedDetail) return { ok: false, message: "未找到QB" };

  if (!findProjectStrict(storedDetail.qb && storedDetail.qb.projectNo)) {
    return { ok: false, message: "QB project is missing or invalid." };
  }

  const owner = getNameFromDisplay(payload.toUser || payload.selectedUser);
  storedDetail.qb.currentOwner = owner;
  storedDetail.qb.owner = owner;
  storedDetail.logs.unshift({
    time: payload.time || "",
    user: payload.operator || "",
    rowKey: `${qbNo}-transfer-${Date.now()}`,
    content: `转交给${owner}，原因：${payload.reason || ""}`
  });

  const qb = (mockData.qbList || []).find((item) => item.qbNo === qbNo);
  if (qb) {
    qb.owner = owner;
    qb.currentOwner = owner;
  }
  const task = upsertQbTask(storedDetail.qb);
  if (!task || task.ok === false) {
    return { ok: false, message: (task && task.message) || "QB task sync failed." };
  }
  recordOperation({
    module: "qb",
    action: "transfer",
    targetType: "qb",
    targetId: qbNo,
    targetName: storedDetail.qb.description || storedDetail.qb.title || "",
    summary: `转交QB ${qbNo} 给 ${owner}`,
    detail: {
      owner,
      reason: payload.reason || ""
    }
  });
  if (notificationService) { notificationService.notifyQbTransferred(storedDetail.qb, payload.transferredBy || '', owner); }
  return { ok: true, qb: clone(storedDetail.qb), logs: clone(storedDetail.logs) };
}

function appendQbProgress(qbNo, payload = {}) {
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
  archiveProject,
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
  getTasks: listTasks,
  listTasks,
  getTaskByRowKey,
  filterTasksByView,
  getUsers: listUsers,
  listUsers,
  getUser,
  getDepartments: listDepartments,
  listDepartments,
  getDepartment,
  getParamsByDevice: getDeviceParams,
  getDeviceParams,
  getParamCategoryOrder: () => getDictionary("paramCategories"),
  listParamDevices,
  searchParams,
  listProcessOptions,
  getDefaultDepartmentForProcess,
  listDispatchDevices,
  getProjectDispatchPreview,
  getDepartmentDispatchPreview,
  getQbCreateOptions,
  getQbTransferOptions,
  getUserEditOptions,
  getDepartmentEditOptions,
  submitProgress,
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

