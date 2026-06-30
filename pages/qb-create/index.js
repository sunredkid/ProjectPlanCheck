const dataService = require("../../services/data-service");

Page({
  data: {
    readonlyMessage: ""
  },

  onLoad() {
    const info = dataService.getQbIntegrationInfo();
    this.setData({ readonlyMessage: info.message });
    wx.showToast({ title: info.message, icon: "none" });
  }
});
