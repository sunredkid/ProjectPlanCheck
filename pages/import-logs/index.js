const importService = require("../../services/import-service");

Page({
  data: {
    keyword: "",
    statusFilters: [
      { key: "", label: "全部" },
      { key: "成功", label: "成功" },
      { key: "失败", label: "失败" }
    ],
    activeStatus: "",
    logs: [],
    total: 0,
    pageNo: 1,
    pageSize: 8,
    hasMore: false
  },

  onShow() {
    this.loadLogs(true);
  },

  loadLogs(reset = false) {
    const pageNo = reset ? 1 : this.data.pageNo;
    const result = importService.listImportLogs({
      keyword: this.data.keyword,
      status: this.data.activeStatus,
      pageNo,
      pageSize: this.data.pageSize
    });
    const items = result.items || [];
    this.setData({
      logs: reset ? items : this.data.logs.concat(items),
      total: result.total || 0,
      pageNo: (result.pageNo || pageNo) + 1,
      hasMore: !!result.hasMore
    });
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value }, () => {
      this.loadLogs(true);
    });
  },

  switchStatus(e) {
    this.setData({ activeStatus: e.currentTarget.dataset.value || "" }, () => {
      this.loadLogs(true);
    });
  },

  loadMore() {
    if (!this.data.hasMore) return;
    this.loadLogs(false);
  }
});
