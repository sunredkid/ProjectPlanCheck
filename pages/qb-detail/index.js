const authService = require("../../services/auth-service");
const dataService = require("../../services/data-service");

Page({
  data: {
    currentUser: {},
    qb: {},
    loadError: "",
    linkedDevices: [],
    logs: [],
    integrationInfo: {}
  },

  onLoad(options) {
    if (!options.qbNo) {
      this.setData({ loadError: "缺少 QB 编号，请从项目详情或任务列表重新进入。" });
      wx.showToast({ title: "缺少QB编号", icon: "none" });
      return;
    }
    const qbNo = decodeURIComponent(options.qbNo || "");
    const detail = dataService.getQbDetail(qbNo);
    if (!detail || !detail.qb || detail.qb.qbNo !== qbNo) {
      this.setData({ loadError: "未找到该 QB 记录，请返回后确认。" });
      wx.showToast({ title: "QB不存在", icon: "none" });
      return;
    }
    this.setData({
      loadError: "",
      qb: detail.qb,
      linkedDevices: detail.linkedDevices || [],
      logs: detail.logs || [],
      integrationInfo: dataService.getQbIntegrationInfo ? dataService.getQbIntegrationInfo() : {}
    });
  },

  onShow() {
    this.setData({
      currentUser: authService.getCurrentUser()
    });
  }
});
