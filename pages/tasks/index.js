const authService = require("../../services/auth-service");
const dataService = require("../../services/data-service");
const permissionService = require("../../services/permission-service");

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
    dragOverColumn: "",
    currentUser: {},
    isDepartmentManager: false
  },

  onLoad() {
    this.cloudUnsubscribe = dataService.onCloudStoreChange(() => {
      this.loadTasks();
    });
  },

  onShow() {
    const currentUser = authService.getCurrentUser() || {};
    this.setData({
      currentUser,
      isDepartmentManager: permissionService.isDepartmentManager(currentUser)
    });
    this.loadTasks();
  },

  onUnload() {
    if (this.cloudUnsubscribe) {
      this.cloudUnsubscribe();
      this.cloudUnsubscribe = null;
    }
  },

  switchViewMode() {
    const mode = this.data.viewMode === "list" ? "kanban" : "list";
    this.setData({ viewMode: mode }, () => {
      if (mode === "kanban") this.buildKanban();
    });
  },

  buildKanban() {
    const tasks = this.getAllFilteredTasks().filter((task) => !isDoneTask(task));
    const columns = [
      { key: "待处理", label: "待处理" },
      { key: "进行中", label: "进行中" },
      { key: "延期", label: "延期" },
      { key: "待分配", label: "待分配" },
      { key: "QB待处理", label: "QB待处理" }
    ].map((col) => ({
      ...col,
      tasks: tasks.filter((task) => {
        const status = String(task.status || "");
        if (col.key === "待处理") return status === "待处理" || status.indexOf("待处理") >= 0;
        if (col.key === "进行中") return status === "进行中" || status.indexOf("进行") >= 0 || status.indexOf("处理") >= 0;
        if (col.key === "延期") return status === "延期" || status.indexOf("延期") >= 0 || status.indexOf("逾期") >= 0;
        if (col.key === "待分配") return task.kind === "assign" || status.indexOf("待部门派单") >= 0;
        if (col.key === "QB待处理") return task.kind === "qb";
        return false;
      })
    }));
    this.setData({ kanbanColumns: columns });
  },

  onTaskTouchStart(e) {
    const rowKey = e.currentTarget.dataset.rowKey;
    this._dragTask = { rowKey, startX: e.touches[0].pageX, startY: e.touches[0].pageY };
  },

  onTaskTouchMove(e) {
    if (!this._dragTask) return;
    const dx = e.touches[0].pageX - this._dragTask.startX;
    const dy = e.touches[0].pageY - this._dragTask.startY;
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    this.setData({ draggingTask: this._dragTask.rowKey });
  },

  onDragOverColumn(e) {
    const colKey = e.currentTarget.dataset.column;
    if (colKey !== this.data.dragOverColumn) {
      this.setData({ dragOverColumn: colKey });
    }
  },

  onDropTask(e) {
    const targetStatus = this.data.dragOverColumn || (e && e.currentTarget && e.currentTarget.dataset.column) || "";
    if (!this.data.draggingTask || !targetStatus) {
      this.setData({ draggingTask: null, dragOverColumn: "" });
      this._dragTask = null;
      return;
    }
    const result = dataService.updateTaskStatusByRowKey(this.data.draggingTask, targetStatus);
    this.setData({ draggingTask: null, dragOverColumn: "" });
    this._dragTask = null;
    if (!result || !result.ok) {
      wx.showToast({ title: (result && result.message) || "移动失败", icon: "none" });
      return;
    }
    this.loadTasks();
    wx.showToast({ title: "已移至" + targetStatus, icon: "none" });
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
    this.setData({
      loadingMore: true,
      tasks: this.data.tasks.concat(nextSlice),
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
    const task = dataService.getTaskByRowKey(rowKey);
    if (this.data.isDepartmentManager && task) {
      if (task.department !== this.data.currentUser.department) {
        wx.showToast({ title: "只能提交本部门项目进度", icon: "none" });
        return;
      }
      const projectNo = task.projectNo || String(task.project || "").split(/\s+/)[0];
      wx.navigateTo({
        url: `/pages/progress-submit/index?projectNo=${encodeURIComponent(projectNo)}&process=${encodeURIComponent(task.process)}&department=${encodeURIComponent(task.department)}`
      });
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
