const dataService = require("../../services/data-service");

Page({
  data: {
    keyword: "",
    statusFilters: [
      { key: "", label: "全部" },
      { key: "open", label: "未关闭" },
      { key: "closed", label: "已关闭" }
    ],
    activeStatus: "",
    projectOptions: [],
    ownerOptions: [],
    activeProjectNo: "",
    activeOwner: "",
    qbList: [],
    timelineGroups: [],
    total: 0,
    pageNo: 1,
    pageSize: 8,
    hasMore: false,
    isLoading: false
  },

  buildTimelineGroups(items = []) {
    const groups = [];
    const map = {};
    items.forEach((item) => {
      const key = item.projectOrderLabel || "未记录下单时间";
      if (!map[key]) {
        map[key] = {
          key,
          label: key,
          items: []
        };
        groups.push(map[key]);
      }
      map[key].items.push(item);
    });
    return groups;
  },

  onLoad() {
    this.cloudUnsubscribe = dataService.onCloudStoreChange(() => {
      this.refreshFilterOptions();
      this.loadQb(true);
    });
  },

  onShow() {
    this.refreshFilterOptions();
    this.loadQb(true);
  },

  onUnload() {
    if (this.cloudUnsubscribe) {
      this.cloudUnsubscribe();
      this.cloudUnsubscribe = null;
    }
  },

  refreshFilterOptions() {
    const allQb = dataService.listQb({});
    const source = Array.isArray(allQb) ? allQb : (allQb.items || []);
    const projectMap = {};
    const ownerMap = {};
    source.forEach((item) => {
      if (item.projectNo && !projectMap[item.projectNo]) {
        projectMap[item.projectNo] = {
          key: item.projectNo,
          label: item.projectName ? `${item.projectNo} ${item.projectName}` : item.projectNo
        };
      }
      if (item.displayOwner && !ownerMap[item.displayOwner]) {
        ownerMap[item.displayOwner] = {
          key: item.displayOwner,
          label: item.displayOwner
        };
      }
    });
    this.setData({
      projectOptions: Object.keys(projectMap).map((key) => projectMap[key]),
      ownerOptions: Object.keys(ownerMap).map((key) => ownerMap[key])
    });
  },

  loadQb(reset = false) {
    if (this.data.isLoading) {
      return;
    }

    const pageNo = reset ? 1 : this.data.pageNo;
    this.setData({ isLoading: true });
    try {
      const result = dataService.listQb({
        keyword: this.data.keyword,
        status: this.data.activeStatus,
        projectNo: this.data.activeProjectNo,
        owner: this.data.activeOwner,
        pageNo,
        pageSize: this.data.pageSize
      });
      const items = result.items || [];
      const qbList = reset ? items : this.data.qbList.concat(items);
      this.setData({
        qbList,
        timelineGroups: this.buildTimelineGroups(qbList),
        total: result.total || 0,
        pageNo: (result.pageNo || pageNo) + 1,
        hasMore: !!result.hasMore
      });
    } catch (error) {
      wx.showToast({ title: error.message || "QB加载失败", icon: "none" });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value }, () => {
      this.loadQb(true);
    });
  },

  switchStatus(e) {
    this.setData({ activeStatus: e.currentTarget.dataset.value || "" }, () => {
      this.loadQb(true);
    });
  },

  switchProject(e) {
    this.setData({ activeProjectNo: e.currentTarget.dataset.value || "" }, () => {
      this.loadQb(true);
    });
  },

  switchOwner(e) {
    this.setData({ activeOwner: e.currentTarget.dataset.value || "" }, () => {
      this.loadQb(true);
    });
  },

  resetFilters() {
    this.setData({
      keyword: "",
      activeStatus: "",
      activeProjectNo: "",
      activeOwner: ""
    }, () => {
      this.loadQb(true);
    });
  },

  loadMore() {
    if (!this.data.hasMore || this.data.isLoading) return;
    this.loadQb(false);
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
  }
});
