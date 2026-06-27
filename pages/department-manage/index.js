const dataService = require("../../services/data-service");

Page({
  data: {
    keyword: "",
    allDepartments: [],
    departments: [],
    isUpdatingStatus: false
  },

  onShow() {
    this.loadDepartments();
  },

  loadDepartments() {
    const allDepartments = dataService.listDepartments();
    this.setData({ allDepartments }, () => {
      this.filterDepartments();
    });
  },

  filterDepartments() {
    const keyword = String(this.data.keyword || "").trim().toLowerCase();
    let departments = this.data.allDepartments || [];
    if (keyword) {
      departments = departments.filter((dept) => {
        const haystack = [
          dept.name,
          dept.managers,
          dept.status,
          dept.sort
        ].filter((item) => item !== undefined && item !== null).join(" ").toLowerCase();
        return haystack.indexOf(keyword) >= 0;
      });
    }
    this.setData({ departments });
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value }, () => {
      this.filterDepartments();
    });
  },

  addDepartment() {
    wx.navigateTo({ url: "/pages/department-edit/index?mode=add" });
  },

  editDepartment(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) {
      wx.showToast({ title: "部门标识缺失", icon: "none" });
      return;
    }
    wx.navigateTo({ url: `/pages/department-edit/index?mode=edit&id=${encodeURIComponent(id)}` });
  },

  toggleStatus(e) {
    if (this.data.isUpdatingStatus) return;
    const id = e.currentTarget.dataset.id;
    const department = this.data.allDepartments.find((item) => item.id === id);
    if (!department) {
      wx.showToast({ title: "部门不存在", icon: "none" });
      return;
    }
    this.setData({ isUpdatingStatus: true });
    try {
      const result = dataService.saveDepartment({
        ...department,
        managers: String(department.managers || "").split(/[、,，]/).filter(Boolean),
        status: department.status === "启用" ? "停用" : "启用"
      });
      wx.showToast({
        title: result.ok ? "状态已更新" : result.message || "状态更新失败",
        icon: result.ok ? "success" : "none"
      });
      if (result.ok) this.loadDepartments();
    } catch (error) {
      wx.showToast({ title: error.message || "状态更新失败", icon: "none" });
    } finally {
      this.setData({ isUpdatingStatus: false });
    }
  }
});
