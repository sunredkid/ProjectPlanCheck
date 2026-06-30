const authService = require("../../services/auth-service");
const permissionService = require("../../services/permission-service");
const dataService = require("../../services/data-service");

function formatCloudStatus(backend = {}) {
  const cloud = backend.cloud || {};
  const localMockMode = cloud.localMockMode || false;
  const active = backend.active || "mock";
  const ready = active === "cloud" && cloud.ready;
  const loadStateMap = {
    idle: "未加载",
    loading: "加载中",
    loaded: "已加载",
    empty: "空数据",
    error: "加载失败"
  };
  const syncStateMap = {
    idle: "未同步",
    pending: "等待同步",
    syncing: "同步中",
    synced: "已同步",
    error: "同步失败"
  };
  const healthStateMap = {
    idle: "未诊断",
    checking: "诊断中",
    ok: "诊断通过",
    error: "诊断失败"
  };
  const healthResult = cloud.lastHealthResult || {};
  const schema = (healthResult && healthResult.schema) || cloud.lastSchemaReport || {};

  return {
    active,
    ready,
    title: localMockMode ? "本地模拟云存储" : (ready ? "云服务运行中" : "本地运行态"),
    userTitle: localMockMode ? "本地测试数据" : (ready ? "数据已连接" : "本地数据模式"),
    userDesc: localMockMode
      ? "当前使用本机测试数据，正式上线后会自动切换为云端数据。"
      : (ready ? "项目数据已连接云端，可正常查看和同步。" : "当前未连接云端，数据以本地状态为准。"),
    connectionLabel: localMockMode ? "本地模拟" : (ready ? "已连接" : "未连接"),
    statusClass: localMockMode ? "info" : (ready ? "success" : "warning"),
    loadLabel: loadStateMap[cloud.loadState] || cloud.loadState || "-",
    syncLabel: syncStateMap[cloud.syncState] || cloud.syncState || "-",
    healthLabel: healthStateMap[cloud.healthState] || cloud.healthState || "-",
    envId: cloud.envId || "动态当前环境",
    transport: cloud.transport || "auto",
    cloudFunctionName: cloud.cloudFunctionName || "-",
    storeCollection: cloud.storeCollection || "-",
    storeDocId: cloud.storeDocId || "-",
    healthDocId: cloud.healthDocId || "-",
    lastLoadAt: cloud.lastLoadAt || "-",
    lastSyncAt: cloud.lastSyncAt || "-",
    lastHealthAt: cloud.lastHealthAt || "-",
    healthOk: !!healthResult.ok,
    healthSteps: healthResult.steps || [],
    schemaOk: schema.ok !== false,
    schemaVersion: schema.version || cloud.schemaVersion || "-",
    schemaMissingCount: (schema.missingKeys || []).length,
    schemaRepairedCount: (schema.repairedKeys || []).length,
    schemaTypeIssueCount: (schema.typeIssues || []).length,
    schemaUnknownCount: (schema.unknownKeys || []).length,
    hasPendingSync: !!cloud.hasPendingSync,
    lastError: cloud.lastError || ""
  };
}

function getUserKey(user = {}) {
  return user.id || user.phone || user.name || "";
}

function decoratePreviewUsers(users = [], currentUser = {}) {
  const currentKey = getUserKey(currentUser);
  return users.map((item) => ({
    ...item,
    active: getUserKey(item) === currentKey
  }));
}

Page({
  data: {
    user: {},
    authState: {},
    previewUsers: [],
    mockPreviewEnabled: false,
    adminMenus: [
      { name: "用户管理", url: "/pages/user-manage/index" },
      { name: "部门管理", url: "/pages/department-manage/index" },
      { name: "权限管理", url: "/pages/permission-manage/index" },
      { name: "工序字典", url: "/pages/dictionary-manage/index" },
      { name: "参数字段管理", url: "/pages/dictionary-manage/index" },
      { name: "数据看板", url: "/pages/dashboard/index" }
    ],
    selfMenus: [
      { name: "登录绑定", url: "/pages/login/index" },
      { name: "我的权限", url: "/pages/my-permissions/index" },
      { name: "操作记录", url: "/pages/operation-logs/index" },
      { name: "退出登录", url: "" }
    ],
    isSuperAdmin: false,
    cloudStatus: formatCloudStatus({}),
    isCloudBusy: false,
    canViewCloudOps: false,
    cloudOpsExpanded: false
  },

  onShow() {
    this.refreshPageState();
  },

  onLoad() {
    this.cloudUnsubscribe = dataService.onCloudStoreChange(() => {
      this.refreshPageState();
    });
  },

  onUnload() {
    if (this.cloudUnsubscribe) {
      this.cloudUnsubscribe();
      this.cloudUnsubscribe = null;
    }
  },

  refreshPageState() {
    const authState = authService.getAuthState();
    const user = authService.getCurrentUser() || {};
    const previewUsers = decoratePreviewUsers(authService.listPreviewUsers(), user);
    this.setData({
      authState,
      user: {
        ...user,
        avatarText: user.name ? user.name.substring(0, 1) : "我"
      },
      previewUsers,
      mockPreviewEnabled: authState.mockPreviewEnabled,
      isSuperAdmin: permissionService.canViewAdminEntry(user),
      canViewCloudOps: authState.mockPreviewEnabled || permissionService.canViewAdminEntry(user),
      cloudStatus: formatCloudStatus(dataService.getBackendInfo())
    });
  },

  toggleCloudOps() {
    if (!this.data.canViewCloudOps) return;
    this.setData({ cloudOpsExpanded: !this.data.cloudOpsExpanded });
  },

  openMenu(e) {
    const url = e.currentTarget.dataset.url;
    if (url) {
      wx.navigateTo({ url });
      return;
    }
    wx.showToast({
      title: `${e.currentTarget.dataset.name} 下一步接入`,
      icon: "none"
    });
  },

  openSelfMenu(e) {
    this.openMenu(e);
  },

  switchMockUser(e) {
    if (!this.data.mockPreviewEnabled) {
      wx.showToast({
        title: "正式版不可切换角色",
        icon: "none"
      });
      return;
    }
    const index = Number(e.currentTarget.dataset.index);
    const user = this.data.previewUsers[index];
    const currentUser = authService.switchMockUser(user.id || user.phone || user.name);
    this.setData({
      user: {
        ...currentUser,
        avatarText: currentUser.name.substring(0, 1)
      },
      previewUsers: decoratePreviewUsers(this.data.previewUsers, currentUser),
      isSuperAdmin: permissionService.canViewAdminEntry(currentUser),
      canViewCloudOps: this.data.authState.mockPreviewEnabled || permissionService.canViewAdminEntry(currentUser)
    });
    wx.showToast({
      title: `已切换为${currentUser.name}`,
      icon: "none"
    });
  },

  reconnectCloud() {
    if (!this.data.canViewCloudOps) return;
    if (this.data.isCloudBusy) return;
    this.setData({ isCloudBusy: true });
    const result = dataService.initCloudBackend();
    this.refreshPageState();
    this.setData({ isCloudBusy: false });
    wx.showToast({
      title: result.ok ? "云服务已连接" : "云服务未就绪",
      icon: "none"
    });
  },

  refreshCloudStore() {
    if (!this.data.canViewCloudOps) return;
    if (this.data.isCloudBusy) return;
    this.setData({ isCloudBusy: true });
    wx.showLoading({ title: "拉取云数据" });
    dataService.refreshCloudStore()
      .then((result) => {
        wx.showToast({
          title: result.ok ? "云数据已拉取" : "拉取失败",
          icon: "none"
        });
      })
      .catch(() => {
        wx.showToast({ title: "拉取失败", icon: "none" });
      })
      .finally(() => {
        wx.hideLoading();
        this.refreshPageState();
        this.setData({ isCloudBusy: false });
      });
  },

  syncCloudStore() {
    if (!this.data.canViewCloudOps) return;
    if (this.data.isCloudBusy) return;
    this.setData({ isCloudBusy: true });
    wx.showLoading({ title: "同步到云端" });
    dataService.syncCloudStore("manual-sync")
      .then((result) => {
        wx.showToast({
          title: result.ok ? "已同步云端" : "同步失败",
          icon: "none"
        });
      })
      .catch(() => {
        wx.showToast({ title: "同步失败", icon: "none" });
      })
      .finally(() => {
        wx.hideLoading();
        this.refreshPageState();
        this.setData({ isCloudBusy: false });
      });
  },

  checkCloudHealth() {
    if (!this.data.canViewCloudOps) return;
    if (this.data.isCloudBusy) return;
    this.setData({ isCloudBusy: true });
    wx.showLoading({ title: "云诊断" });
    dataService.checkCloudHealth()
      .then((result) => {
        wx.showToast({
          title: result.ok ? "云诊断通过" : "云诊断失败",
          icon: "none"
        });
      })
      .catch(() => {
        wx.showToast({ title: "云诊断失败", icon: "none" });
      })
      .finally(() => {
        wx.hideLoading();
        this.refreshPageState();
        this.setData({ isCloudBusy: false });
      });
  }
});
