var mockData = require("../utils/mock-data");

function clone(obj) {
  if (obj === undefined || obj === null) return obj;
  return JSON.parse(JSON.stringify(obj));
}

// ---- Notification store ----
var NOTIFICATION_STORE_KEY = "_notifications";
function _ensureStore() {
  if (!mockData || typeof mockData !== "object") return;
  if (!Array.isArray(mockData[NOTIFICATION_STORE_KEY])) {
    mockData[NOTIFICATION_STORE_KEY] = [];
  }
}

function _genId() {
  return "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---- Create notifications ----

function createNotification(opts) {
  if (!opts || !opts.targetUser) return null;
  _ensureStore();
  var n = {
    id: _genId(),
    type: opts.type || "info",
    title: opts.title || "",
    message: opts.message || "",
    targetUser: opts.targetUser,
    targetType: opts.targetType || "",
    targetId: opts.targetId || "",
    relatedUser: opts.relatedUser || "",
    read: false,
    createdAt: opts.createdAt || new Date().toISOString()
  };
  mockData[NOTIFICATION_STORE_KEY].unshift(n);
  // Keep only latest 200
  if (mockData[NOTIFICATION_STORE_KEY].length > 200) {
    mockData[NOTIFICATION_STORE_KEY] = mockData[NOTIFICATION_STORE_KEY].slice(0, 200);
  }
  return n;
}

// ---- Event-triggered notifications ----

function notifyTaskAssigned(task, assignedBy) {
  if (!task || !task.owner) return null;
  var assignedByName = (assignedBy && assignedBy.name) || assignedBy || "系统";
  return createNotification({
    type: "assign",
    title: "新任务指派",
    message: assignedByName + " 指派了任务 \"" + (task.name || task.id) + "\" 给你",
    targetUser: task.owner,
    targetType: "task",
    targetId: task.id || task.rowKey || "",
    relatedUser: assignedByName
  });
}

function notifyTaskOverdue(task) {
  if (!task || !task.owner) return null;
  return createNotification({
    type: "remind",
    title: "任务已逾期",
    message: "任务 \"" + (task.name || task.id) + "\" 已超过截止日期，请尽快处理",
    targetUser: task.owner,
    targetType: "task",
    targetId: task.id || task.rowKey || ""
  });
}

function notifyQbTransferred(qb, fromUser, toUser) {
  if (!qb || !toUser) return null;
  var fromName = (fromUser && fromUser.name) || fromUser || "系统";
  var qbTitle = qb.title || qb.qbNo || "";
  // Notify the new owner
  createNotification({
    type: "transfer",
    title: "QB 转交",
    message: fromName + " 将 QB \"" + qbTitle + "\" 转交给了你",
    targetUser: toUser,
    targetType: "qb",
    targetId: qb.id || qb.qbNo || "",
    relatedUser: fromName
  });
  // Notify the old owner (confirmation)
  if (fromName !== toUser) {
    createNotification({
      type: "transfer",
      title: "QB 已转出",
      message: "QB \"" + qbTitle + "\" 已转交给 " + toUser,
      targetUser: fromName,
      targetType: "qb",
      targetId: qb.id || qb.qbNo || "",
      relatedUser: toUser
    });
  }
  return true;
}

function notifyQbClosed(qb, closedBy) {
  if (!qb) return null;
  var closedByName = (closedBy && closedBy.name) || closedBy || "系统";
  var qbTitle = qb.title || qb.qbNo || "";
  createNotification({
    type: "close",
    title: "QB 已关闭",
    message: closedByName + " 关闭了 QB \"" + qbTitle + "\"",
    targetUser: qb.initiator || "",
    targetType: "qb",
    targetId: qb.id || qb.qbNo || "",
    relatedUser: closedByName
  });
  // Also notify current owner if different
  if (qb.currentOwner && qb.currentOwner !== qb.initiator) {
    createNotification({
      type: "close",
      title: "QB 已关闭",
      message: closedByName + " 关闭了 QB \"" + qbTitle + "\"",
      targetUser: qb.currentOwner,
      targetType: "qb",
      targetId: qb.id || qb.qbNo || "",
      relatedUser: closedByName
    });
  }
  return true;
}

function notifyQbProgress(qb, commentBy) {
  if (!qb) return null;
  var byName = (commentBy && commentBy.name) || commentBy || "系统";
  var qbTitle = qb.title || qb.qbNo || "";
  // Notify other assignees
  (qb.assignees || []).forEach(function(a) {
    if (a.name && a.name !== byName) {
      createNotification({
        type: "progress",
        title: "QB 有新进展",
        message: byName + " 在 QB \"" + qbTitle + "\" 中添加了新进展",
        targetUser: a.name,
        targetType: "qb",
        targetId: qb.id || qb.qbNo || "",
        relatedUser: byName
      });
    }
  });
  // Notify initiator if not in assignees
  if (qb.initiator && qb.initiator !== byName) {
    var inAssignees = (qb.assignees || []).some(function(a) { return a.name === qb.initiator; });
    if (!inAssignees) {
      createNotification({
        type: "progress",
        title: "QB 有新进展",
        message: byName + " 在 QB \"" + qbTitle + "\" 中添加了新进展",
        targetUser: qb.initiator,
        targetType: "qb",
        targetId: qb.id || qb.qbNo || "",
        relatedUser: byName
      });
    }
  }
  return true;
}

// ---- Query ----

function getNotificationsForUser(userName) {
  _ensureStore();
  if (!userName) return [];
  return (mockData[NOTIFICATION_STORE_KEY] || []).filter(function(n) {
    return n.targetUser === userName;
  });
}

function getUnreadCount(userName) {
  return getNotificationsForUser(userName).filter(function(n) { return !n.read; }).length;
}

function markAsRead(notificationId) {
  _ensureStore();
  var n = (mockData[NOTIFICATION_STORE_KEY] || []).find(function(item) { return item.id === notificationId; });
  if (n) n.read = true;
  return !!n;
}

function markAllAsRead(userName) {
  _ensureStore();
  var count = 0;
  (mockData[NOTIFICATION_STORE_KEY] || []).forEach(function(n) {
    if (n.targetUser === userName && !n.read) { n.read = true; count++; }
  });
  return count;
}


// ---- WeChat subscribe message (P2 ready, needs template IDs from WeChat backend) ----

// Template message IDs — fill after registering templates in WeChat backend.
// Templates needed:
//   1. 任务指派通知 — task assignment
//   2. 任务到期提醒 — task due reminder
//   3. QB 转交通知 — QB transfer
//   4. QB 处理进展 — QB progress update
var WX_TEMPLATE_IDS = {
  taskAssign: "",
  taskRemind: "",
  qbTransfer: "",
  qbProgress: ""
};

// tmplIds to request when user taps subscribe button.
// Returns the list of template IDs that are configured (non-empty).
function getSubscribeTemplateIds() {
  var ids = [];
  Object.keys(WX_TEMPLATE_IDS).forEach(function(key) {
    if (WX_TEMPLATE_IDS[key]) ids.push(WX_TEMPLATE_IDS[key]);
  });
  return ids;
}

// Call wx.requestSubscribeMessage to ask user for permission.
// Should be triggered by a user tap event (WeChat requirement).
function requestSubscribeMessage(callback) {
  var tmplIds = getSubscribeTemplateIds();
  if (tmplIds.length === 0) {
    if (typeof callback === "function") callback({ ok: false, message: "No template IDs configured. Fill WX_TEMPLATE_IDS." });
    return;
  }
  if (typeof wx === "undefined" || !wx.requestSubscribeMessage) {
    if (typeof callback === "function") callback({ ok: false, message: "wx.requestSubscribeMessage not available." });
    return;
  }
  wx.requestSubscribeMessage({
    tmplIds: tmplIds,
    success: function(res) {
      var accepted = tmplIds.filter(function(id) { return res[id] === "accept"; });
      if (typeof callback === "function") callback({ ok: true, accepted: accepted, raw: res });
    },
    fail: function(err) {
      if (typeof callback === "function") callback({ ok: false, message: err.errMsg || "Subscribe failed." });
    }
  });
}

// Send a template message via cloud function.
// In mock mode, this is a no-op that logs to console.
// In cloud mode, calls wx.cloud.callFunction({ name: "appStore", data: { action: "sendTemplateMsg", ... } })
function sendTemplateMessage(opts) {
  if (!opts || !opts.tmplId || !opts.touser) return Promise.resolve({ ok: false, message: "Missing required params." });

  // Mock mode: just log
  if (typeof wx === "undefined" || !wx.cloud || !wx.cloud.callFunction) {
    return Promise.resolve({ ok: true, mode: "mock", message: "Template message logged (mock)." });
  }

  return wx.cloud.callFunction({
    name: "appStore",
    data: {
      action: "sendTemplateMsg",
      touser: opts.touser,
      templateId: opts.tmplId,
      page: opts.page || "",
      data: opts.data || {},
      emphasisKeyword: opts.emphasisKeyword || ""
    }
  }).then(function(res) {
    return { ok: true, mode: "cloud", result: res };
  }).catch(function(err) {
    return { ok: false, mode: "cloud-error", message: err.errMsg || err.message || "Failed to send template message." };
  });
}

// Convenience: send task assignment template message
function sendTaskAssignTemplate(openid, task, page) {
  var tmplId = WX_TEMPLATE_IDS.taskAssign;
  if (!tmplId || !openid) return Promise.resolve({ ok: false, message: "Missing tmplId or openid." });
  return sendTemplateMessage({
    tmplId: tmplId,
    touser: openid,
    page: page || "/pages/tasks/index",
    data: {
      thing1: { value: (task && task.process) || (task && task.name) || "" },
      thing2: { value: (task && task.project) || "" },
      date3: { value: (task && task.dueDate) || "" },
      thing4: { value: (task && task.owner) || "" }
    }
  });
}

module.exports = {
  createNotification,
  notifyTaskAssigned,
  notifyTaskOverdue,
  notifyQbTransferred,
  notifyQbClosed,
  notifyQbProgress,
  getNotificationsForUser,
  getUnreadCount,
  markAsRead,
  markAllAsRead
};