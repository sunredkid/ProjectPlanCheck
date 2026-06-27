var authService = require("../../services/auth-service");
var notifService = require("../../services/notification-service");

var TYPE_LABELS = {
  assign: "任务指派",
  remind: "到期提醒",
  transfer: "QB转交",
  close: "QB关闭",
  progress: "进展更新",
  info: "系统通知"
};

var TYPE_ICONS = {
  assign: "\uD83D\uDCCB",
  remind: "\u23F0",
  transfer: "\uD83D\uDCE4",
  close: "\u2705",
  progress: "\uD83D\uDCCC",
  info: "\u2139\uFE0F"
};

Page({
  data: {
    notifications: [],
    unreadCount: 0,
    loading: true,
    typeLabels: TYPE_LABELS,
    typeIcons: TYPE_ICONS
  },

  onShow: function() {
    this.loadNotifications();
  },

  loadNotifications: function() {
    this.setData({ loading: true });
    var user = authService.getCurrentUser() || {};
    var userName = user.name || "";
    var notifications = notifService.getNotificationsForUser(userName);
    var unreadCount = notifications.filter(function(n) { return !n.read; }).length;
    this.setData({
      notifications: notifications,
      unreadCount: unreadCount,
      loading: false
    });
  },

  onTapNotification: function(e) {
    var id = e.currentTarget.dataset.id;
    if (!id) return;
    notifService.markAsRead(id);
    this.loadNotifications();
    // Navigate to target
    var item = this.data.notifications.find(function(n) { return n.id === id; });
    if (!item) return;
    if (item.targetType === "qb") {
      wx.navigateTo({ url: "/pages/qb-detail/index?id=" + item.targetId });
    } else if (item.targetType === "task") {
      wx.navigateTo({ url: "/pages/tasks/index" });
    }
  },

  subscribeMessage: function() {
    notifService.requestSubscribeMessage(function(result) {
      if (result.ok) {
        wx.showToast({ title: "已授权 " + result.accepted.length + " 项通知", icon: "none" });
      } else {
        wx.showToast({ title: result.message || "授权取消", icon: "none" });
      }
    });
  },

  markAllRead: function() {
    var user = authService.getCurrentUser() || {};
    var userName = user.name || "";
    notifService.markAllAsRead(userName);
    this.loadNotifications();
    wx.showToast({ title: "已全部标记为已读", icon: "none" });
  }
});