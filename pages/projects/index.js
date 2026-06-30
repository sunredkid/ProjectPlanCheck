const dataService = require("../../services/data-service");
const authService = require("../../services/auth-service");
const permissionService = require("../../services/permission-service");

const YEARS = Array.from({ length: 100 }, (_, index) => String(2000 + index));
const MONTHS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));
const DEFAULT_PERIOD = getCurrentPeriod();

function getCurrentPeriod() {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return {
    year,
    month,
    selectorValue: [
      Math.max(0, YEARS.indexOf(year)),
      Math.max(0, MONTHS.indexOf(month))
    ],
    label: `${year}年${month}月`
  };
}

function canEditProjectInfo(user = {}) {
  const roleText = `${user.role || ""} ${user.roleLabel || ""}`;
  return roleText.indexOf("进度管理员") >= 0 || roleText.indexOf("后台管理员") >= 0;
}

Page({
  data: {
    filters: [
      { key: "all", label: "全部" },
      { key: "ongoing", label: "进行中" },
      { key: "delayed", label: "逾期" },
      { key: "qb", label: "QB" }
    ],
    activeFilter: "all",
    keyword: "",
    timeRanges: [YEARS, MONTHS],
    timeSelectorValue: DEFAULT_PERIOD.selectorValue,
    selectedYear: DEFAULT_PERIOD.year,
    selectedMonth: DEFAULT_PERIOD.month,
    selectedPeriodLabel: DEFAULT_PERIOD.label,
    canEditProject: false,
    canDispatchDepartment: false,
    shipDateHistoryVisible: false,
    shipDateHistoryTitle: "",
    shipDateHistoryRecords: [],
    projects: []
  },

  onLoad() {
    this.cloudUnsubscribe = dataService.onCloudStoreChange(() => {
      this.loadProjects();
    });
  },

  onShow() {
    const user = authService.getCurrentUser();
    this.setData({
      canEditProject: permissionService.canDispatchProject(user) && canEditProjectInfo(user),
      canDispatchDepartment: permissionService.canDispatchDepartment(user)
    });
    this.loadProjects();
  },

  onUnload() {
    if (this.cloudUnsubscribe) {
      this.cloudUnsubscribe();
      this.cloudUnsubscribe = null;
    }
  },

  loadProjects() {
    const { activeFilter, keyword, selectedYear, selectedMonth } = this.data;
    const user = authService.getCurrentUser() || {};
    this.setData({
      projects: dataService.filterProjectsByView(activeFilter, {
        keyword,
        year: selectedYear,
        month: selectedMonth
      }).map((project) => {
        const submitOptions = dataService.getDepartmentProjectSubmitOptions(project.projectNo, user);
        return Object.assign({}, project, {
          departmentSubmitOptions: submitOptions,
          canDepartmentSubmitProject: submitOptions.length > 0,
          departmentSubmitProcess: submitOptions[0] ? submitOptions[0].process : "",
          departmentSubmitDepartment: submitOptions[0] ? submitOptions[0].department : ""
        });
      })
    });
  },

  switchFilter(e) {
    this.setData({ activeFilter: e.currentTarget.dataset.value }, () => {
      this.loadProjects();
    });
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value }, () => {
      this.loadProjects();
    });
  },

  onTimeChange(e) {
    const [yearIndex, monthIndex] = e.detail.value;
    const selectedYear = YEARS[yearIndex] || YEARS[0];
    const selectedMonth = MONTHS[monthIndex] || MONTHS[0];
    this.setData({
      timeSelectorValue: [yearIndex, monthIndex],
      selectedYear,
      selectedMonth,
      selectedPeriodLabel: `${selectedYear}年${selectedMonth}月`
    }, () => {
      this.loadProjects();
    });
  },

  openProject(e) {
    const projectNo = e.currentTarget.dataset.no;
    if (!projectNo) {
      wx.showToast({ title: "项目编号缺失", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: `/pages/project-detail/index?projectNo=${encodeURIComponent(projectNo)}`
    });
  },

  openDepartmentProjectProgress(e) {
    const projectNo = e.currentTarget.dataset.no || "";
    const process = e.currentTarget.dataset.process || "";
    const department = e.currentTarget.dataset.department || "";
    if (!this.data.canDispatchDepartment) {
      wx.showToast({ title: "只有部门管理员可以提交项目进度", icon: "none" });
      return;
    }
    if (!projectNo || !process || !department) {
      wx.showToast({ title: "未找到本部门可提交工序", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: `/pages/progress-submit/index?projectNo=${encodeURIComponent(projectNo)}&process=${encodeURIComponent(process)}&department=${encodeURIComponent(department)}`
    });
  },

  editProject(e) {
    const projectNo = e.currentTarget.dataset.no;
    if (!this.data.canEditProject) {
      wx.showToast({ title: "无项目编辑权限", icon: "none" });
      return;
    }
    if (!projectNo) {
      wx.showToast({ title: "项目编号缺失", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: `/pages/project-edit/index?projectNo=${encodeURIComponent(projectNo)}`
    });
  },

  showShipDateHistory(e) {
    const projectNo = e.currentTarget.dataset.no;
    const project = (this.data.projects || []).find((item) => item.projectNo === projectNo);
    const records = (project && project.shipDateHistory) || [];
    if (!records.length) return;
    this.setData({
      shipDateHistoryVisible: true,
      shipDateHistoryTitle: `${project.projectNo} ${project.name || ""}`,
      shipDateHistoryRecords: records.map((item, index) => ({
        ...item,
        index: index + 1
      }))
    });
  },

  hideShipDateHistory() {
    this.setData({
      shipDateHistoryVisible: false,
      shipDateHistoryTitle: "",
      shipDateHistoryRecords: []
    });
  },

  noop() {},

  importExcel() {
    wx.navigateTo({
      url: "/pages/excel-import/index"
    });
  },

  openQbList() {
    wx.navigateTo({
      url: "/pages/qb-list/index"
    });
  },

  createProject() {
    if (!this.data.canEditProject) {
      wx.showToast({ title: "无项目编辑权限", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: "/pages/project-edit/index"
    });
  }
});
