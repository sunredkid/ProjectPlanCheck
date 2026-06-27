const dataService = require("../../services/data-service");

Page({
  data: {
    stats: null,
    loading: true,
    loadError: ""
  },

  onShow() {
    this.loadStats();
  },

  loadStats() {
    this.setData({ loading: true });
    try {
      const stats = dataService.getDashboardStats();
      this.setData({ stats, loading: false, loadError: "" });
    } catch (e) {
      this.setData({ loading: false, loadError: (e && e.message) || "\u52a0\u8f7d\u5931\u8d25" });
    }
  }
});
