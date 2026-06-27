const mockData = require("../utils/mock-data");
const authService = require("./auth-service");
const cloudData = require("./cloud-data");

function clone(value) {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
}

function getStore() {
  if (!mockData.operationLogs) {
    mockData.operationLogs = [];
  }
  return mockData.operationLogs;
}

function getCurrentActor() {
  const user = authService.getCurrentUser() || {};
  const authState = authService.getAuthState ? authService.getAuthState() : {};
  return {
    name: user.name || "",
    phone: user.phone || "",
    department: user.department || "",
    role: user.roleLabel || user.role || "",
    envVersion: authState.envVersion || ""
  };
}

function recordOperation(payload = {}) {
  const store = getStore();
  const actor = payload.actor || getCurrentActor();
  const log = {
    id: payload.id || `op${store.length + 1}`,
    createdAt: payload.createdAt || new Date().toISOString(),
    module: payload.module || "system",
    action: payload.action || "",
    targetType: payload.targetType || "",
    targetId: payload.targetId || "",
    targetName: payload.targetName || "",
    summary: payload.summary || "",
    actor,
    detail: clone(payload.detail || {})
  };
  store.unshift(log);
  cloudData.schedulePersist(`${log.module}:${log.action}`);
  return clone(log);
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

function listOperationLogs(filters = {}) {
  let logs = getStore();
  const keyword = String(filters.keyword || "").trim().toLowerCase();
  if (filters.module) {
    logs = logs.filter((item) => item.module === filters.module);
  }
  if (filters.action) {
    logs = logs.filter((item) => item.action === filters.action);
  }
  if (filters.targetType) {
    logs = logs.filter((item) => item.targetType === filters.targetType);
  }
  if (keyword) {
    logs = logs.filter((item) => {
      const actor = item.actor || {};
      const haystack = [
        item.id,
        item.createdAt,
        item.module,
        item.action,
        item.targetType,
        item.targetId,
        item.targetName,
        item.summary,
        actor.name,
        actor.department,
        actor.role,
        actor.envVersion
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.indexOf(keyword) >= 0;
    });
  }
  if (filters.pageNo || filters.pageSize) {
    return paginateRows(logs, filters);
  }
  return clone(logs);
}

module.exports = {
  recordOperation,
  listOperationLogs
};
