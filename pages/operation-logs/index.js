const auditService = require("../../services/audit-service");

Page({
  data: {
    keyword: "",
    moduleFilters: [
      { key: "", label: "全部" },
      { key: "project", label: "项目" },
      { key: "device", label: "设备" },
      { key: "dispatch", label: "派单" },
      { key: "progress", label: "进度" },
      { key: "qb", label: "QB" },
      { key: "param", label: "参数" },
      { key: "user", label: "用户" },
      { key: "department", label: "部门" },
      { key: "import", label: "导入" }
    ],
    activeModule: "",
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
    const result = auditService.listOperationLogs({
      keyword: this.data.keyword,
      module: this.data.activeModule,
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

  switchModule(e) {
    this.setData({ activeModule: e.currentTarget.dataset.value || "" }, () => {
      this.loadLogs(true);
    });
  },

  loadMore() {
    if (!this.data.hasMore) return;
    this.loadLogs(false);
  }
});
