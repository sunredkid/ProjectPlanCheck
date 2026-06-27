const authService = require("../../services/auth-service");
const dataService = require("../../services/data-service");

const PAGE_SIZE = 15;

function isDoneTask(task = {}) {
  const status = String(task.status || "");
  return !!task.closed || status.indexOf("已完成") >= 0 || status.indexOf("已关闭") >= 0 || status.indexOf("关闭") >= 0;
}

Page({
  data: {
    tabs: [
      { key: "mine", label: "我的" },
      { key: "department", label: "本部门" },
      { key: "assign", label: "待分配" },
      { key: "today", label: "今日" },
      { key: "overdue", label: "逾期" },
      { key: "qb", label: "QB" }
    ],
    statusFilters: [
      { key: "", label: "全部状态" },
      { key: "open", label: "未完成" },
      { key: "done", label: "已完成" },
      { key: "assign", label: "待分配" },
      { key: "qb", label: "QB" }
    ],
    activeTab: "mine",
    activeStatus: "",
    keyword: "",
    ownerKeyword: "",
    dueSoonOnly: false,
    tasks: [],
    total: 0,
    pageNo: 1,
    hasMore: false,
    loading: false,
    loadingMore: false,
    viewMode: "list",
    kanbanColumns: [],
    draggingTask: null,
    dragOverColumn: ""
  },


  switchViewMode: function() {
    var mode = this.data.viewMode === "list" ? "kanban" : "list";
    this.setData({ viewMode: mode }, function() {
      if (mode === "kanban") this.buildKanban();
    }.bind(this));
  },
  onLoad() {
    this.cloudUnsubscribe = dataService.onCloudStoreChange(() => {
      this.loadTasks();
    });
  },

  onShow() {
    this.loadTasks();
  },

  onUnload() {
    if (this.cloudUnsubscribe) {
      this.cloudUnsubscribe();
      this.cloudUnsubscribe = null;
    }
  },


  // ---- Kanban view ----

  buildKanban: function() {
    var tasks = this.getAllFilteredTasks().filter(function(t) { return !isDoneTask(t); });
    // Column definitions: use status values as columns
    var colKeys = ["待处理", "进行中", "延期", "待分配", "QB待处理"];
    var columns = colKeys.map(function(key) {
      return {
        key: key,
        label: key,
        tasks: tasks.filter(function(t) {
          var s = String(t.status || "");
          if (key === "待处理") return s === "待处理" || s.indexOf("待处理") >= 0;
          if (key === "进行中") return s === "进行中" || s.indexOf("进行") >= 0 || s.indexOf("处理中") >= 0;
          if (key === "延期") return s === "延期" || s.indexOf("延期") >= 0 || s.indexOf("逾期") >= 0;
          if (key === "待分配") return t.kind === "assign";
          if (key === "QB待处理") return t.kind === "qb";
          return false;
        })
      };
    });
    this.setData({ kanbanColumns: columns });
  },

  onTaskTouchStart: function(e) {
    var rowKey = e.currentTarget.dataset.rowKey;
    this._dragTask = { rowKey: rowKey, startX: e.touches[0].pageX, startY: e.touches[0].pageY };
  },

  onTaskTouchMove: function(e) {
    if (!this._dragTask) return;
    var dx = e.touches[0].pageX - this._dragTask.startX;
    var dy = e.touches[0].pageY - this._dragTask.startY;
    // Only activate drag after 10px movement
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    this.setData({ draggingTask: this._dragTask.rowKey });
  },

  onDragOverColumn: function(e) {
    var colKey = e.currentTarget.dataset.column;
    if (colKey !== this.data.dragOverColumn) {
      this.setData({ dragOverColumn: colKey });
    }
  },

  onDropTask: function() {
    if (!this.data.draggingTask || !this.data.dragOverColumn) {
      this.setData({ draggingTask: null, dragOverColumn: "" });
      return;
    }
    var rowKey = this.data.draggingTask;
    var targetStatus = this.data.dragOverColumn;

    // Map column key back to actual status value
    var statusMap = { "待分配": "待分配", "QB待处理": "QB待处理" };
    var newStatus = statusMap[targetStatus] || targetStatus;

    // Update the task status in mock data via dataService
    var task = dataService.getTaskByRowKey(rowKey);
    if (!task) {
      this.setData({ draggingTask: null, dragOverColumn: "" });
      return;
    }
    task.status = newStatus;
    if (newStatus === "待分配") { task.owner = ""; task.kind = "assign"; }
    if (newStatus === "QB待处理") { task.kind = "qb"; }

    this.setData({ draggingTask: null, dragOverColumn: "" });
    this.buildKanban();
    wx.showToast({ title: "已移至 " + targetStatus, icon: "none" });
  },
  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore) {
      this.loadMoreTasks();
    }
  },

  filterByKeyword(tasks = []) {
    const keyword = String(this.data.keyword || "").trim().toLowerCase();
    if (!keyword) return tasks;
    return tasks.filter((item) => {
      const haystack = [
        item.process,
        item.project,
        item.device,
        item.department,
        item.qbNo,
        item.title,
        item.owner,
        item.type,
        item.status
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.indexOf(keyword) >= 0;
    });
  },

  filterByOwner(tasks = []) {
    const keyword = String(this.data.ownerKeyword || "").trim().toLowerCase();
    if (!keyword) return tasks;
    return tasks.filter((item) => {
      const haystack = [item.owner, item.department].filter(Boolean).join(" ").toLowerCase();
      return haystack.indexOf(keyword) >= 0;
    });
  },

  filterByStatus(tasks = []) {
    const status = this.data.activeStatus;
    if (!status) return tasks;
    if (status === "open") return tasks.filter((item) => !isDoneTask(item));
    if (status === "done") return tasks.filter(isDoneTask);
    if (status === "assign") return tasks.filter((item) => item.kind === "assign");
    if (status === "qb") return tasks.filter((item) => item.kind === "qb");
    return tasks;
  },

  getAllFilteredTasks() {
    let tasks = dataService.filterTasksByView(this.data.activeTab, authService.getCurrentUser());
    tasks = this.filterByKeyword(tasks);
    tasks = this.filterByOwner(tasks);
    tasks = this.filterByStatus(tasks);
    if (this.data.dueSoonOnly) {
      tasks = tasks.filter((item) => item.isDueSoon || item.isDueToday || item.isOverdue);
    }
    return tasks;
  },

  loadTasks() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    const all = this.getAllFilteredTasks();
    const total = all.length;
    const pageCount = Math.ceil(total / PAGE_SIZE);
    this.setData({
      tasks: all.slice(0, PAGE_SIZE),
      total,
      pageNo: 1,
      hasMore: pageCount > 1,
      loading: false
    }, () => {
      if (this.data.viewMode === "kanban") this.buildKanban();
    });
  },

  loadMoreTasks() {
    const all = this.getAllFilteredTasks();
    const pageNo = this.data.pageNo + 1;
    const start = this.data.pageNo * PAGE_SIZE;
    const nextSlice = all.slice(start, start + PAGE_SIZE);
    if (nextSlice.length === 0) {
      this.setData({ hasMore: false });
      return;
    }
    this.setData({ loadingMore: true });
    this.setData({
      tasks: [...this.data.tasks, ...nextSlice],
      pageNo,
      hasMore: start + PAGE_SIZE < all.length,
      loadingMore: false
    });
  },

  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.value, pageNo: 1 }, () => {
      this.loadTasks();
    });
  },

  switchStatus(e) {
    this.setData({ activeStatus: e.currentTarget.dataset.value || "", pageNo: 1 }, () => {
      this.loadTasks();
    });
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value, pageNo: 1 }, () => {
      this.loadTasks();
    });
  },

  onOwnerInput(e) {
    this.setData({ ownerKeyword: e.detail.value, pageNo: 1 }, () => {
      this.loadTasks();
    });
  },

  toggleDueSoon() {
    this.setData({ dueSoonOnly: !this.data.dueSoonOnly, pageNo: 1 }, () => {
      this.loadTasks();
    });
  },

  resetFilters() {
    this.setData({
      activeStatus: "",
      keyword: "",
      ownerKeyword: "",
      dueSoonOnly: false,
      pageNo: 1
    }, () => {
      this.loadTasks();
    });
  },

  submitProgress(e) {
    const rowKey = e.currentTarget.dataset.rowKey || "";
    if (!rowKey) {
      wx.showToast({ title: "任务标识缺失", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: `/pages/progress-submit/index?rowKey=${encodeURIComponent(rowKey)}`
    });
  },

  handleQb(e) {
    const qbNo = e.currentTarget.dataset.qbNo;
    if (!qbNo) {
      wx.showToast({ title: "QB编号缺失", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: `/pages/qb-detail/index?qbNo=${encodeURIComponent(qbNo)}`
    });
  },

  assignTask(e) {
    const rowKey = e.currentTarget.dataset.rowKey || "";
    if (!rowKey) {
      wx.showToast({ title: "任务标识缺失", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: `/pages/department-dispatch/index?rowKey=${encodeURIComponent(rowKey)}`
    });
  }
});
