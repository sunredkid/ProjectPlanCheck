const dataService = require("../../services/data-service");

Page({
  data: {
    filters: [
      { key: "all", label: "全部" },
      { key: "ongoing", label: "进行中" },
      { key: "delayed", label: "延期" },
      { key: "qb", label: "有 QB" },
      { key: "archived", label: "已归档" }
    ],
    activeFilter: "all",
    keyword: "",
    projects: []
  },

  onLoad() {
    this.cloudUnsubscribe = dataService.onCloudStoreChange(() => {
      this.loadProjects();
    });
  },

  onShow() {
    this.loadProjects();
  },

  onUnload() {
    if (this.cloudUnsubscribe) {
      this.cloudUnsubscribe();
      this.cloudUnsubscribe = null;
    }
  },

  loadProjects() {
    this.setData({
      projects: dataService.filterProjectsByView(this.data.activeFilter, { keyword: this.data.keyword })
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
    wx.navigateTo({
      url: "/pages/project-edit/index"
    });
  }
});
