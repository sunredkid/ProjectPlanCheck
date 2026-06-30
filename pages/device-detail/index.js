const authService = require("../../services/auth-service");
const dataService = require("../../services/data-service");
const permissionService = require("../../services/permission-service");

Page({
  data: {
    activeTab: "进度",
    tabs: ["进度", "负责人", "QB", "参数"],
    loadError: "",
    device: {},
    processes: [],
    qbList: [],
    params: [],
    canSubmitDeviceProgress: true,
    isDisabling: false,
    isDeleting: false,
    isBusy: false
  },

  onLoad(options) {
    if (!options.id) {
      this.setData({ loadError: "缺少设备标识，请从项目详情重新进入。" });
      wx.showToast({ title: "缺少设备标识", icon: "none" });
      return;
    }
    this.setData({ deviceId: decodeURIComponent(options.id || "") });
    this.loadDevice();
  },

  onShow() {
    if (this.data.deviceId) {
      this.loadDevice();
    }
  },

  loadDevice() {
    const device = dataService.getDevice(this.data.deviceId);
    if (!device || device.id !== this.data.deviceId) {
      this.setData({ loadError: "未找到该设备，请返回项目详情确认。" });
      wx.showToast({ title: "设备不存在", icon: "none" });
      return;
    }
    const project = dataService.getProject(device.projectNo);
    const currentUser = authService.getCurrentUser() || {};
    const canSubmitDeviceProgress = !permissionService.isDepartmentManager(currentUser) &&
      !permissionService.canDispatchProject(currentUser);
    this.setData({
      loadError: "",
      device: { ...device, status: device.status || "启用", project: project.name },
      processes: device.processes.map((item) => ({
        ...item,
        start: item.actualStart || "-",
        finish: item.actualFinish || "-",
        canSubmitProgress: canSubmitDeviceProgress && item.owner === currentUser.name
      })),
      qbList: dataService.getQbList(device.projectNo),
      params: dataService.getParamsByDevice(device.id),
      canSubmitDeviceProgress
    });
  },

  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.value });
  },

  submitProgress(e) {
    const process = e.currentTarget.dataset.process;
    if (!this.data.device.id || !process) {
      wx.showToast({ title: "工序信息缺失", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: `/pages/progress-submit/index?deviceId=${encodeURIComponent(this.data.device.id)}&process=${encodeURIComponent(process)}`
    });
  },

  editDevice() {
    if (!this.data.device.id) {
      wx.showToast({ title: "设备标识缺失", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: `/pages/device-edit/index?id=${encodeURIComponent(this.data.device.id)}`
    });
  },

  disableDevice() {
    if (this.data.isBusy) {
      return;
    }

    wx.showModal({
      title: "停用设备",
      content: "停用后设备仍保留在项目中，可在编辑页重新启用。",
      confirmText: "停用",
      success: (res) => {
        if (!res.confirm) return;
        if (!this.data.device.id) {
          wx.showToast({ title: "设备标识缺失", icon: "none" });
          return;
        }
        this.setData({ isDisabling: true, isBusy: true });
        try {
          const result = dataService.disableDevice(this.data.device.id);
          wx.showToast({ title: result.ok ? "已停用" : result.message || "停用失败", icon: result.ok ? "success" : "none" });
          if (result.ok) this.loadDevice();
        } catch (error) {
          wx.showToast({ title: error.message || "停用失败", icon: "none" });
        } finally {
          this.setData({ isDisabling: false, isBusy: false });
        }
      }
    });
  },

  deleteDevice() {
    if (this.data.isBusy) {
      return;
    }

    wx.showModal({
      title: "删除设备",
      content: "将同时移除该设备的工序、参数和相关待办记录。",
      confirmText: "删除",
      confirmColor: "#dc2626",
      success: (res) => {
        if (!res.confirm) return;
        if (!this.data.device.id) {
          wx.showToast({ title: "设备标识缺失", icon: "none" });
          return;
        }
        this.setData({ isDeleting: true, isBusy: true });
        try {
          const result = dataService.deleteDevice(this.data.device.id);
          wx.showToast({ title: result.ok ? "已删除" : result.message || "删除失败", icon: result.ok ? "success" : "none" });
          if (result.ok) setTimeout(() => wx.navigateBack(), 800);
        } catch (error) {
          wx.showToast({ title: error.message || "删除失败", icon: "none" });
        } finally {
          this.setData({ isDeleting: false, isBusy: false });
        }
      }
    });
  },

  openQb(e) {
    const qbNo = e.currentTarget.dataset.no;
    if (!qbNo) {
      wx.showToast({ title: "QB编号缺失", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: `/pages/qb-detail/index?qbNo=${encodeURIComponent(qbNo)}`
    });
  },

  openParams() {
    if (!this.data.device.id) {
      wx.showToast({ title: "设备标识缺失", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: `/pages/param-detail/index?deviceId=${encodeURIComponent(this.data.device.id)}`
    });
  },

  openParamCompare() {
    wx.navigateTo({ url: "/pages/param-compare/index" });
  }
});
